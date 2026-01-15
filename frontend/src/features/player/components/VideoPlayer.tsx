import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Square, Volume2, VolumeX, Maximize, Minimize, Monitor, SkipBack, SkipForward, Settings, Check } from 'lucide-react';
import { StreamResponse } from '../../../types/anime';
import { WindowFullscreen, WindowUnfullscreen, EventsOn } from '../../../../wailsjs/runtime/runtime';
import { ClearCache } from '../../../../wailsjs/go/main/AnimeService';
import ProgressBar from './ProgressBar';

interface VideoPlayerProps {
    stream: StreamResponse;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
    episodeTitle?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, onClose, onNext, onPrev, hasNext, hasPrev, episodeTitle }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState<TimeRanges | null>(null);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isWindowFullscreen, setIsWindowFullscreen] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [levels, setLevels] = useState<{ index: number; height: number; bitrate: number; name?: string }[]>([]);
    const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = Auto
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const hlsRef = useRef<Hls | null>(null);
    const idleTimerRef = useRef<any>(null);
    const [proxyLogs, setProxyLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Listen for proxy logs
    useEffect(() => {
        const cancelLog = EventsOn("proxy:log", (msg: string) => {
            setProxyLogs([msg]);
        });
        return () => {
            // Clean up if needed
        };
    }, []);

    const resetIdleTimer = () => {
        setShowControls(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

        if (isFullscreen || isWindowFullscreen) {
            idleTimerRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    };

    const handleProgress = () => {
        if (videoRef.current) {
            setBuffered(videoRef.current.buffered);
        }
    };

    // Cleanup cache on unmount
    useEffect(() => {
        return () => {
            ClearCache();
        };
    }, []);

    useEffect(() => {
        if (!videoRef.current) return;

        const video = videoRef.current;
        let playPromise: Promise<void> | null = null;

        const safePlay = () => {
            if (video.paused) {
                playPromise = video.play();
                playPromise?.catch(e => {
                    if (e.name !== 'AbortError') {
                        console.error("Playback error:", e);
                    }
                });
            }
        };

        if (stream.isHls && Hls.isSupported()) {
            hlsRef.current = new Hls({
                maxBufferLength: 1800, // Buffer up to 30 minutes
                maxMaxBufferLength: 1800,
                maxBufferSize: 1000 * 1000 * 1000, // Allow up to 1GB in RAM (browser may enforce lower limit)
                enableWorker: true,
                backBufferLength: 90, // Keep 90s back buffer
            });

            hlsRef.current.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error("Fatal network error encountered, trying to recover...");
                            hlsRef.current?.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error("Fatal media error encountered, trying to recover...");
                            hlsRef.current?.recoverMediaError();
                            break;
                        default:
                            console.error("Unrecoverable error:", data);
                            hlsRef.current?.destroy();
                            break;
                    }
                }
            });

            hlsRef.current.loadSource(stream.url);
            hlsRef.current.attachMedia(video);
            hlsRef.current.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                const availableLevels = data.levels.map((l, i) => ({
                    index: i,
                    height: l.height,
                    bitrate: l.bitrate,
                    name: l.name || l.attrs?.NAME
                }));
                // Sort by bitrate if height is equal or missing, otherwise by height
                availableLevels.sort((a, b) => {
                    if (b.height !== a.height) return b.height - a.height;
                    return b.bitrate - a.bitrate;
                });
                setLevels(availableLevels);
                safePlay();
            });
        } else {
            video.src = stream.url;
            video.load();
            safePlay();
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            if (playPromise) {
                playPromise.then(() => {
                    video.pause();
                }).catch(() => { });
            } else {
                video.pause();
            }
        };
    }, [stream.url, stream.headers]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore hotkeys if user is typing in an input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (videoRef.current) {
                        if (videoRef.current.paused) {
                            videoRef.current.play().catch(() => { });
                        } else {
                            videoRef.current.pause();
                        }
                    }
                    resetIdleTimer();
                    break;
                case 'Escape':
                    if (isWindowFullscreen) {
                        WindowUnfullscreen();
                        setIsWindowFullscreen(false);
                    }
                    resetIdleTimer();
                    break;
                case 'ArrowRight':
                    if (videoRef.current) {
                        videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
                        setCurrentTime(videoRef.current.currentTime);
                    }
                    resetIdleTimer();
                    break;
                case 'ArrowLeft':
                    if (videoRef.current) {
                        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                        setCurrentTime(videoRef.current.currentTime);
                    }
                    resetIdleTimer();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (videoRef.current) {
                        const newVol = Math.min(1, videoRef.current.volume + 0.1);
                        videoRef.current.volume = newVol;
                        setVolume(newVol);
                        setIsMuted(newVol === 0);
                    }
                    resetIdleTimer();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (videoRef.current) {
                        const newVol = Math.max(0, videoRef.current.volume - 0.1);
                        videoRef.current.volume = newVol;
                        setVolume(newVol);
                        setIsMuted(newVol === 0);
                    }
                    resetIdleTimer();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isWindowFullscreen]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, []);

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(() => { });
        }
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const toggleWindowFullscreen = () => {
        if (isWindowFullscreen) {
            WindowUnfullscreen();
            setIsWindowFullscreen(false);
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        } else {
            WindowFullscreen();
            setIsWindowFullscreen(true);
            if (!document.fullscreenElement && containerRef.current) {
                containerRef.current.requestFullscreen().catch(err => {
                    console.error("Fullscreen error:", err);
                });
            }
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            setDuration(videoRef.current.duration);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current) {
            const vol = parseFloat(e.target.value);
            videoRef.current.volume = vol;
            setVolume(vol);
            setIsMuted(vol === 0);
        }
    };

    const changeLevel = (levelIndex: number) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelIndex;
            setCurrentLevel(levelIndex);
            setShowQualityMenu(false);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "00:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const isAnyFullscreen = isFullscreen || isWindowFullscreen;

    return (
        <div
            ref={containerRef}
            className={`flex flex-col h-full bg-black select-none relative overflow-hidden`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => {
                setIsHovering(false);
                if (isAnyFullscreen) setShowControls(false);
            }}
            onMouseMove={resetIdleTimer}
        >
            <div className={`flex-1 bg-black relative overflow-hidden`}>
                <video
                    ref={videoRef}
                    className="w-full h-full object-contain cursor-none"
                    style={{ cursor: showControls ? 'default' : 'none' }}
                    onTimeUpdate={handleTimeUpdate}
                    onProgress={handleProgress}
                    onPlay={() => {
                        setIsPlaying(true);
                        setIsLoading(false);
                        setProxyLogs([]); // Clear logs when playing
                    }}
                    onWaiting={() => setIsLoading(true)}
                    onCanPlay={() => setIsLoading(false)}
                    onPause={() => setIsPlaying(false)}
                    onClick={() => setShowControls(!showControls)}
                />

                {/* Loading / Log Overlay - Scoped to video area */}
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 pointer-events-none z-40">
                        <div className="w-10 h-10 border-4 border-t-white border-white/20 rounded-full animate-spin mb-4"></div>
                        <div className="absolute bottom-6 left-6 max-w-[80%] text-left">
                            {proxyLogs.length > 0 && (
                                <div className="inline-block bg-black/60 backdrop-blur-md border border-white/10 px-3 pb-1 rounded-md shadow-lg transition-all duration-200">
                                    <span className="font-mono text-[11px] text-white/90">
                                        {proxyLogs[0]}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Container */}
            <div className={`
                flex flex-col px-2 pb-2 transition-transform duration-300
                ${isAnyFullscreen
                    ? `absolute bottom-0 left-0 right-0 z-50 bg-[#F0F0F0]/90 backdrop-blur-sm border-t border-[#D0D0D0] ${showControls ? 'translate-y-0' : 'translate-y-full'}`
                    : 'bg-[#F0F0F0] border-t border-[#D0D0D0] h-[72px] relative'
                }
            `}>
                {/* Progress Section */}
                <div className="flex items-center gap-2 pt-1 opacity-100 h-8">
                    <span className="text-xs font-mono text-gray-700 w-10 text-right">{formatTime(currentTime)}</span>
                    <div className="flex-1 mx-2 h-full flex items-center">
                        <ProgressBar
                            currentTime={currentTime}
                            duration={duration}
                            buffered={buffered}
                            streamUrl={stream.url}
                            isHls={stream.isHls}
                            isDownloaded={stream.isDownloaded}
                            onSeek={(time) => {
                                if (videoRef.current) {
                                    videoRef.current.currentTime = time;
                                    setCurrentTime(time);
                                }
                            }}
                        />
                    </div>
                    <span className="text-xs font-mono text-gray-700 w-10">{formatTime(duration)}</span>
                </div>

                {/* Buttons Section */}
                <div className="flex items-center justify-between h-8">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onPrev}
                            disabled={!hasPrev}
                            className="p-1.5 hover:bg-[#D0D0D0] rounded border border-transparent active:border-[#A0A0A0] active:bg-[#C0C0C0] disabled:opacity-30 disabled:hover:bg-transparent text-gray-800"
                            title="Previous Episode"
                        >
                            <SkipBack size={18} fill={hasPrev ? "currentColor" : "none"} />
                        </button>
                        <button
                            onClick={togglePlay}
                            className="p-1.5 hover:bg-[#D0D0D0] rounded border border-transparent active:border-[#A0A0A0] active:bg-[#C0C0C0] text-gray-800"
                        >
                            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </button>
                        <button
                            onClick={onNext}
                            disabled={!hasNext}
                            className="p-1.5 hover:bg-[#D0D0D0] rounded border border-transparent active:border-[#A0A0A0] active:bg-[#C0C0C0] disabled:opacity-30 disabled:hover:bg-transparent text-gray-800"
                            title="Next Episode"
                        >
                            <SkipForward size={18} fill={hasNext ? "currentColor" : "none"} />
                        </button>
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-[#D0D0D0] rounded border border-transparent active:border-[#A0A0A0] active:bg-[#C0C0C0] text-gray-800"
                            title="Stop"
                        >
                            <Square size={16} fill="currentColor" />
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">
                        <span className="text-xs font-medium text-gray-700 truncate select-text">
                            {episodeTitle}
                        </span>
                        {stream.isDownloaded && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded border border-green-200 mt-0.5 tracking-wider">
                                PLAYING FROM DOWNLOAD
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 sm:gap-6 text-gray-800">
                        <div className="flex items-center gap-2 w-28 sm:w-40 shrink-0">
                            <button onClick={toggleMute} className="p-1 hover:bg-[#D0D0D0] rounded">
                                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="flex-1 h-1.5 bg-[#B0B0B0] appearance-none rounded-sm [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#808080] cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            {/* Quality Selector */}
                            {levels.length > 0 && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                                        className="p-1.5 hover:bg-[#D0D0D0] rounded border border-transparent active:border-[#A0A0A0] active:bg-[#C0C0C0]"
                                        title="Quality"
                                    >
                                        <Settings size={18} fill="currentColor" />
                                    </button>
                                    {showQualityMenu && (
                                        <div className="absolute bottom-full mb-2 right-0 bg-[#F0F0F0] border border-[#D0D0D0] rounded shadow-lg py-1 w-32 z-50">
                                            <button
                                                onClick={() => changeLevel(-1)}
                                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#E0E0E0] flex items-center justify-between text-gray-800 ${currentLevel === -1 ? 'font-bold bg-[#E8E8E8]' : ''}`}
                                            >
                                                <span>Auto</span>
                                                {currentLevel === -1 && <Check size={12} />}
                                            </button>
                                            {levels.map((level) => {
                                                let label = "Unknown";
                                                if (level.height) label = `${level.height}p`;
                                                else if (level.name) label = level.name;
                                                else if (level.bitrate) label = `${Math.round(level.bitrate / 1000)}k`;

                                                // If we still have duplicates or just 0p, try to be more descriptive
                                                if (label === "0p") label = "Source";

                                                return (
                                                    <button
                                                        key={level.index}
                                                        onClick={() => changeLevel(level.index)}
                                                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#E0E0E0] flex items-center justify-between text-gray-800 ${currentLevel === level.index ? 'font-bold bg-[#E8E8E8]' : ''}`}
                                                    >
                                                        <span>{label}</span>
                                                        {currentLevel === level.index && <Check size={12} />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={toggleWindowFullscreen}
                                className={`p-1.5 hover:bg-[#D0D0D0] rounded border border-transparent active:border-[#A0A0A0] active:bg-[#C0C0C0] ${isWindowFullscreen ? 'bg-[#D0D0D0] shadow-inner' : ''}`}
                                title="Window Fullscreen"
                            >
                                <Monitor size={16} />
                            </button>
                            <button
                                onClick={toggleFullscreen}
                                className="p-1.5 hover:bg-[#D0D0D0] rounded border border-transparent active:border-[#A0A0A0] active:bg-[#C0C0C0]"
                                title="Player Fullscreen"
                            >
                                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
