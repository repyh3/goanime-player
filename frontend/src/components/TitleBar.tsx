import React from 'react';
import WindowControls from './WindowControls';

const TitleBar: React.FC = () => {
    return (
        <div className="h-8 bg-white flex justify-between items-center select-none border-b border-[#D9D9D9]" style={{ "--wails-draggable": "drag" } as React.CSSProperties}>
            <div className="px-3 text-xs font-normal tracking-wide text-black flex items-center gap-2">
                <span className="text-gray-600">Goanime Player</span>
            </div>
            <div className="h-full" style={{ "--wails-draggable": "no-drag" } as React.CSSProperties}>
                <WindowControls />
            </div>
        </div>
    );
};

export default TitleBar;
