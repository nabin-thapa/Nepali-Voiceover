import React from 'react';
import { History, Play, Download, Trash2, Clock } from 'lucide-react';
import { GenerationResult } from '../types';

interface TakesHistoryProps {
  takes: GenerationResult[];
  activeTakeId?: string;
  onSelectTake: (take: GenerationResult) => void;
  onClearTakes: () => void;
}

export const TakesHistory: React.FC<TakesHistoryProps> = ({
  takes,
  activeTakeId,
  onSelectTake,
  onClearTakes,
}) => {
  if (takes.length === 0) return null;

  return (
    <div
      id="studio-takes-history"
      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-4"
    >
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-200">
            रेकर्डिङ सत्र इतिहास (Takes History)
          </h3>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
            {takes.length}
          </span>
        </div>

        <button
          id="btn-clear-takes"
          onClick={onClearTakes}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 transition"
          title="Clear all takes"
        >
          <Trash2 className="h-3 w-3" />
          <span>सबै मेटाउनुहोस्</span>
        </button>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {takes.map((take) => {
          const isActive = activeTakeId === take.id;
          return (
            <div
              key={take.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition ${
                isActive
                  ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20'
                  : 'border-zinc-850 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-750'
              }`}
            >
              <div
                className="flex-1 cursor-pointer pr-3"
                onClick={() => onSelectTake(take)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-zinc-200">
                    {take.voiceName}
                  </span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] uppercase font-mono text-zinc-400">
                    {take.tone}
                  </span>
                  {take.wasConvertedFromRomanized && (
                    <span className="rounded bg-sky-500/10 px-1.5 py-0.2 text-[10px] text-sky-400">
                      रोमन रूपान्तरित
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1 font-mono">
                    <Clock className="h-2.5 w-2.5" />
                    {take.durationSeconds}s
                  </span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-1">
                  {take.devanagariText}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id={`btn-play-take-${take.id}`}
                  onClick={() => onSelectTake(take)}
                  className={`p-2 rounded-lg transition ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 font-bold'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                  title="Play this take"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                </button>
                <a
                  id={`btn-download-take-${take.id}`}
                  href={take.audioUrl}
                  download={`nepali_voiceover_${take.voiceName}_${take.id}.wav`}
                  className="p-2 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition"
                  title="Download WAV"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
