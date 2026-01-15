import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Play, Star, Trash2 } from 'lucide-react';
import { FavoriteItem, userLibraryService } from '../../../services/userLibraryService';

interface FavoritesViewProps {
    onPlay: (anime: any, episode: any) => void;
}

interface FavoriteCardProps {
    item: FavoriteItem;
    onPlay: (anime: any, episode: any) => void;
    onRemove: (animeId: number, episodeNumber: number | string) => void;
}

const FavoriteCard: React.FC<FavoriteCardProps> = ({ item, onPlay, onRemove }) => {
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
                <span className="text-xs text-gray-500 mr-2">{item.episodes.length} starred</span>
            </div>

            {expanded && (
                <div className="divide-y divide-gray-100">
                    {item.episodes.map(ep => (
                        <div key={ep.number} className="flex items-center p-3 pl-12 hover:bg-blue-50 group transition-colors">
                            <div className="flex-1 cursor-pointer" onClick={() => onPlay(item.anime, ep)}>
                                <div className="flex items-center">
                                    <span className="text-sm font-medium text-gray-700 mr-3 w-6">{ep.number}</span>
                                    <span className="text-sm text-gray-600 group-hover:text-blue-700">
                                        {ep.title || `Episode ${ep.number}`}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => onPlay(item.anime, ep)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                                    title="Play"
                                >
                                    <Play size={14} fill="currentColor" />
                                </button>
                                <button
                                    onClick={() => onRemove(item.anime.malId, ep.number)}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Remove from favorites"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const FavoritesView: React.FC<FavoritesViewProps> = ({ onPlay }) => {
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

    const loadFavorites = () => {
        setFavorites(userLibraryService.getFavorites());
    };

    useEffect(() => {
        loadFavorites();
    }, []);

    const handleRemove = (animeId: number, episodeNumber: number | string) => {
        userLibraryService.removeFavorite(animeId, episodeNumber);
        loadFavorites();
    };

    if (favorites.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm flex-col gap-4 bg-white">
                <Star size={40} className="opacity-20" />
                <span>No favorites yet. Star an episode to see it here.</span>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white min-h-full">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Favorite Episodes</h2>
            <div className="flex flex-col gap-4 w-full">
                {favorites.map((item) => (
                    <FavoriteCard
                        key={item.anime.malId}
                        item={item}
                        onPlay={onPlay}
                        onRemove={handleRemove}
                    />
                ))}
            </div>
        </div>
    );
};

export default FavoritesView;
