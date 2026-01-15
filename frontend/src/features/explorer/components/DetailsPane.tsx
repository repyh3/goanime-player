import React from 'react';
import { Anime, Episode } from '../../../types/anime';
import { Info, FileText, Play } from 'lucide-react';

interface DetailsPaneProps {
    anime: Anime | null;
    selectedEpisode: Episode | null;
    isDub: boolean;
    onToggleDub: (dub: boolean) => void;
}

const DetailsPane: React.FC<DetailsPaneProps> = ({ anime, selectedEpisode, isDub, onToggleDub }) => {
    if (!anime) {
        return (
            <div className="w-80 h-full bg-[#F5F5F5] border-l border-[#D0D0D0] flex flex-col items-center justify-center p-8 text-center text-gray-400">
                <Info size={48} className="opacity-20 mb-4" />
                <p className="text-xs">Select an item to view its details.</p>
            </div>
        );
    }

    return (
        <div className="w-80 h-full bg-[#F5F5F5] border-l border-[#D0D0D0] flex flex-col overflow-hidden">
            <div className="flex-none p-4 border-b border-[#D0D0D0]">
                {anime.imageUrl && (
                    <img
                        src={anime.imageUrl}
                        alt={anime.name}
                        className="w-full aspect-[3/4] object-cover rounded shadow-sm mb-4"
                    />
                )}
                <h2 className="text-sm font-bold text-gray-800 mb-2 truncate" title={anime.name}>
                    {anime.name}
                </h2>

                <div className="flex flex-wrap gap-2 mb-4">
                    {anime.source && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase">
                            {anime.source}
                        </span>
                    )}
                    {anime.hasDub && (
                        <div className="flex bg-gray-200 rounded p-0.5 text-[10px] font-bold">
                            <button
                                className={`px-2 py-0.5 rounded-sm transition-colors ${!isDub ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => onToggleDub(false)}
                            >
                                SUB
                            </button>
                            <button
                                className={`px-2 py-0.5 rounded-sm transition-colors ${isDub ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => onToggleDub(true)}
                            >
                                DUB
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {selectedEpisode ? (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-sm">
                        <div className="flex items-center gap-2 mb-2 text-blue-800">
                            <Play size={14} fill="currentColor" />
                            <span className="text-xs font-bold uppercase">Now Selected</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-800 mb-1">
                            Episode {selectedEpisode.number}: {selectedEpisode.title || 'Untitled'}
                        </h3>
                        {selectedEpisode.synopsis && (
                            <p className="text-[11px] text-gray-600 line-clamp-4 leading-relaxed italic">
                                {selectedEpisode.synopsis}
                            </p>
                        )}
                        {!selectedEpisode.synopsis && (
                            <p className="text-[11px] text-gray-400 italic">No episode description available.</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-600">
                            <FileText size={14} />
                            <span className="text-xs font-bold uppercase">Description</span>
                        </div>
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                            {anime.synopsis || 'No description available.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DetailsPane;
