import React from 'react';
import { Sparkles, Cpu, BookOpen, MessageSquare, Languages } from 'lucide-react';
import { SCRIPT_SAMPLES } from '../data/samples';
import { ScriptSample } from '../types';

interface PresetSelectorProps {
  onSelectPreset: (sample: ScriptSample) => void;
  selectedSampleId?: string;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  onSelectPreset,
  selectedSampleId,
}) => {
  const getIcon = (category: string) => {
    switch (category) {
      case 'Informational / Tech / AI':
        return <Cpu className="h-3.5 w-3.5 text-amber-400" />;
      case 'Storytelling / Motivation':
        return <BookOpen className="h-3.5 w-3.5 text-rose-400" />;
      case 'Conversational / Social Media':
        return <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />;
      default:
        return <Languages className="h-3.5 w-3.5 text-sky-400" />;
    }
  };

  return (
    <div id="script-preset-selector" className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>नमुना नेपाली स्क्रिप्टहरू (Ready Studio Presets)</span>
        </span>
        <span className="text-[11px] text-zinc-500">१-क्लिकमा लोड गर्नुहोस्</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {SCRIPT_SAMPLES.map((sample) => {
          const isSelected = selectedSampleId === sample.id;
          return (
            <button
              key={sample.id}
              id={`preset-btn-${sample.id}`}
              onClick={() => onSelectPreset(sample)}
              className={`flex flex-col text-left p-3 rounded-xl border transition group ${
                isSelected
                  ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20'
                  : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1 rounded-md bg-zinc-800/80 group-hover:scale-105 transition">
                  {getIcon(sample.category)}
                </div>
                <span className="text-xs font-semibold text-zinc-200 line-clamp-1">
                  {sample.nepaliTitle}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                {sample.text}
              </p>
              <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                <span>{sample.recommendedVoice} (अनुशंसित)</span>
                <span className="capitalize">{sample.tone}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
