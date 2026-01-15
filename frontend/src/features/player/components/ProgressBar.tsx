import React, { useState, useRef, useEffect, useMemo } from 'react';
import Hls from 'hls.js';

interface ProgressBarProps {
    currentTime: number;
    duration: number;
    buffered: TimeRanges | null;
    onSeek: (time: number) => void;
    onSeekStart?: () => void;
    onSeekEnd?: () => void;
    streamUrl: string;
    isHls: boolean;
    isDownloaded?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
    currentTime,
    duration,
    buffered,
    onSeek,
    onSeekStart,
    onSeekEnd,
    streamUrl,
    isHls,
    isDownloaded
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Use refs for high-frequency updates to avoid re-renders
    const hoverBarRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const tooltipTextRef = useRef<HTMLDivElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const previewHlsRef = useRef<Hls | null>(null);
    const seekDebounceRef = useRef<any>(null);

    // Calculate buffer segments
    const bufferSegments = useMemo(() => {
        if (isDownloaded) return [{ left: 0, width: 100 }];
        if (!buffered || duration <= 0) return [];
        const segments = [];
        for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);
            segments.push({
                left: (start / duration) * 100,
                width: ((end - start) / duration) * 100
            });
        }
        return segments;
    }, [buffered, duration, isDownloaded]);

    const formatTime = (time: number) => {
        if (isNaN(time)) return "00:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Lazy load preview player
    useEffect(() => {
        if (!isHovering) {
            // Cleanup on exit
            if (previewHlsRef.current) {
                previewHlsRef.current.destroy();
                previewHlsRef.current = null;
            }
            if (previewVideoRef.current) {
                previewVideoRef.current.removeAttribute('src');
                previewVideoRef.current.load();
            }
            return;
        }

        const video = previewVideoRef.current;
        if (!video) return;

        // Force low quality for preview
        if (isHls && Hls.isSupported()) {
            const hls = new Hls({
                autoStartLoad: true,
                startLevel: 0, // Start with lowest level
                capLevelToPlayerSize: true
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            previewHlsRef.current = hls;
        } else {
            video.src = streamUrl;
        }
    }, [isHovering, isHls, streamUrl]);

    const getPercentageFromEvent = (e: React.MouseEvent | MouseEvent) => {
        if (!containerRef.current) return 0;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        return x / rect.width;
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;

        const pct = getPercentageFromEvent(e);
        const hoverTime = pct * duration;

        // Direct DOM manipulation for performance (tooltip & ghost bar)
        if (hoverBarRef.current) {
            hoverBarRef.current.style.width = `${pct * 100}%`;
        }
        if (tooltipRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Assuming tooltip is 160px wide (w-40)
            const tooltipWidth = 160;
            // Center tooltip on cursor
            let leftPx = (pct * rect.width);

            // Constrain to container bounds
            leftPx = Math.max(tooltipWidth / 2, Math.min(leftPx, rect.width - tooltipWidth / 2));

            tooltipRef.current.style.left = `${leftPx}px`;
        }
        if (tooltipTextRef.current) {
            tooltipTextRef.current.innerText = formatTime(hoverTime);
        }

        // Debounced seek for preview video
        if (isHovering && previewVideoRef.current) {
            if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);

            seekDebounceRef.current = setTimeout(() => {
                if (previewVideoRef.current) {
                    if (Number.isFinite(hoverTime)) {
                        previewVideoRef.current.currentTime = hoverTime;
                    }
                }
            }, 100); // 100ms debounce
        }

        if (isDragging) {
            onSeek(hoverTime);
        }
    };

    // Global listeners for dragging behavior
    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const pct = getPercentageFromEvent(e);
                onSeek(pct * duration);

                // Also update tooltip/ghost bar during drag even if mouse leaves container
                if (hoverBarRef.current) hoverBarRef.current.style.width = `${pct * 100}%`;
                // ... (simpler tooltip update for drag if needed, or rely on internal mouseMove logic handled by local mousemove if hovering)
            }
        };

        const handleGlobalMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                if (onSeekEnd) onSeekEnd();
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDragging, duration, onSeek, onSeekEnd]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        if (onSeekStart) onSeekStart();

        const pct = getPercentageFromEvent(e);
        onSeek(pct * duration);
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div
            className="group relative flex items-center h-1.5 w-full cursor-pointer touch-none py-4 select-none"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onMouseDown={handleMouseDown}
        >
            {/* Background Track */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-300 -translate-y-1/2 rounded-full overflow-hidden">
                {/* Buffered Segments */}
                {bufferSegments.map((segment, i) => (
                    <div
                        key={i}
                        className="absolute top-0 h-full bg-gray-400"
                        style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                    />
                ))}
            </div>

            {/* Ghost / Hover Bar */}
            <div
                ref={hoverBarRef}
                className={`absolute top-1/2 left-0 h-1 bg-gray-500/50 -translate-y-1/2 transition-opacity duration-150 rounded-l-full pointer-events-none ${isHovering || isDragging ? 'opacity-100' : 'opacity-0'}`}
                style={{ width: '0%' }}
            />

            {/* Current Progress Bar */}
            <div
                className="absolute top-1/2 left-0 h-1 bg-[#FF8800] -translate-y-1/2 rounded-full pointer-events-none"
                style={{ width: `${progressPercent}%` }}
            >
                {/* Scrubber Handle */}
                <div
                    className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-[#FF8800] rounded-full shadow-md transform transition-transform duration-100 ${isHovering || isDragging ? 'scale-100' : 'scale-0'}`}
                />
            </div>

            {/* Tooltip with Video Preview */}
            <div
                ref={tooltipRef}
                className={`absolute bottom-full mb-4 -translate-x-1/2 flex flex-col items-center bg-black/90 border border-white/10 rounded-lg shadow-xl overflow-hidden pointer-events-none transition-opacity duration-150 z-50 w-40 ${isHovering || isDragging ? 'opacity-100' : 'opacity-0'}`}
                style={{ left: '0%' }}
            >
                {/* Video Container */}
                <div className="relative w-full aspect-video bg-black border-b border-white/10">
                    <video
                        ref={previewVideoRef}
                        muted
                        playsInline
                        className="w-full h-full object-cover transition-opacity duration-200"
                        onSeeked={(e) => (e.currentTarget.style.opacity = '1')}
                        onSeeking={(e) => (e.currentTarget.style.opacity = '0.4')}
                        style={{ opacity: 0 }} // Start hidden
                    />
                </div>

                {/* Time Label */}
                <div ref={tooltipTextRef} className="px-2 py-1 text-xs font-medium text-white shadow-sm font-mono">
                    00:00
                </div>
            </div>
        </div>
    );
};

export default ProgressBar;
