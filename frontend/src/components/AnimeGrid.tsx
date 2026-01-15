import React from 'react';

import { main } from '../../wailsjs/go/models';

interface AnimeGridProps {
    animes: main.Anime[];
    onSelect: (anime: main.Anime) => void;
}

const AnimeGrid: React.FC<AnimeGridProps> = ({ animes, onSelect }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 p-2">
            {animes.map((anime) => (
                <div
                    key={anime.url}
                    className="group flex flex-col items-center p-2 rounded-sm cursor-pointer hover:bg-[#E5F3FF] border border-transparent hover:border-[#99D1FF] transition-colors"
                    onClick={() => onSelect(anime)}
                    title={anime.name}
                >
                    <div className="w-full aspect-2/3 mb-1 overflow-hidden shadow-sm border border-[#D9D9D9] bg-[#F0F0F0] flex items-center justify-center">
                        <img
                            src={anime.imageUrl || 'https://via.placeholder.com/225x315?text=No+Cover'}
                            alt={anime.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/225x315?text=No+Cover';
                            }}
                        />
                    </div>

                    <div className="text-center w-full px-1">
                        <h3 className="text-[#333333] text-xs font-normal truncate w-full">
                            {anime.name}
                        </h3>
                        {/* Optional subtitle (year, etc.) could go here */}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AnimeGrid;
