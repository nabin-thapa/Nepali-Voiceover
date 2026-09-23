import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Repeat,
  Radio,
  Sparkles,
} from 'lucide-react';
import { GenerationResult } from '../types';

interface AudioPlayerProps {
  currentTake: GenerationResult | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTake,
  isPlaying,
  setIsPlaying,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // Sync audio source when currentTake changes
  useEffect(() => {
    if (!currentTake || !audioRef.current) return;
    const audio = audioRef.current;
    audio.src = currentTake.audioUrl;
    audio.playbackRate = playbackRate;
    audio.volume = isMuted ? 0 : volume;
    audio.loop = isLooping;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || currentTake.durationSeconds || 0);
      setCurrentTime(0);
      // Auto play on new take
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [currentTake?.id]);

  // Handle play/pause
  const togglePlay = () => {
    if (!audioRef.current || !currentTake) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.error(e));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      setIsMuted(false);
      audioRef.current.volume = volume || 1;
    } else {
      setIsMuted(true);
      audioRef.current.volume = 0;
    }
  };

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
  };

  const handleReplay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(() => setIsPlaying(true));
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Canvas visualizer animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numBars = 48;
    const barWidth = 3;
    const gap = 2;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const progress = duration > 0 ? currentTime / duration : 0;
      const activeBarCount = Math.floor(progress * numBars);

      for (let i = 0; i < numBars; i++) {
        // Pseudo frequency amplitude calculation with wave animation when playing
        const x = i * (barWidth + gap) + 8;
        const norm = i / numBars;
        let barHeight = 8 + Math.sin(norm * Math.PI) * 22;

        if (isPlaying) {
          const timeOffset = Date.now() * 0.006;
          const dynamicMod = Math.abs(Math.sin(timeOffset + i * 0.4) * Math.cos(timeOffset * 0.5 + i * 0.2));
          barHeight = 6 + dynamicMod * (height - 10);
        }

        const isPast = i <= activeBarCount;
        ctx.fillStyle = isPast
          ? isPlaying
            ? '#f59e0b' // warm studio amber
            : '#fbbf24'
          : '#334155'; // inactive slate

        const y = (height - barHeight) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, duration]);

  if (!currentTake) {
    return (
      <div
        id="audio-player-empty"
        className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 p-8 text-center text-zinc-500"
      >
        <Radio className="mx-auto mb-3 h-8 w-8 text-zinc-600 animate-pulse" />
        <p className="font-medium text-zinc-400">स्टुडियो प्लेब्याक तयार छैन (Studio Output Standby)</p>
        <p className="mt-1 text-xs text-zinc-500">
          माथि पाठ लेख्नुहोस् र &quot;Generate Voiceover&quot; थिच्नुहोस्।
        </p>
      </div>
    );
  }

  return (
    <div
      id="studio-audio-player"
      className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Header bar of the player */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100">
                {currentTake.voiceName} (नेपाली वाचक)
              </span>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/30">
                {currentTake.tone.toUpperCase()}
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                24kHz L16 WAV
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {currentTake.wordCount} शब्द • अनुमानित समय {formatTime(currentTake.durationSeconds)}
            </p>
          </div>
        </div>

        {/* Download WAV button */}
        <a
          id="btn-download-wav"
          href={currentTake.audioUrl}
          download={`nepali_voiceover_${currentTake.voiceName}_${Date.now()}.wav`}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 hover:text-white ring-1 ring-zinc-700/50"
          title="Download Studio WAV file"
        >
          <Download className="h-3.5 w-3.5 text-amber-400" />
          <span>WAV डाउनलोड (.wav)</span>
        </a>
      </div>

      {/* Waveform Canvas & Time indicators */}
      <div className="my-5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>काठमाडौँ मानक उच्चारण • 130–150 WPM</span>
          </div>
          <span>{formatTime(duration || currentTake.durationSeconds)}</span>
        </div>

        <div className="relative flex items-center justify-center rounded-xl bg-zinc-900/60 p-3 ring-1 ring-zinc-850">
          <canvas
            ref={canvasRef}
            width={480}
            height={46}
            className="w-full max-w-lg cursor-pointer"
            onClick={togglePlay}
          />
        </div>

        {/* Scrubber slider */}
        <input
          id="audio-scrubber"
          type="range"
          min={0}
          max={duration || currentTake.durationSeconds || 1}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek audio"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-amber-500"
        />
      </div>

      {/* Main Playback Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        {/* Left side: Speed toggles */}
        <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900 p-1 text-xs">
          {[0.8, 1.0, 1.25, 1.5].map((rate) => (
            <button
              key={rate}
              id={`btn-speed-${rate}`}
              onClick={() => handleRateChange(rate)}
              className={`rounded px-2.5 py-1 font-medium transition ${
                playbackRate === rate
                  ? 'bg-amber-500 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Center: Play / Pause / Replay controls */}
        <div className="flex items-center gap-3">
          <button
            id="btn-replay"
            onClick={handleReplay}
            className="rounded-full p-2.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
            title="Replay from start"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            id="btn-main-play-pause"
            onClick={togglePlay}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-400 hover:scale-105 active:scale-95"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6 fill-current" />
            ) : (
              <Play className="h-6 w-6 fill-current ml-0.5" />
            )}
          </button>

          <button
            id="btn-loop-toggle"
            onClick={toggleLoop}
            className={`rounded-full p-2.5 transition ${
              isLooping
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
            title="Loop audio"
          >
            <Repeat className="h-4 w-4" />
          </button>
        </div>

        {/* Right side: Volume control */}
        <div className="flex items-center gap-2">
          <button
            id="btn-mute-toggle"
            onClick={toggleMute}
            className="text-zinc-400 hover:text-zinc-200"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <input
            id="audio-volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Audio Volume"
            className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-amber-500"
          />
        </div>
      </div>
    </div>
  );
};
