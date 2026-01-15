import React, { useState } from 'react';
import { ArrowRight, Search, RefreshCw, ArrowLeft, ArrowUp } from 'lucide-react';

interface SearchBarProps {
    onSearch: (query: string) => void;
    isLoading: boolean;
}

import WindowControls from './WindowControls';

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
    const [query, setQuery] = useState('');
    const [path, setPath] = useState('My Anime > Anime Library');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && query.trim()) {
            onSearch(query);
        }
    };

    return (
        <div className="flex items-center gap-2 w-full px-2 py-1.5 bg-white border-b border-[#D9D9D9]">
            {/* Navigation Controls */}
            <div className="flex gap-1 text-gray-500">
                <button className="p-1 hover:bg-gray-200 rounded-sm disabled:opacity-30"><ArrowLeft size={16} /></button>
                <button className="p-1 hover:bg-gray-200 rounded-sm disabled:opacity-30"><ArrowRight size={16} /></button>
                <button className="p-1 hover:bg-gray-200 rounded-sm"><ArrowUp size={16} /></button>
            </div>

            {/* Address Bar */}
            <div className="flex-1 flex items-center bg-white border border-[#D9D9D9] h-7 px-2 hover:border-[#7A7A7A] focus-within:border-[#0078D7] transition-colors relative">
                <div className="mr-2 text-gray-500"><Search size={14} /></div>
                <div className="flex-1 text-sm text-gray-700 select-text overflow-hidden whitespace-nowrap">
                    {path}
                </div>
                <button className="ml-2 text-gray-500 hover:bg-gray-100 p-0.5" onClick={() => { }}>
                    <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Search Box */}
            <div className="w-64 flex items-center bg-white border border-[#D9D9D9] h-7 px-2 hover:border-[#7A7A7A] focus-within:border-[#0078D7] transition-colors">
                <input
                    type="text"
                    className="w-full text-sm outline-none placeholder-gray-500 bg-transparent"
                    placeholder="Search Anime..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                />
                <Search size={14} className="text-gray-500" />
            </div>
        </div>
    );
};

export default SearchBar;
