import React, { useState } from 'react';
import { ArrowRight, Search, RefreshCw, ArrowLeft, Folder, Star, Clock, Download, Library } from 'lucide-react';

interface AddressBarProps {
    path: string[];
    onNavigate: (index: number) => void;
    onSearch: (query: string) => void;
    onRefresh: () => void;
    onBack?: () => void;
    onForward?: () => void;
    canBack?: boolean;
    canForward?: boolean;
    isLoading: boolean;
}

const AddressBar: React.FC<AddressBarProps> = ({
    path, onNavigate, onSearch, onRefresh,
    onBack, onForward, canBack, canForward,
    isLoading
}) => {
    const [query, setQuery] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && query.trim()) {
            onSearch(query);
        }
    };

    return (
        <div className="flex items-center gap-2 w-full px-2 py-1.5 bg-[#F5F5F5] border-b border-[#D0D0D0]">
            {/* Navigation Controls */}
            <div className="flex gap-1 text-gray-500">
                <button
                    className="p-1 hover:bg-gray-200 rounded-sm disabled:opacity-30"
                    onClick={onBack}
                    disabled={!canBack}
                >
                    <ArrowLeft size={16} />
                </button>
                <button
                    className="p-1 hover:bg-gray-200 rounded-sm disabled:opacity-30"
                    onClick={onForward}
                    disabled={!canForward}
                >
                    <ArrowRight size={16} />
                </button>
            </div>

            {/* Address Bar */}
            <div className="flex-1 flex items-center bg-white border border-[#C0C0C0] h-7 px-2 hover:border-[#7A7A7A] focus-within:border-[#0078D7] transition-colors relative">
                <div className="mr-2 text-gray-400 font-bold">
                    {path[0] === 'Favorites' ? <Star size={14} fill="currentColor" opacity={0.5} /> :
                        path[0] === 'Recents' ? <Clock size={14} opacity={0.5} /> :
                            path[0] === 'Downloads' ? <Download size={14} opacity={0.5} /> :
                                path[0] === 'Anime' ? <Star size={14} fill="currentColor" opacity={0.5} /> :
                                    <Folder size={14} fill="currentColor" opacity={0.5} />}
                </div>
                <div className="flex-1 text-sm text-gray-700 select-text overflow-hidden whitespace-nowrap flex items-center gap-1">
                    {path.map((segment, idx) => (
                        <React.Fragment key={idx}>
                            <span
                                className={`cursor-pointer hover:underline hover:text-blue-600 ${idx === path.length - 1 ? 'font-medium' : ''}`}
                                onClick={() => onNavigate(idx)}
                            >
                                {segment}
                            </span>
                            {idx < path.length - 1 && <span className="text-gray-400 mx-0.5 select-none">›</span>}
                        </React.Fragment>
                    ))}
                </div>
                <button className="ml-2 text-gray-500 hover:bg-gray-100 p-0.5" onClick={onRefresh}>
                    <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Search Box */}
            <div className="w-64 flex items-center bg-white border border-[#C0C0C0] h-7 px-2 hover:border-[#7A7A7A] focus-within:border-[#0078D7] transition-colors">
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

export default AddressBar;
