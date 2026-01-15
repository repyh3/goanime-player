import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { RecentItem, userLibraryService } from '../../../services/userLibraryService';

interface RecentsViewProps {
    onPlay: (anime: any, episode: any) => void;
}

const RecentsView: React.FC<RecentsViewProps> = ({ onPlay }) => {
    const [recents, setRecents] = useState<RecentItem[]>([]);

    useEffect(() => {
        setRecents(userLibraryService.getRecents());
    }, []);

    if (recents.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm flex-col gap-4 bg-white">
                <span>No recent history yet.</span>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white min-h-full">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Recently Watched</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recents.map((item) => (
                    <div
                        key={`${item.anime.malId}-${item.episode.number}`}
                        className="bg-white border border-gray-200 rounded p-3 hover:shadow-md transition-shadow cursor-pointer group"
                        onClick={() => onPlay(item.anime, item.episode)}
                    >
                        <div className="aspect-video bg-gray-100 rounded mb-2 overflow-hidden relative">
                            <img
                                src={item.anime.imageUrl}
                                alt={item.anime.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                                    <Play size={20} className="fill-black ml-1" />
                                </div>
                            </div>
                        </div>
                        <h3 className="font-medium text-sm text-gray-800 line-clamp-1">{item.anime.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {item.episode.title || `Episode ${item.episode.number}`}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentsView;
