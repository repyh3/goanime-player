import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Search as SearchIcon } from 'lucide-react';
import TitleBar from './components/TitleBar';
import ExplorerSidebar from './features/explorer/components/ExplorerSidebar';
import AddressBar from './features/explorer/components/AddressBar';
import AnimeGrid from './features/explorer/components/AnimeGrid';
import EpisodeList from './features/explorer/components/EpisodeList';
import DetailsPane from './features/explorer/components/DetailsPane';
import VideoPlayer from './features/player/components/VideoPlayer';
import RecentsView from './features/explorer/components/RecentsView';
import FavoritesView from './features/explorer/components/FavoritesView';
import DownloadsView from './features/explorer/components/DownloadsView';
import { animeService } from './services/animeService';
import {
    GetEpisodes,
    GetStreamUrl,
    Search,
    GetEpisodeMetadata
} from '../wailsjs/go/main/AnimeService';
import { userLibraryService, DownloadedItem } from './services/userLibraryService';
import { Anime, Episode, StreamResponse } from './types/anime';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';

type ViewMode = 'grid' | 'details' | 'player';

interface NavigationState {
    activeTab: 'library' | 'recents' | 'favorites' | 'downloads';
    viewMode: ViewMode;
    selectedAnime: Anime | null;
    selectedEpisode: Episode | null;
    streamUrl: StreamResponse | null;
    animes: Anime[];
    episodes: Episode[];
    isDub: boolean; // Add isDub to NavigationState
}

const App: React.FC = () => {
    const [animes, setAnimes] = useState<Anime[]>([]);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
    const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
    const [streamUrl, setStreamUrl] = useState<StreamResponse | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'library' | 'recents' | 'favorites' | 'downloads'>('library');
    const [favoriteEpisodes, setFavoriteEpisodes] = useState<Set<string>>(new Set());
    const [downloadingEpisodes, setDownloadingEpisodes] = useState<Record<string, number>>({});
    const [downloadedMetadata, setDownloadedMetadata] = useState<Record<string, string[]>>({});
    const [fullDownloads, setFullDownloads] = useState<DownloadedItem[]>([]);
    const [isDub, setIsDub] = useState(false);

    // Navigation History
    const [history, setHistory] = useState<NavigationState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isNavigatingHistory = React.useRef(false);

    const refreshDownloads = () => {
        setFullDownloads(userLibraryService.getDownloadsMetadata());
    };

    React.useEffect(() => {
        refreshDownloads();
        const interval = setInterval(refreshDownloads, 3000);
        return () => clearInterval(interval);
    }, []);

    const pushHistory = (state: NavigationState) => {
        if (isNavigatingHistory.current) return;

        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            // Don't push if state is exactly the same as current
            const last = newHistory[newHistory.length - 1];
            if (last &&
                last.activeTab === state.activeTab &&
                last.viewMode === state.viewMode &&
                last.selectedAnime?.malId === state.selectedAnime?.malId &&
                last.selectedEpisode?.number === state.selectedEpisode?.number &&
                last.streamUrl?.url === state.streamUrl?.url &&
                last.animes.length === state.animes.length &&
                last.isDub === state.isDub) { // Check isDub
                return prev;
            }
            newHistory.push(state);
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
        });
    };

    const applyState = (state: NavigationState) => {
        isNavigatingHistory.current = true;
        setActiveTab(state.activeTab);
        setViewMode(state.viewMode);
        setSelectedAnime(state.selectedAnime);
        setSelectedEpisode(state.selectedEpisode);
        setStreamUrl(state.streamUrl);
        setAnimes(state.animes);
        setEpisodes(state.episodes);
        setIsDub(state.isDub); // Restore isDub state
        // Reset ref after state updates
        setTimeout(() => {
            isNavigatingHistory.current = false;
        }, 0);
    };

    const handleGoBack = () => {
        if (historyIndex > 0) {
            const nextIndex = historyIndex - 1;
            setHistoryIndex(nextIndex);
            applyState(history[nextIndex]);
        }
    };

    const handleGoForward = () => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);
            applyState(history[nextIndex]);
        }
    };

    // Initial history state
    React.useEffect(() => {
        if (history.length === 0) {
            pushHistory({
                activeTab: 'library',
                viewMode: 'grid',
                selectedAnime: null,
                selectedEpisode: null,
                streamUrl: null,
                animes: [],
                episodes: [],
                isDub: false
            });
        }
    }, [history.length]);

    // Load download status periodically or on mount
    React.useEffect(() => {
        const fetchInitialData = async () => {
            const downloads = await animeService.getDownloads();
            setDownloadedMetadata(downloads);
            try {
                const active = await animeService.getActiveDownloads();
                if (active) setDownloadingEpisodes(active);
            } catch (err) {
                console.error('Error fetching active downloads:', err);
            }
        };
        fetchInitialData();

        const fetchDownloads = async () => {
            const downloads = await animeService.getDownloads();
            setDownloadedMetadata(downloads);
        };
        const interval = setInterval(fetchDownloads, 5000);

        // Listen for progress updates
        console.log('Setting up download-progress listener...');
        EventsOn('download-progress', (data: any) => {
            console.log('Received progress event:', data);
            setDownloadingEpisodes(prev => ({
                ...prev,
                [data.key]: data.progress
            }));
        });

        return () => {
            clearInterval(interval);
            EventsOff('download-progress');
        };
    }, []);

    // Track state changes and push to history
    React.useEffect(() => {
        if (isNavigatingHistory.current) return;

        // Don't push if we're in the initial state and history is empty
        if (history.length === 0 && viewMode === 'grid' && !selectedAnime && !selectedEpisode) return;

        pushHistory({
            activeTab,
            viewMode,
            selectedAnime,
            selectedEpisode,
            streamUrl,
            animes,
            episodes,
            isDub
        });
    }, [activeTab, viewMode, selectedAnime?.malId, selectedEpisode?.number, streamUrl?.url, animes, episodes, isDub]);

    const handleSearch = async (query: string) => {
        setIsLoading(true);
        setError(null);
        setViewMode('grid');
        setSelectedAnime(null);
        setSelectedEpisode(null);
        setStreamUrl(null);
        try {
            const results = await animeService.search(query);
            setAnimes(results);
        } catch (err) {
            console.error('Search error:', err);
            setError('Failed to fetch anime. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnimeSelect = async (anime: Anime, forceDub?: boolean) => {
        const useDub = forceDub !== undefined ? forceDub : isDub;
        setSelectedAnime(anime);
        setSelectedEpisode(null);
        setIsLoading(true);
        setError(null);
        if (forceDub === undefined) {
            setIsDub(false); // Reset to sub by default when selecting NEW anime if we wanted, 
            // but usually it's better to keep preference or reset. 
            // Let's reset isDub to false when switching anime for clean state.
        }

        // Load favorites for this anime
        const favs = userLibraryService.getFavorites();
        const animeFav = favs.find(f => f.anime.malId === anime.malId);
        if (animeFav) {
            setFavoriteEpisodes(new Set(animeFav.episodes.map(e => e.number.toString())));
        } else {
            setFavoriteEpisodes(new Set());
        }

        try {
            const eps = await animeService.getEpisodes(anime, useDub);
            setEpisodes(eps);
            setViewMode('details');

            // Trigger background metadata fetch for all episodes
            if (anime.malId && anime.malId > 0) {
                // Fetch first 20 or all if less
                const toFetch = eps.slice(0, 50);
                toFetch.forEach(async (ep) => {
                    if (!ep.synopsis) {
                        try {
                            // @ts-ignore
                            const meta = await GetEpisodeMetadata(anime.malId, parseInt(ep.number));
                            if (meta) {
                                setEpisodes(prev => prev.map(e =>
                                    e.number === ep.number ? {
                                        ...e,
                                        synopsis: meta.synopsis || e.synopsis,
                                        title: meta.title && meta.title !== ep.number ? meta.title : e.title,
                                        aired: meta.aired || e.aired
                                    } : e
                                ));
                            }
                        } catch (e) {
                            // Silently fail for background fetch
                        }
                    }
                });
            }
        } catch (err) {
            console.error('Episodes error:', err);
            setError('Failed to fetch episodes.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleDub = async (dub: boolean) => {
        if (!selectedAnime) return;
        setIsDub(dub);
        await handleAnimeSelect(selectedAnime, dub);
    };

    const handleEpisodeSelect = (episode: Episode) => {
        setSelectedEpisode(episode);
    };

    const handleEpisodePlay = async (episode: Episode, animeContext?: Anime) => {
        const anime = animeContext || selectedAnime;
        if (!anime) return;

        setSelectedEpisode(episode);
        setError(null);
        setViewMode('player');

        try {
            // Log to recents
            userLibraryService.addToRecents(anime, episode);

            const stream = await animeService.getStreamUrl(anime, episode, isDub);
            setStreamUrl(stream);
        } catch (err) {
            setError('Failed to load stream url');
            console.error(err);
        }
    };

    const handleDownload = async (anime: Anime, episode: Episode) => {
        const key = `${anime.name}:${episode.number}`;
        setDownloadingEpisodes(prev => ({ ...prev, [key]: 0 }));

        // Persist metadata so it shows in DownloadsView immediately
        userLibraryService.addDownloadMetadata(anime, episode);
        refreshDownloads();
        const downloads = await animeService.getDownloads();
        setDownloadedMetadata(downloads);

        // Auto navigate to downloads tab
        setActiveTab('downloads');
        setViewMode('grid');

        try {
            await animeService.downloadEpisode(anime, episode, isDub);
            // Refresh downloads metadata
            const latestDownloads = await animeService.getDownloads();
            setDownloadedMetadata(latestDownloads);
            refreshDownloads();
        } catch (err: any) {
            console.error('Download error:', err);
            setError(`Download failed: ${err.message || err}`);
        } finally {
            setDownloadingEpisodes(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const handleDeleteDownload = async (animeName: string, epNumStr: string) => {
        try {
            await animeService.deleteDownload(animeName, epNumStr);
            // Also remove from local library metadata
            userLibraryService.removeDownloadMetadata(animeName, epNumStr);
            refreshDownloads();
            // Refresh downloads metadata
            const downloads = await animeService.getDownloads();
            setDownloadedMetadata(downloads);
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handlePauseDownload = async (animeName: string, epNumStr: string) => {
        try {
            await animeService.pauseDownload(animeName, epNumStr);
        } catch (err) {
            console.error('Pause error:', err);
        }
    };

    const handleResumeDownload = async (anime: Anime, episode: Episode) => {
        userLibraryService.addDownloadMetadata(anime, episode);
        handleDownload(anime, episode);
    };

    const isDownloaded = (episode: Episode) => {
        if (!selectedAnime) return false;
        const animeDownloads = downloadedMetadata[selectedAnime.name];
        return animeDownloads?.includes(episode.number.toString()) || false;
    };

    const handleToggleFavorite = (episode: Episode) => {
        if (!selectedAnime) return;
        const epNum = episode.number.toString();

        if (favoriteEpisodes.has(epNum)) {
            userLibraryService.removeFavorite(selectedAnime.malId, epNum);
            const newSet = new Set(favoriteEpisodes);
            newSet.delete(epNum);
            setFavoriteEpisodes(newSet);
        } else {
            userLibraryService.addFavorite(selectedAnime, episode);
            const newSet = new Set(favoriteEpisodes);
            newSet.add(epNum);
            setFavoriteEpisodes(newSet);
        }
    };

    const isFavorite = (episode: Episode) => {
        return favoriteEpisodes.has(episode.number.toString());
    };

    const handleNextEpisode = () => {
        if (!selectedAnime || !selectedEpisode) return;
        const currentIndex = episodes.findIndex(ep => ep.number === selectedEpisode.number);
        if (currentIndex !== -1 && currentIndex < episodes.length - 1) {
            handleEpisodePlay(episodes[currentIndex + 1]);
        }
    };

    const handlePrevEpisode = () => {
        if (!selectedAnime || !selectedEpisode) return;
        const currentIndex = episodes.findIndex(ep => ep.number === selectedEpisode.number);
        if (currentIndex > 0) {
            handleEpisodePlay(episodes[currentIndex - 1]);
        }
    };

    const handleBack = () => {
        if (viewMode === 'player') {
            setViewMode('details');
            setStreamUrl(null);
        } else {
            setViewMode('grid');
            setSelectedAnime(null);
            setSelectedEpisode(null);
        }
    };

    const handleNavigate = (path: string) => {
        console.log('Navigating to:', path);
        if (path === 'Anime') {
            setActiveTab('library');
            setViewMode('grid');
            setSelectedAnime(null);
            setStreamUrl(null);
        } else if (path === 'Recent') {
            setActiveTab('recents');
            setViewMode('grid');
            setStreamUrl(null);
        } else if (path === 'Favorites') {
            setActiveTab('favorites');
            setViewMode('grid');
            setStreamUrl(null);
        } else if (path === 'Downloads') {
            setActiveTab('downloads');
            setViewMode('grid');
            setStreamUrl(null);
        }
    };

    const handleRefresh = () => {
        if (viewMode === 'details' && selectedAnime) {
            handleAnimeSelect(selectedAnime);
        } else if (viewMode === 'grid') {
            // For grid, refresh essentially resets/re-searches. 
            // If we had a 'lastQuery' we could use it, but for now we'll just re-fetch the default or current list.
        }
    };



    return (
        <div id="app" className="flex flex-col h-screen w-screen bg-[#f0f0f0] text-black overflow-hidden border border-[#D9D9D9]">
            <TitleBar />

            <div className="flex-none">
                <AddressBar
                    path={
                        viewMode === 'player'
                            ? activeTab === 'library'
                                ? ['Anime', selectedAnime?.name || '', selectedEpisode?.title || `Episode ${selectedEpisode?.number} `]
                                : activeTab === 'recents'
                                    ? ['Recents', 'Playing']
                                    : activeTab === 'favorites'
                                        ? ['Favorites', 'Playing']
                                        : ['Downloads', 'Playing']
                            : activeTab === 'library'
                                ? viewMode === 'grid'
                                    ? ['Anime']
                                    : viewMode === 'details'
                                        ? ['Anime', selectedAnime?.name || '']
                                        : ['Anime']
                                : activeTab === 'recents'
                                    ? ['Recents']
                                    : activeTab === 'favorites'
                                        ? ['Favorites']
                                        : ['Downloads']
                    }
                    onNavigate={(index) => {
                        if (index === 0) {
                            setViewMode('grid');
                            setSelectedAnime(null);
                            setSelectedEpisode(null);
                            setStreamUrl(null);
                        } else if (index === 1) {
                            setViewMode('details');
                            setStreamUrl(null);
                        }
                    }}
                    onSearch={handleSearch}
                    onRefresh={handleRefresh}
                    onBack={handleGoBack}
                    onForward={handleGoForward}
                    canBack={historyIndex > 0}
                    canForward={historyIndex < history.length - 1}
                    isLoading={isLoading}
                />
            </div>

            <div className="flex-1 flex overflow-hidden">
                <ExplorerSidebar onNavigate={handleNavigate} activeTab={activeTab} />

                <div className="flex-1 flex flex-col min-w-0 bg-white shadow-[inset_1px_0_0_rgba(0,0,0,0.05)]">
                    {/* Header removed as requested */}
                    <main className={`flex-1 ${viewMode === 'player' ? 'overflow-hidden' : 'overflow-y-auto'} min-w-0 ${viewMode === 'player' ? 'bg-black' : 'bg-[#E0E0E0]'}`}>
                        {error && <div className="p-4 text-red-500 text-sm">{error}</div>}

                        {!isLoading && activeTab === 'library' && animes.length === 0 && !error && viewMode === 'grid' && (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm flex-col gap-8 bg-white">
                                <div className="opacity-30">
                                    <SearchIcon size={120} strokeWidth={1.5} />
                                </div>
                                <span className="tracking-wide text-gray-500">
                                    Search for an anime to get started
                                </span>
                            </div>
                        )}

                        {isLoading && viewMode !== 'player' && (
                            <div className="p-8 flex items-center justify-center text-gray-500 text-sm gap-3 bg-white h-full">
                                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                <span>Loading...</span>
                            </div>
                        )}

                        {!isLoading && activeTab === 'library' && animes.length > 0 && viewMode === 'grid' && (
                            <div className="h-full bg-white">
                                <AnimeGrid animes={animes} onSelect={handleAnimeSelect} />
                            </div>
                        )}

                        {!isLoading && activeTab === 'recents' && viewMode === 'grid' && (
                            <RecentsView onPlay={async (anime, episode) => {
                                await handleAnimeSelect(anime);
                                handleEpisodePlay(episode, anime);
                            }} />
                        )}

                        {!isLoading && activeTab === 'favorites' && viewMode === 'grid' && (
                            <FavoritesView onPlay={async (anime, episode) => {
                                await handleAnimeSelect(anime);
                                handleEpisodePlay(episode, anime);
                            }} />
                        )}

                        {!isLoading && activeTab === 'downloads' && viewMode === 'grid' && (
                            <DownloadsView
                                items={fullDownloads}
                                onPlay={async (anime: Anime, episode: Episode) => {
                                    await handleAnimeSelect(anime);
                                    handleEpisodePlay(episode, anime);
                                }}
                                downloadingEpisodes={downloadingEpisodes}
                                onPause={handlePauseDownload}
                                onResume={handleResumeDownload}
                                onRemove={handleDeleteDownload}
                            />
                        )}

                        {!isLoading && viewMode === 'details' && (
                            <div className="h-full bg-white">
                                <EpisodeList
                                    episodes={episodes}
                                    selectedEpisode={selectedEpisode}
                                    onEpisodeSelect={handleEpisodeSelect}
                                    onEpisodePlay={handleEpisodePlay}
                                    onToggleFavorite={handleToggleFavorite}
                                    isFavorite={isFavorite}
                                    onDownload={handleDownload}
                                    onDelete={handleDeleteDownload}
                                    isDownloaded={isDownloaded}
                                    downloadingEpisodes={downloadingEpisodes}
                                    currentAnime={selectedAnime}
                                />
                            </div>
                        )}

                        {viewMode === 'player' && streamUrl && (
                            <VideoPlayer
                                stream={streamUrl}
                                onClose={handleBack}
                                onNext={handleNextEpisode}
                                onPrev={handlePrevEpisode}
                                hasNext={episodes.findIndex(ep => ep.number === selectedEpisode?.number) < episodes.length - 1}
                                hasPrev={episodes.findIndex(ep => ep.number === selectedEpisode?.number) > 0}
                                episodeTitle={selectedEpisode?.title || `Episode ${selectedEpisode?.number} `}
                            />
                        )}
                    </main>
                </div>

                {/* Properties Pane - Only visible when viewing an anime details (not player) */}
                {viewMode === 'details' && (
                    <DetailsPane
                        anime={selectedAnime}
                        selectedEpisode={selectedEpisode}
                        isDub={isDub}
                        onToggleDub={handleToggleDub}
                    />
                )}
            </div>

            <footer className="flex-none h-6 bg-[#f0f0f0] border-t border-[#D0D0D0] px-3 flex items-center justify-between text-[11px] text-gray-600">
                <div className="flex items-center gap-4">
                    <span>
                        {viewMode === 'grid'
                            ? `${animes.length} items`
                            : viewMode === 'details'
                                ? `${episodes.length} items`
                                : 'Playing'}
                    </span>
                </div>
            </footer>
        </div>
    );
};

export default App;
