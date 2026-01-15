import { Anime, Episode } from '../types/anime';

export interface RecentItem {
    anime: Anime;
    episode: Episode;
    timestamp: number;
}

export interface FavoriteItem {
    anime: Anime;
    episodes: Episode[];
}

const RECENTS_KEY = 'goanime_recents';
const FAVORITES_KEY = 'goanime_favorites';
const DOWNLOADS_KEY = 'goanime_downloads';

export interface DownloadedItem {
    anime: Anime;
    episodes: Episode[];
}

export const userLibraryService = {
    // Recents
    getRecents(): RecentItem[] {
        try {
            const stored = localStorage.getItem(RECENTS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to parse recents:', e);
            return [];
        }
    },

    addToRecents(anime: Anime, episode: Episode) {
        const recents = this.getRecents();
        // Remove existing entry for this anime/episode combo to bump it to top
        const filtered = recents.filter(item =>
            !(item.anime.malId === anime.malId && item.episode.number === episode.number)
        );

        const newItem: RecentItem = {
            anime,
            episode,
            timestamp: Date.now()
        };

        // Add to front, cap at 5
        const updated = [newItem, ...filtered].slice(0, 5);
        localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
    },

    // Favorites
    getFavorites(): FavoriteItem[] {
        try {
            const stored = localStorage.getItem(FAVORITES_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to parse favorites:', e);
            return [];
        }
    },

    addFavorite(anime: Anime, episode: Episode) {
        const favorites = this.getFavorites();
        const existingAnimeIndex = favorites.findIndex(f => f.anime.malId === anime.malId);

        if (existingAnimeIndex >= 0) {
            // Anime exists, check if episode exists
            const existingAnime = favorites[existingAnimeIndex];
            if (!existingAnime.episodes.some(e => e.number === episode.number)) {
                existingAnime.episodes.push(episode);
                // Sort episodes by number
                // Sort episodes by number, handling potential string values
                existingAnime.episodes.sort((a, b) => Number(a.number) - Number(b.number));
                favorites[existingAnimeIndex] = existingAnime;
                localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
            }
        } else {
            // New anime entry
            const newFavorite: FavoriteItem = {
                anime,
                episodes: [episode]
            };
            favorites.push(newFavorite);
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        }
    },

    removeFavorite(animeId: number, episodeNumber: number | string) {
        let favorites = this.getFavorites();
        const animeIndex = favorites.findIndex(f => f.anime.malId === animeId);

        if (animeIndex >= 0) {
            const animeItem = favorites[animeIndex];
            // Ensure strict comparison if types match, or loose if needed. 
            // Episode.number is string in type def, but some logic might treat as number.
            // Let's cast to string to be safe based on type def.
            const epNumStr = episodeNumber.toString();
            animeItem.episodes = animeItem.episodes.filter(e => e.number.toString() !== epNumStr);

            if (animeItem.episodes.length === 0) {
                // Remove anime if no episodes left
                favorites = favorites.filter(f => f.anime.malId !== animeId);
            } else {
                favorites[animeIndex] = animeItem;
            }
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        }
    },

    isFavorite(animeId: number, episodeNumber: number | string): boolean {
        const favorites = this.getFavorites();
        const animeItem = favorites.find(f => f.anime.malId === animeId);
        const epNumStr = episodeNumber.toString();
        return animeItem ? animeItem.episodes.some(e => e.number.toString() === epNumStr) : false;
    },

    // Downloads Metadata (Sync with actual files on disk)
    getDownloadsMetadata(): DownloadedItem[] {
        try {
            const stored = localStorage.getItem(DOWNLOADS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to parse downloads:', e);
            return [];
        }
    },

    addDownloadMetadata(anime: Anime, episode: Episode) {
        const downloads = this.getDownloadsMetadata();
        const existingAnimeIndex = downloads.findIndex(d => d.anime.name === anime.name);

        if (existingAnimeIndex >= 0) {
            const existingAnime = downloads[existingAnimeIndex];
            if (!existingAnime.episodes.some(e => e.number === episode.number)) {
                existingAnime.episodes.push(episode);
                existingAnime.episodes.sort((a, b) => Number(a.number) - Number(b.number));
                downloads[existingAnimeIndex] = existingAnime;
                localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
            }
        } else {
            downloads.push({ anime, episodes: [episode] });
            localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
        }
    },

    removeDownloadMetadata(animeName: string, episodeNumber: string) {
        let downloads = this.getDownloadsMetadata();
        const animeIndex = downloads.findIndex(d => d.anime.name === animeName);

        if (animeIndex >= 0) {
            const animeItem = downloads[animeIndex];
            animeItem.episodes = animeItem.episodes.filter(e => e.number.toString() !== episodeNumber.toString());

            if (animeItem.episodes.length === 0) {
                downloads = downloads.filter(d => d.anime.name !== animeName);
            } else {
                downloads[animeIndex] = animeItem;
            }
            localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(downloads));
        }
    }
};
