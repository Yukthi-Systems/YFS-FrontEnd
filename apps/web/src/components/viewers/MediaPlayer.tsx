/*
 * Copyright (C) 2026 Yukthi Systems Private Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * version 3 along with this program. If not, see
 * <https://www.gnu.org/licenses/>.
 */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Video,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useStreamUrl } from "../../hooks/useDownload";
import { useIsMobile } from "../../hooks/useIsMobile";
import type { FileItem } from "../../types/file";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function MediaPlayer({
  item,
  size = "compact",
  isMinimized = false,
  onPiPChange,
  onRestoreModal,
}: {
  item: FileItem;
  size?: "compact" | "full";
  isMinimized?: boolean;
  onPiPChange?: (isPiP: boolean) => void;
  onRestoreModal?: () => void;
}) {
  const isFull = size === "full";
  const { data: streamUrl, isLoading, error: queryError } = useStreamUrl(item);

  if (item.type === "video") {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-main">
          <Loader2 className="w-9 h-9 animate-spin text-accent" />
          <div className="text-xs font-medium tracking-wide">Connecting to video stream…</div>
        </div>
      );
    }

    if (queryError) {
      return (
        <div className="flex flex-col items-center gap-2.5 text-center text-text-main py-12">
          <AlertCircle className="w-10 h-10 text-rose-400" />
          <div className="text-xs font-semibold text-rose-500">
            {queryError instanceof Error ? queryError.message : "Failed to load video stream"}
          </div>
          <div className="text-[11px] text-text-main/70">The storage server may be temporarily unreachable.</div>
        </div>
      );
    }

    if (streamUrl) {
      return isFull ? (
        <FullVideoPlayer
          streamUrl={streamUrl}
          item={item}
          isMinimized={isMinimized}
          onPiPChange={onPiPChange}
          onRestoreModal={onRestoreModal}
        />
      ) : (
        <CompactVideoPlayer streamUrl={streamUrl} item={item} />
      );
    }

    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-main py-8">
        <Video className="w-12 h-12 text-rose-400" />
        <div className="text-xs font-medium">Seeded demo item — no video content to play.</div>
      </div>
    );
  }

  return (
    <AudioPlayer
      streamUrl={streamUrl}
      isLoading={isLoading}
      error={queryError}
      item={item}
      isFull={isFull}
    />
  );
}

// Video player with buffering, speed, PiP and keyboard shortcuts.
function FullVideoPlayer({
  streamUrl,
  item,
  isMinimized = false,
  onPiPChange,
  onRestoreModal,
}: {
  streamUrl: string;
  item: FileItem;
  isMinimized?: boolean;
  onPiPChange?: (isPiP: boolean) => void;
  onRestoreModal?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const isMobile = useIsMobile();
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [flashFeedback, setFlashFeedback] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => {
      setIsPiP(true);
      onPiPChange?.(true);
    };

    const handleLeavePiP = () => {
      setIsPiP(false);
      onPiPChange?.(false);
      onRestoreModal?.();
    };

    video.addEventListener("enterpictureinpicture", handleEnterPiP);
    video.addEventListener("leavepictureinpicture", handleLeavePiP);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPiP);
      video.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, [onPiPChange, onRestoreModal]);

  const showFlash = (text: string) => {
    setFlashFeedback(text);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlashFeedback(null), 800);
  };

  // Touch: a tap on the video toggles the controls (like native players) instead of pausing.
  const handleVideoTap = () => {
    if (showControls && isPlaying) {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      setShowControls(false);
    } else handleMouseMove();
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (isPlaying) {
      hideTimeoutRef.current = setTimeout(() => setShowControls(false), 2500);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
      showFlash("Play");
    } else {
      video.pause();
      setIsPlaying(false);
      showFlash("Pause");
    }
  };

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    video.currentTime = target;
    showFlash(seconds > 0 ? `+${seconds}s` : `${seconds}s`);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    showFlash(nextMuted ? "Muted" : `${Math.round(volume * 100)}%`);
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    showFlash(`${speed}x`);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["input", "textarea", "select"].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
      } else if (e.key === "ArrowLeft" || e.key === "j") {
        e.preventDefault();
        e.stopPropagation();
        seek(-10);
      } else if (e.key === "ArrowRight" || e.key === "l") {
        e.preventDefault();
        e.stopPropagation();
        seek(10);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        handleVolumeChange(volume + 0.1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        handleVolumeChange(volume - 0.1);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        e.stopPropagation();
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        e.stopPropagation();
        toggleFullscreen();
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        e.stopPropagation();
        togglePiP();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("keydown", handleKeyDown);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      if (container) container.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [volume, isPlaying]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const updateProgress = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (video.duration) setDuration(video.duration);

    if (video.duration && video.buffered.length > 0) {
      try {
        for (let i = video.buffered.length - 1; i >= 0; i--) {
          if (video.buffered.start(i) <= video.currentTime) {
            setBufferedPct(Math.min(100, (video.buffered.end(i) / video.duration) * 100));
            break;
          }
        }
      } catch {
        // Ignored
      }
    }
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    const video = videoRef.current;
    if (!bar || !video || !video.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
  };

  const handleScrubberMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    const video = videoRef.current;
    if (!bar || !video || !video.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * video.duration);
    setHoverX(e.clientX - rect.left);
  };

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full h-full flex items-center justify-center bg-black rounded-2xl max-[768px]:rounded-none overflow-hidden select-none outline-none group"
      aria-label={`Video player for ${item.name}`}
    >
      <video
        ref={videoRef}
        src={streamUrl}
        autoPlay
        playsInline
        onTimeUpdate={updateProgress}
        onProgress={updateProgress}
        onLoadedMetadata={updateProgress}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onError={() => setPlaybackError("Failed to stream video. Media server unavailable or format not supported.")}
        onClick={isMobile ? handleVideoTap : togglePlay}
        onDoubleClick={toggleFullscreen}
        className="w-full h-full max-h-[75vh] max-[768px]:max-h-full object-contain cursor-pointer"
      />

      {playbackError && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 p-6 text-center text-white z-30">
          <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
          <div className="text-sm font-semibold">{playbackError}</div>
          <button
            onClick={() => {
              setPlaybackError(null);
              videoRef.current?.load();
              videoRef.current?.play().catch(() => {});
            }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
          >
            Retry Streaming
          </button>
        </div>
      )}

      {isBuffering && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="p-4 bg-black/60 backdrop-blur-md rounded-full shadow-2xl">
            <Loader2 className="w-10 h-10 animate-spin text-white" />
          </div>
        </div>
      )}

      {flashFeedback && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/70 backdrop-blur-md text-white font-semibold text-xs rounded-full pointer-events-none shadow-lg z-20 animate-fade-in">
          {flashFeedback}
        </div>
      )}

      {isMinimized && isPiP && (
        <div
          onClick={() => {
            onRestoreModal?.();
            if (document.pictureInPictureElement) {
              document.exitPictureInPicture().catch(() => {});
            }
          }}
          className="absolute inset-0 bg-neutral-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white p-3 text-center cursor-pointer z-15 group"
          title="Click to expand to full screen"
        >
          <PictureInPicture2 className="w-8 h-8 text-accent animate-pulse" />
          <div className="text-xs font-semibold">Playing in Picture-in-Picture</div>
          <div className="text-[10px] text-neutral-400 group-hover:text-white transition">
            Click to return to full screen
          </div>
        </div>
      )}

      {isMinimized && !isPiP && (
        <div
          onClick={() => onRestoreModal?.()}
          className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center z-15 cursor-pointer"
          title="Click to expand to full screen"
        >
          <div className="p-2.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
            <Maximize2 className="w-5 h-5" />
          </div>
        </div>
      )}

      {!isMinimized && !isPlaying && !isBuffering && !playbackError && (
        <button
          onClick={togglePlay}
          className="absolute p-5 rounded-full bg-accent/90 hover:bg-accent text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform cursor-pointer border-none z-10"
          aria-label="Play video"
        >
          <Play className="w-8 h-8 fill-white ml-0.5" />
        </button>
      )}

      {!isMinimized && (
        <div
          className={`absolute bottom-3 left-3 right-3 bg-neutral-950/80 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col gap-2 text-white shadow-2xl transition-all duration-300 z-20 max-[768px]:inset-x-0 max-[768px]:bottom-0 max-[768px]:rounded-none max-[768px]:border-x-0 max-[768px]:border-b-0 max-[768px]:pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
            showControls || !isPlaying ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
        <div
          ref={progressRef}
          onClick={handleScrubberClick}
          onMouseMove={handleScrubberMove}
          onMouseLeave={() => setHoverTime(null)}
          className="relative w-full h-2 hover:h-3 bg-white/20 rounded-full cursor-pointer transition-all flex items-center group/scrubber"
          role="slider"
          aria-label="Video scrubber"
          aria-valuemin={0}
          aria-valuemax={duration || 100}
          aria-valuenow={currentTime}
        >
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/35 rounded-full transition-all duration-150"
            style={{ width: `${bufferedPct}%` }}
          />
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-accent to-purple-500 rounded-full"
            style={{ width: `${playedPct}%` }}
          />
          <div
            className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-md -translate-x-1/2 scale-0 group-hover/scrubber:scale-100 transition-transform"
            style={{ left: `${playedPct}%` }}
          />
          {hoverTime !== null && (
            <div
              className="absolute -top-7 px-2 py-0.5 bg-black/90 text-[10px] font-mono rounded text-white shadow pointer-events-none -translate-x-1/2"
              style={{ left: `${hoverX}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition border-none bg-transparent cursor-pointer"
              aria-label={isPlaying ? "Pause (Space)" : "Play (Space)"}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            <button
              onClick={() => seek(-10)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition border-none bg-transparent cursor-pointer"
              aria-label="Rewind 10 seconds (Left Arrow)"
              title="Rewind 10s (Left Arrow)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => seek(10)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition border-none bg-transparent cursor-pointer"
              aria-label="Forward 10 seconds (Right Arrow)"
              title="Forward 10s (Right Arrow)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white transition border-none bg-transparent cursor-pointer"
                aria-label={isMuted ? "Unmute (M)" : "Mute (M)"}
                title={isMuted ? "Unmute (M)" : "Mute (M)"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent transition-all max-[768px]:hidden"
                aria-label="Volume slider"
              />
            </div>

            <span className="text-xs font-mono text-neutral-300 ml-1">
              {formatTime(currentTime)} <span className="text-neutral-500">/</span> {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 relative">
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2 py-1 hover:bg-white/10 rounded-lg text-xs font-mono font-semibold transition border border-white/15 bg-white/5 cursor-pointer text-neutral-200"
                aria-label="Playback speed"
                title="Playback speed"
              >
                {playbackSpeed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-9 right-0 bg-neutral-900 border border-white/15 rounded-xl shadow-2xl p-1 flex flex-col gap-1 min-w-[70px] z-30">
                  {PLAYBACK_SPEEDS.map((spd) => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-2 py-1 text-xs font-mono rounded-lg transition text-left cursor-pointer border-none ${
                        playbackSpeed === spd
                          ? "bg-accent text-white font-bold"
                          : "bg-transparent text-neutral-300 hover:bg-white/10"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {typeof document !== "undefined" && "pictureInPictureEnabled" in document && (
              <button
                onClick={togglePiP}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white transition border-none bg-transparent cursor-pointer"
                aria-label="Picture in Picture (P)"
                title="Picture in Picture (P)"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white transition border-none bg-transparent cursor-pointer"
              aria-label={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
              title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// Compact video player for DetailsDrawer.
function CompactVideoPlayer({ streamUrl, item }: { streamUrl: string; item: FileItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <div
      className="relative w-full max-h-[160px] rounded-lg overflow-hidden bg-black group flex items-center justify-center"
      aria-label={`Preview of ${item.name}`}
      title={item.name}
    >
      <video
        ref={videoRef}
        src={streamUrl}
        muted={isMuted}
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full h-full max-h-[160px] object-cover"
      />
      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-2">
        <button
          onClick={togglePlay}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white border-none cursor-pointer transition backdrop-blur-sm"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
        </button>
        <button
          onClick={toggleMute}
          className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white border-none cursor-pointer transition backdrop-blur-sm"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// Audio player with a waveform animation.
function AudioPlayer({
  streamUrl,
  isLoading,
  error,
  item,
  isFull,
}: {
  streamUrl: string | null | undefined;
  isLoading: boolean;
  error: unknown;
  item: FileItem;
  isFull: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  const handleVolumeChange = (newVol: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = newVol;
    audio.muted = newVol === 0;
    setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    if (audioRef.current) audioRef.current.playbackRate = next;
    setPlaybackSpeed(next);
  };

  const updateProgress = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (audio.duration) setDuration(audio.duration);
    if (audio.duration && audio.buffered.length > 0) {
      try {
        for (let i = audio.buffered.length - 1; i >= 0; i--) {
          if (audio.buffered.start(i) <= audio.currentTime) {
            setBufferedPct(Math.min(100, (audio.buffered.end(i) / audio.duration) * 100));
            break;
          }
        }
      } catch {
        // Ignored
      }
    }
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
  };

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-text-main">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <div className="text-xs">Connecting to audio stream…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 text-rose-500 py-8 text-center">
        <AlertCircle className="w-8 h-8" />
        <div className="text-xs font-semibold">Failed to stream audio file</div>
      </div>
    );
  }

  if (!streamUrl) {
    return <div className="text-xs text-text-main text-center py-6">Seeded demo item — no audio content to play.</div>;
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full px-4 py-6 bg-code-bg/40 border border-border-main rounded-2xl">
      <audio
        ref={audioRef}
        src={streamUrl}
        autoPlay={isFull}
        onTimeUpdate={updateProgress}
        onProgress={updateProgress}
        onLoadedMetadata={updateProgress}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="flex items-center gap-1.5 h-12" aria-hidden="true">
        {[
          "animate-[audioWave_1.2s_ease-in-out_infinite_alternate]",
          "animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.2s]",
          "animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.4s]",
          "animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.1s]",
          "animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.3s]",
          "animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.5s]",
          "animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.25s]",
          "animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.15s]",
        ].map((animClass, idx) => (
          <div
            key={idx}
            className={`w-1.5 rounded-full transition-all duration-300 ${
              isPlaying
                ? `bg-accent ${animClass} h-8`
                : "bg-border-main h-2"
            }`}
          />
        ))}
      </div>

      <div className="text-center">
        <div className="text-sm font-semibold text-text-heading truncate max-w-xs">{item.name}</div>
        <div className="text-[11px] text-text-main font-mono mt-0.5">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <div
        onClick={handleScrubberClick}
        className="relative w-full max-w-md h-2 bg-border-main rounded-full cursor-pointer overflow-hidden"
        role="slider"
        aria-label="Audio scrubber"
        aria-valuemin={0}
        aria-valuemax={duration || 100}
        aria-valuenow={currentTime}
      >
        <div
          className="absolute left-0 top-0 bottom-0 bg-accent/20 transition-all duration-150"
          style={{ width: `${bufferedPct}%` }}
        />
        <div
          className="absolute left-0 top-0 bottom-0 bg-accent rounded-full"
          style={{ width: `${playedPct}%` }}
        />
      </div>

      <div className="flex items-center justify-center gap-4 text-text-main">
        <button
          onClick={() => seek(-10)}
          className="p-2 rounded-full hover:bg-border-main/50 text-text-main border-none bg-transparent cursor-pointer transition"
          aria-label="Rewind 10s"
          title="Rewind 10s"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          className="p-3 rounded-full bg-accent hover:bg-accent/90 text-white shadow-md border-none cursor-pointer hover:scale-105 active:scale-95 transition"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
        </button>

        <button
          onClick={() => seek(10)}
          className="p-2 rounded-full hover:bg-border-main/50 text-text-main border-none bg-transparent cursor-pointer transition"
          aria-label="Forward 10s"
          title="Forward 10s"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          onClick={cycleSpeed}
          className="px-2 py-1 text-xs font-mono font-semibold rounded-md border border-border-main hover:bg-border-main/40 text-text-heading cursor-pointer transition"
          aria-label="Cycle speed"
          title="Playback speed"
        >
          {playbackSpeed}x
        </button>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-md hover:bg-border-main/50 text-text-main border-none bg-transparent cursor-pointer transition"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1 bg-border-main rounded-lg appearance-none cursor-pointer accent-accent"
            aria-label="Audio volume"
          />
        </div>
      </div>
    </div>
  );
}
