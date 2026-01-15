import React from 'react';
import { Episode } from '../../../types/anime';
import { Play, Star, Download, Trash2, Loader2 } from 'lucide-react';

interface EpisodeListProps {
    episodes: Episode[];
    selectedEpisode: Episode | null;
    onEpisodeSelect: (episode: Episode) => void;
    onEpisodePlay: (episode: Episode) => void;
    onToggleFavorite: (episode: Episode) => void;
    isFavorite: (episode: Episode) => boolean;
    onDownload: (anime: any, episode: Episode) => void;
    onDelete: (animeName: string, epNumStr: string) => void;
    isDownloaded: (episode: Episode) => boolean;
    downloadingEpisodes: Record<string, number>;
    currentAnime?: any;
}

const EpisodeList: React.FC<EpisodeListProps> = ({
    episodes,
    selectedEpisode,
    onEpisodeSelect,
    onEpisodePlay,
    onToggleFavorite,
    isFavorite,
    onDownload,
    onDelete,
    isDownloaded,
    downloadingEpisodes,
    currentAnime
}) => {
    return (
        <div className="flex flex-col w-full text-sm select-none">
            {/* Table Header */}
            <div className="flex border-b border-[#E5E5E5] bg-white sticky top-0 z-10">
                <div className="w-12 px-3 py-1.5 text-left text-gray-500 font-normal border-r border-[#E5E5E5]">Eps</div>
                <div className="flex-1 px-3 py-1.5 text-left text-gray-500 font-normal border-r border-[#E5E5E5]">Title</div>
                <div className="w-32 px-3 py-1.5 text-left text-gray-500 font-normal border-r border-[#E5E5E5]">Aired</div>
                <div className="w-24 px-3 py-1.5 text-center text-gray-500 font-normal">Action</div>
            </div>

            {/* List Body */}
            <div className="bg-white min-h-full">
                {episodes.map((ep) => (
                    <div
                        key={ep.number}
                        className={`flex border-b border-transparent cursor-default group ${selectedEpisode?.number === ep.number
                            ? 'bg-[#CCE8FF] outline-[#99D1FF] outline-1'
                            : 'hover:bg-[#E5F3FF]'
                            }`}
                        onClick={() => onEpisodeSelect(ep)}
                        onDoubleClick={() => onEpisodePlay(ep)}
                    >
                        <div className="w-12 px-3 py-1 text-gray-600 truncate flex items-center justify-center">
                            {ep.number}
                        </div>
                        <div className="flex-1 px-3 py-1 text-gray-900 truncate font-normal flex items-center gap-2">
                            <span className="p-0.5 bg-gray-100 rounded text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play size={10} fill="currentColor" />
                            </span>
                            {ep.title || `Episode ${ep.number}`}

                            {ep.hasDub && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Create a synthetic episode for the Dub version
                                        const dubEp = { ...ep, url: ep.dubUrl!, number: ep.dubId || ep.number, title: `${ep.title} (Dub)` };
                                        onEpisodePlay(dubEp);
                                    }}
                                    className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-600 rounded border border-purple-200 hover:bg-purple-200 transition-colors"
                                    title="Play Dubbed Version"
                                >
                                    DUB
                                </button>
                            )}
                        </div>
                        <div className="w-32 px-3 py-1 text-gray-500 truncate flex items-center">
                            {ep.aired || '--'}
                        </div>
                        <div className="w-24 px-3 py-1 flex items-center justify-center gap-1">
                            {currentAnime && downloadingEpisodes[`${currentAnime.name}:${ep.number}`] !== undefined ? (
                                <div className="text-blue-500 animate-spin">
                                    <Loader2 size={16} />
                                </div>
                            ) : isDownloaded(ep) ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (currentAnime) onDelete(currentAnime.name, ep.number.toString());
                                    }}
                                    className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                                    title="Delete from disk"
                                >
                                    <Trash2 size={14} />
                                </button>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (currentAnime) onDownload(currentAnime, ep);
                                    }}
                                    className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                    title="Download for offline"
                                >
                                    <Download size={14} />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(ep);
                                }}
                                className={`p-1 rounded hover:bg-gray-200 focus:outline-none transition-colors ${isFavorite(ep) ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                                title={isFavorite(ep) ? "Remove from Favorites" : "Add to Favorites"}
                            >
                                <Star size={14} fill={isFavorite(ep) ? "currentColor" : "none"} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EpisodeList;
