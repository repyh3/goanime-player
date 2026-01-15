import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Play, Download, Trash2 } from 'lucide-react';
import { DownloadedItem, userLibraryService } from '../../../services/userLibraryService';
import { animeService } from '../../../services/animeService';

interface DownloadsViewProps {
    items: DownloadedItem[];
    onPlay: (anime: any, episode: any) => void;
    downloadingEpisodes: Record<string, number>;
    onPause: (animeName: string, epNumStr: string) => void;
    onResume: (anime: any, episode: any) => void;
    onRemove: (animeName: string, epNumStr: string) => void;
}

interface DownloadCardProps {
    item: DownloadedItem;
    onPlay: (anime: any, episode: any) => void;
    onRemove: (animeName: string, episodeNumber: string) => void;
    downloadingEpisodes: Record<string, number>;
    onPause: (animeName: string, epNumStr: string) => void;
    onResume: (anime: any, episode: any) => void;
}

const DownloadCard: React.FC<DownloadCardProps> = ({
    item,
    onPlay,
    onRemove,
    downloadingEpisodes,
    onPause,
    onResume
}) => {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <div
                className="flex items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="mr-2 text-gray-500">
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                <div className="w-8 h-8 rounded overflow-hidden mr-3 bg-gray-200">
                    <img src={item.anime.imageUrl} alt={item.anime.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="font-medium text-gray-800 flex-1">{item.anime.name}</h3>
                <span className="text-xs text-gray-500 mr-2">{item.episodes.length} episodes</span>
            </div>

            {expanded && (
                <div className="divide-y divide-gray-100">
                    {item.episodes.map(ep => {
                        const downloadKey = `${item.anime.name}:${ep.number}`;
                        const progress = downloadingEpisodes[downloadKey];
                        const isDownloading = progress !== undefined;

                        return (
                            <div key={ep.number} className="flex flex-col border-b border-gray-50 last:border-0">
                                <div className="flex items-center p-3 pl-12 hover:bg-blue-50 group transition-colors">
                                    <div className="flex-1 cursor-pointer" onClick={() => onPlay(item.anime, ep)}>
                                        <div className="flex items-center">
                                            <span className="text-sm font-medium text-gray-700 mr-3 w-6">{ep.number}</span>
                                            <span className="text-sm text-gray-600 group-hover:text-blue-700">
                                                {ep.title || `Episode ${ep.number}`}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isDownloading ? (
                                            <button
                                                onClick={() => onPause(item.anime.name, ep.number.toString())}
                                                className="p-1.5 text-orange-500 hover:bg-orange-100 rounded"
                                                title="Pause download"
                                            >
                                                <div className="w-3 h-3 bg-orange-500 rounded-sm" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => onPlay(item.anime, ep)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                                                title="Play offline"
                                            >
                                                <Play size={14} fill="currentColor" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onRemove(item.anime.name, ep.number.toString())}
                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            title="Delete from disk"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                {isDownloading && (
                                    <div className="px-12 pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-blue-600 w-8">{progress}%</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const DownloadsView: React.FC<DownloadsViewProps> = ({
    items: downloads,
    onPlay,
    downloadingEpisodes,
    onPause,
    onResume,
    onRemove
}) => {
    if (downloads.length === 0 && Object.keys(downloadingEpisodes).length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm flex-col gap-4 bg-white">
                <Download size={40} className="opacity-20" />
                <span>No downloads yet. Save an episode for offline viewing.</span>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white min-h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Downloaded Episodes</h2>
                <div className="flex gap-2">
                    {Object.keys(downloadingEpisodes).length > 0 && (
                        <span className="text-xs text-orange-600 px-2 py-1 bg-orange-50 rounded font-medium animate-pulse">
                            {Object.keys(downloadingEpisodes).length} downloading...
                        </span>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-4 w-full">
                {downloads.map((item) => (
                    <DownloadCard
                        key={item.anime.name}
                        item={item}
                        onPlay={onPlay}
                        onRemove={onRemove}
                        downloadingEpisodes={downloadingEpisodes}
                        onPause={onPause}
                        onResume={onResume}
                    />
                ))}
            </div>
        </div>
    );
};

export default DownloadsView;
