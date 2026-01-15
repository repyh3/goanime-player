import React from 'react';
import { WindowMinimise, WindowToggleMaximise, Quit } from '../../wailsjs/runtime/runtime';

const WindowControls: React.FC = () => {
    return (
        <div className="flex h-full items-center">
            <div
                className="h-full px-4 flex items-center justify-center hover:bg-black/5 transition-colors cursor-pointer text-gray-600"
                onClick={WindowMinimise}
            >
                <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="10" height="1" fill="currentColor" />
                </svg>
            </div>
            <div
                className="h-full px-4 flex items-center justify-center hover:bg-black/5 transition-colors cursor-pointer text-gray-600"
                onClick={WindowToggleMaximise}
            >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" />
                </svg>
            </div>
            <div
                className="h-full px-4 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors cursor-pointer text-gray-400"
                onClick={Quit}
            >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            </div>
        </div>
    );
};

export default WindowControls;
