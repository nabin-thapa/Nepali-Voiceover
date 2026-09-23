import React from 'react';
import {
  FileText,
  Volume2,
  Clock,
  Compass,
  CheckCircle2,
  Flame,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { GenerationResult } from '../types';

interface DirectorNotesProps {
  result: GenerationResult;
}

export const DirectorNotes: React.FC<DirectorNotesProps> = ({ result }) => {
  const {
    devanagariText,
    originalText,
    wasConvertedFromRomanized,
    tone,
    toneDescription,
    directorNotes,
    phonetics,
    durationSeconds,
    wordCount,
  } = result;

  // Function to highlight aspirated and retroflex consonants in the Devanagari script
  const renderHighlightedScript = (text: string) => {
    const chars = Array.from(text);
    const aspiratedSet = new Set(phonetics.aspirated || []);
    const retroflexSet = new Set(phonetics.retroflex || []);

    return (
      <span className="leading-relaxed font-devanagari text-zinc-200">
        {chars.map((char, index) => {
          if (aspiratedSet.has(char)) {
            return (
              <mark
                key={index}
                className="bg-amber-500/20 text-amber-300 rounded px-0.5 font-semibold"
                title={`महाप्राण वर्ण (Aspirated): '${char}'`}
              >
                {char}
              </mark>
            );
          }
          if (retroflexSet.has(char)) {
            return (
              <mark
                key={index}
                className="bg-sky-500/20 text-sky-300 rounded px-0.5 font-semibold"
                title={`मूर्धन्य वर्ण (Retroflex): '${char}'`}
              >
                {char}
              </mark>
            );
          }
          return char;
        })}
      </span>
    );
  };

  return (
    <div
      id="director-cue-sheet"
      className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-6"
    >
      {/* Top Banner: Director Overview */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-amber-400 ring-1 ring-zinc-800">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              भ्वाइसओभर निर्देशक प्रतिवेदन (Director&apos;s Cue Sheet)
            </h3>
            <p className="text-xs text-zinc-500">
              मानक काठमाडौँ उच्चारण र ध्वन्यात्मक विश्लेषण (Kathmandu Standard Articulation)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>काठमाडौँ मानक उच्चारण</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-mono text-zinc-400 ring-1 ring-zinc-800">
            <Clock className="h-3.5 w-3.5 text-zinc-500" />
            <span>130–150 WPM</span>
          </span>
        </div>
      </div>

      {/* Script Handling Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-amber-400" />
            <span>अभिनय गरिएको शुद्ध देवनागरी पाठ (Master Devanagari Script)</span>
          </span>
          {wasConvertedFromRomanized && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/30">
              <span>रोमन लिपिबाट स्वचालित रूपान्तरित</span>
            </span>
          )}
        </div>

        {/* Script Box */}
        <div className="rounded-xl bg-zinc-900/60 p-4 border border-zinc-850 text-base">
          {renderHighlightedScript(devanagariText)}
        </div>

        {/* If converted from Romanized, show comparison preview */}
        {wasConvertedFromRomanized && (
          <div className="rounded-lg bg-zinc-900/40 p-3 border border-zinc-900 text-xs space-y-1">
            <span className="text-zinc-500 flex items-center gap-1 font-mono">
              <span>मूल इनपुट (Romanized Input):</span>
              <ArrowRight className="h-3 w-3 text-zinc-600" />
            </span>
            <p className="text-zinc-400 italic font-mono pl-1">{originalText}</p>
          </div>
        )}
      </div>

      {/* Grid of Director Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tone & Modulation */}
        <div className="rounded-xl border border-zinc-850 bg-zinc-900/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
            <Volume2 className="h-4 w-4" />
            <span>स्वर अनुकूलन (Tone & Delivery)</span>
          </div>
          <div className="text-sm font-medium text-zinc-200 capitalize">
            {tone === 'informational'
              ? 'Informational / Tech / AI'
              : tone === 'storytelling'
              ? 'Storytelling / Motivation'
              : 'Conversational / Social Media'}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {toneDescription || 'स्पष्ट, आत्मविश्वासी र सन्तुलित मानवीय भाव संयोजन।'}
          </p>
        </div>

        {/* Phonetics & Articulation */}
        <div className="rounded-xl border border-zinc-850 bg-zinc-900/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
            <Flame className="h-4 w-4" />
            <span>ध्वन्यात्मक स्पष्टता (Phonetic Articulation)</span>
          </div>
          <div className="text-xs text-zinc-300 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">महाप्राण (Aspirated):</span>
              <span className="font-mono font-bold text-amber-400">
                {phonetics.aspirated?.length ? phonetics.aspirated.join(', ') : 'ख, घ, छ...'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">मूर्धन्य (Retroflex):</span>
              <span className="font-mono font-bold text-sky-400">
                {phonetics.retroflex?.length ? phonetics.retroflex.join(', ') : 'ट, ठ, ड...'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">
            काठमाडौँ मानक उच्चारण अनुसार स्पष्ट र स्वाभाविक प्रस्फुटन।
          </p>
        </div>

        {/* Rhythm & Pacing */}
        <div className="rounded-xl border border-zinc-850 bg-zinc-900/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <Layers className="h-4 w-4" />
            <span>लय र विश्राम (Rhythm & Breathing)</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-zinc-100">140</span>
            <span className="text-xs font-mono text-zinc-400">WPM मानक गति</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            अल्पविराम (,) र पूर्णविराम (।) मा स्वभाविक मानवीय श्वास-विश्राम।
          </p>
        </div>
      </div>

      {/* Director Performance Notes */}
      {directorNotes && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 mb-1">
            <Compass className="h-3.5 w-3.5 text-amber-400" />
            <span>निर्देशकको अभिनय टिप्पणी (Director&apos;s Performance Notes)</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            {directorNotes}
          </p>
        </div>
      )}
    </div>
  );
};
