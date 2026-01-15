import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Clock, Star, Download, Library } from 'lucide-react';

interface SidebarItemProps {
    label: string;
    icon: React.ReactNode;
    isActive?: boolean;
    hasChildren?: boolean;
    depth?: number;
    onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ label, icon, isActive, hasChildren, depth = 0, onClick }) => {
    const [expanded, setExpanded] = useState(true);

    const handleExpandCheck = (e: React.MouseEvent) => {
        if (hasChildren) {
            e.stopPropagation();
            setExpanded(!expanded);
        }
    };

    return (
        <div
            className={`flex items-center px-2 py-1 cursor-pointer select-none text-sm group ${isActive ? 'bg-[#CCE8FF] border border-[#99D1FF]' : 'hover:bg-[#E5F3FF] border border-transparent'}`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={onClick}
        >
            {hasChildren ? (
                <div onClick={handleExpandCheck} className="mr-1 text-gray-500 hover:text-black">
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
            ) : (
                <div className="w-4 mr-1"></div>
            )}
            <div className="mr-2 text-gray-700">{icon}</div>
            <span className="truncate">{label}</span>
        </div>
    );
};

interface ExplorerSidebarProps {
    onNavigate: (path: string) => void;
    activeTab: 'library' | 'recents' | 'favorites' | 'downloads';
}

const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({ onNavigate, activeTab }) => {
    const navItems = [
        { id: 'library', icon: <Library size={18} />, label: 'Anime', path: 'Anime' },
        { id: 'recents', icon: <Clock size={18} />, label: 'Recent', path: 'Recent' },
        { id: 'favorites', icon: <Star size={18} />, label: 'Favorites', path: 'Favorites' },
        { id: 'downloads', icon: <Download size={18} />, label: 'Downloads', path: 'Downloads' },
    ];

    return (
        <div className="h-full bg-[#F5F5F5] border-r border-[#D0D0D0] w-64 flex flex-col overflow-y-auto py-2">
            <div className="font-semibold text-[10px] text-gray-500 px-4 mb-2 uppercase tracking-wider">Quick Access</div>
            {navItems.filter(item => ['downloads', 'favorites', 'recents'].includes(item.id)).map(item => (
                <SidebarItem
                    key={item.id}
                    label={item.label}
                    icon={item.icon}
                    isActive={activeTab === item.id}
                    onClick={() => onNavigate(item.path)}
                />
            ))}

            <div className="my-2 h-px bg-[#D0D0D0] mx-2"></div>

            <div className="font-semibold text-[10px] text-gray-500 px-4 mb-2 uppercase tracking-wider">Library</div>
            <SidebarItem label="Anime" icon={<Star size={16} />} isActive={activeTab === 'library'} onClick={() => onNavigate('Anime')} />
        </div>
    );
};

export default ExplorerSidebar;
