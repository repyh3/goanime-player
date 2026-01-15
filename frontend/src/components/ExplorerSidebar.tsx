import React, { useState } from 'react';
import { ChevronRight, ChevronDown, HardDrive, Monitor, Clock, Star, Download } from 'lucide-react';

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
}

const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({ onNavigate }) => {
    return (
        <div className="h-full bg-white border-r border-[#D9D9D9] w-64 flex flex-col overflow-y-auto py-2">
            <div className="font-semibold text-xs text-gray-500 px-4 mb-2 uppercase tracking-wide">Quick Access</div>
            <SidebarItem label="Downloads" icon={<Download size={16} className="text-blue-500" />} onClick={() => onNavigate('Downloads')} />
            <SidebarItem label="Favorites" icon={<Star size={16} className="text-yellow-400" />} onClick={() => onNavigate('Favorites')} />
            <SidebarItem label="Recent Places" icon={<Clock size={16} className="text-yellow-500" />} onClick={() => onNavigate('Recent')} />

            <div className="my-2 h-px bg-gray-200 mx-2"></div>

            <div className="font-semibold text-xs text-gray-500 px-4 mb-2 uppercase tracking-wide">Library</div>
            <SidebarItem label="My Anime" icon={<Star size={16} className="text-yellow-400" />} isActive={true} onClick={() => onNavigate('Anime')} />
        </div>
    );
};

export default ExplorerSidebar;
