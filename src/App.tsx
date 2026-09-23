import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Mic,
  Sparkles,
  ChevronDown,
  Download,
  Play,
  Pause,
  Loader2,
  AlertCircle,
  Clock,
  Trash2,
  Volume2,
  Square,
} from 'lucide-react';
import { ToneCategory, GenerationResult, ScriptSample } from './types';
import { VOICE_ARTISTS, SCRIPT_SAMPLES } from './data/samples';

// ── Helpers ────────────────────────────────────────────────────────────────

function isRomanizedText(text: string): boolean {
  const latinMatches = text.match(/[a-zA-Z]/g);
  const devanagariMatches = text.match(/[\u0900-\u097F]/g);
  const latinCount = latinMatches ? latinMatches.length : 0;
  const devanagariCount = devanagariMatches ? devanagariMatches.length : 0;
  return latinCount > 0 && latinCount >= devanagariCount * 0.4;
}

const DURATION_OPTIONS = [
  { label: '15 sec', value: 15 },
  { label: '30 sec', value: 30 },
  { label: '60 sec', value: 60 },
  { label: '2 min', value: 120 },
];

const STYLE_PRESETS = [
  { id: 'news-anchor', label: '📰 News Anchor', tone: 'informational' as ToneCategory, voice: 'Charon' },
  { id: 'calm-meditative', label: '🧘 Calm & Meditative', tone: 'storytelling' as ToneCategory, voice: 'Aoede' },
  { id: 'energetic-reels', label: '⚡ Energetic Reels', tone: 'conversational' as ToneCategory, voice: 'Puck' },
  { id: 'corporate-pro', label: '💼 Corporate Pro', tone: 'informational' as ToneCategory, voice: 'Kore' },
];

// ── Compact Audio Player ───────────────────────────────────────────────────

function MiniPlayer({ take }: { take: GenerationResult }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(take.durationSeconds || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = take.audioUrl;
    const onMeta = () => setDuration(audio.duration || take.durationSeconds);
    audio.addEventListener('loadedmetadata', onMeta);
    return () => audio.removeEventListener('loadedmetadata', onMeta);
  }, [take.id]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play().then(() => setIsPlaying(true)).catch(() => {}); }
  };

  const fmt = (s: number) => {
    if (isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mt-2">
      <audio ref={audioRef}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onEnded={() => setIsPlaying(false)} />
      <div className="flex items-center gap-2">
        <button onClick={toggle}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4f6ef7] text-white shrink-0 hover:bg-[#3d5ce5] transition">
          {isPlaying ? <Pause className="h-3.5 w-3.5 fill-white" /> : <Play className="h-3.5 w-3.5 fill-white ml-0.5" />}
        </button>
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#4f6ef7] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[10px] text-gray-400 font-mono shrink-0">{fmt(currentTime)} / {fmt(duration)}</span>
      </div>
    </div>
  );
}

// ── Sample quotes for browser TTS preview ─────────────────────────────────
// These were removed in favor of dynamic preview from server

// Voice personality → pitch/rate adjustments for browser TTS
// These were removed in favor of dynamic preview from server

// ── Voice Preview Button — Google Translate TTS via server proxy ───────────
// Genuine Nepali voice, free & unlimited. No Gemini quota used.

const previewCache = new Map<string, string>(); // voiceId → cached data URL

function VoicePreviewButton({ voiceId, voiceName }: { voiceId: string; voiceName: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [progress, setProgress] = useState(0);

  const playUrl = (url: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.addEventListener('timeupdate', () => {
      if (audio.duration > 0) setProgress((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener('ended', () => { setStatus('idle'); setProgress(0); });
    audio.addEventListener('pause',  () => setStatus('idle'));
    audio.play().then(() => setStatus('playing')).catch(() => setStatus('idle'));
  };

  const handlePreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'loading') return;

    if (status === 'playing' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setStatus('idle'); setProgress(0);
      return;
    }

    const cached = previewCache.get(voiceId);
    if (cached) { playUrl(cached); return; }

    setStatus('loading');
    try {
      const resp = await fetch('/api/tts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceName: voiceId }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.audioUrl) throw new Error(data.error || 'failed');
      previewCache.set(voiceId, data.audioUrl);
      playUrl(data.audioUrl);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1" onClick={e => e.stopPropagation()}>
      <button
        id={`preview-btn-${voiceId}`}
        onClick={handlePreview}
        title={
          status === 'loading' ? 'Loading Nepali voice...' :
          status === 'playing' ? `Stop ${voiceName}` :
          status === 'error'   ? 'Failed — click to retry' :
          `Preview ${voiceName} in Nepali`
        }
        className={`flex items-center justify-center h-7 w-7 rounded-full border transition-all ${
          status === 'playing' ? 'bg-[#4f6ef7] border-[#4f6ef7] text-white shadow-md shadow-[#4f6ef7]/30' :
          status === 'loading' ? 'bg-amber-50 border-amber-200 text-amber-500 cursor-wait' :
          status === 'error'   ? 'bg-red-50 border-red-200 text-red-400' :
          'bg-gray-50 border-gray-200 text-gray-500 hover:bg-[#f0f3ff] hover:border-[#4f6ef7] hover:text-[#4f6ef7]'
        }`}
      >
        {status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
         status === 'playing' ? <Square className="h-3 w-3 fill-current" /> :
         status === 'error'   ? <span className="text-[9px] font-bold leading-none">!</span> :
         <Volume2 className="h-3.5 w-3.5" />}
      </button>
      {status === 'playing' && (
        <div className="w-7 h-0.5 bg-[#dde4ff] rounded-full overflow-hidden">
          <div className="h-full bg-[#4f6ef7] rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [inputText, setInputText] = useState<string>('');
  const [selectedTone, setSelectedTone] = useState<ToneCategory>('auto');
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');

  const [activePreset, setActivePreset] = useState<string | null>(null);

  // AI Script Generator
  const [scriptDesc, setScriptDesc] = useState('');
  const [scriptDuration, setScriptDuration] = useState(30);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);

  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Results
  const [takesHistory, setTakesHistory] = useState<GenerationResult[]>([]);

  // Load session history — auto-clear takes with old/unknown voice names
  useEffect(() => {
    try {
      const validVoiceIds = new Set(VOICE_ARTISTS.map(v => v.id));
      const saved = sessionStorage.getItem('nepali_tts_takes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out takes that used voices no longer available
          const filtered = parsed.filter((t: any) => validVoiceIds.has(t.voiceName));
          if (filtered.length !== parsed.length) {
            // Stale data found — save cleaned version
            sessionStorage.setItem('nepali_tts_takes', JSON.stringify(filtered));
          }
          setTakesHistory(filtered);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const selectedVoiceArtist = useMemo(
    () => VOICE_ARTISTS.find(v => v.id === selectedVoice) || VOICE_ARTISTS[0],
    [selectedVoice]
  );

  const isRomanized = useMemo(() => isRomanizedText(inputText), [inputText]);

  // Handle style preset click
  const handlePreset = (preset: typeof STYLE_PRESETS[0]) => {
    setActivePreset(preset.id);
    setSelectedTone(preset.tone);
    setSelectedVoice(preset.voice);
    // Wrap existing text with emotion tags based on preset
    if (inputText.trim()) {
      const tag = preset.id.replace(/-/g, '_').toUpperCase();
      setInputText(`[${tag}] ${inputText.trim()} [/${tag}]`);
    }
  };

  // AI Script Generator — uses backend to generate a Nepali script from description
  const handleGenerateScript = async () => {
    if (!scriptDesc.trim()) return;
    setIsGeneratingScript(true);
    try {
      const resp = await fetch('/api/tts/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: scriptDesc, durationSeconds: scriptDuration, tone: selectedTone }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.script) { setInputText(data.script); return; }
      }
      // Fallback: generate a simple placeholder
      setInputText(`नमस्ते! ${scriptDesc} — यस ${scriptDuration} सेकेण्डको भ्वाइसओभरमा तपाईंलाई स्वागत छ।`);
    } catch {
      setInputText(`नमस्ते! ${scriptDesc} — यस ${scriptDuration} सेकेण्डको भ्वाइसओभरमा तपाईंलाई स्वागत छ।`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Generate Voiceover
  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setErrorMessage('कृपया वाचनका लागि नेपाली पाठ प्रविष्ट गर्नुहोस्।');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, tone: selectedTone, voiceName: selectedVoice, speedWpm: 140 }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'अडियो उत्पादन गर्न सकिएन।');

      const newTake: GenerationResult = {
        id: `take-${Date.now()}`,
        audioUrl: data.audioUrl,
        devanagariText: data.devanagariText,
        originalText: data.originalText,
        wasConvertedFromRomanized: data.wasConvertedFromRomanized,
        tone: data.tone,
        toneDescription: data.toneDescription,
        voiceName: data.voiceName,
        speedWpm: data.speedWpm,
        durationSeconds: data.durationSeconds,
        wordCount: data.wordCount,
        directorNotes: data.directorNotes,
        phonetics: data.phonetics || { aspirated: [], retroflex: [] },
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const updated = [newTake, ...takesHistory.slice(0, 9)];
      setTakesHistory(updated);
      try { sessionStorage.setItem('nepali_tts_takes', JSON.stringify(updated)); } catch { /* ignore */ }
    } catch (err: any) {
      setErrorMessage(err.message || 'त्रुटि उत्पन्न भयो।');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setTakesHistory([]);
    try { sessionStorage.removeItem('nepali_tts_takes'); } catch { /* ignore */ }
  };

  const durationLabel = DURATION_OPTIONS.find(d => d.value === scriptDuration)?.label || '30 sec';

  return (
    <div className="min-h-screen bg-[#f5f6fa] font-sans" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4f6ef7] text-white">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Nepali Voiceover</h1>
            <p className="text-xs text-gray-400 leading-tight">Type Nepali text and get a professional AI voiceover in seconds</p>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-5 items-start">
        {/* ── LEFT PANEL ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Voice selector card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🎙️</span>
              <span className="text-sm font-bold text-gray-700">Select Voice</span>
              <span className="text-xs text-gray-400 ml-1">— {VOICE_ARTISTS.length} Nepali voices available</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VOICE_ARTISTS.map(artist => {
                const isSelected = selectedVoice === artist.id;
                return (
                  <div
                    key={artist.id}
                    id={`voice-card-${artist.id}`}
                    role="button"
                    tabIndex={0}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left w-full ${
                      isSelected
                        ? 'border-[#4f6ef7] bg-[#f0f3ff] shadow-md shadow-[#4f6ef7]/10'
                        : 'border-gray-200 bg-white hover:border-[#4f6ef7]/50 hover:bg-[#f8f9ff] hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedVoice(artist.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedVoice(artist.id); }}
                  >
                    {/* Avatar */}
                    <div className={`h-11 w-11 rounded-full flex items-center justify-center text-lg font-bold shrink-0 transition-all ${
                      isSelected
                        ? 'bg-[#4f6ef7] text-white shadow-md shadow-[#4f6ef7]/30'
                        : artist.gender === 'Female'
                          ? 'bg-pink-100 text-pink-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}>
                      {artist.nepaliName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base font-bold text-gray-900 leading-tight">{artist.nepaliName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                          artist.gender === 'Female'
                            ? 'bg-pink-100 text-pink-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>{artist.gender}</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{artist.character}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">{artist.bestFor}</div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <VoicePreviewButton voiceId={artist.id} voiceName={artist.nepaliName} />
                      {isSelected && (
                        <span className="text-[9px] font-bold text-[#4f6ef7] uppercase tracking-wide">Active</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Script Generator */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-600">AI Script Generator</span>
              <span className="text-gray-400 text-xs">— Describe your content in English or Nepali</span>
            </div>
            <div className="flex gap-2">
              <input
                id="script-desc-input"
                type="text"
                value={scriptDesc}
                onChange={e => setScriptDesc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerateScript()}
                placeholder="e.g. 30 second aggressive ad for a computer institute in Kathmandu"
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4f6ef7]/40 focus:border-[#4f6ef7]"
              />
              {/* Duration dropdown */}
              <div className="relative">
                <button
                  id="duration-dropdown-btn"
                  onClick={() => setShowDurationDropdown(p => !p)}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition whitespace-nowrap"
                >
                  {durationLabel}
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
                {showDurationDropdown && (
                  <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setScriptDuration(opt.value); setShowDurationDropdown(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition ${
                          scriptDuration === opt.value ? 'bg-[#f0f3ff] text-[#4f6ef7] font-medium' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                id="btn-generate-script"
                onClick={handleGenerateScript}
                disabled={isGeneratingScript || !scriptDesc.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap"
              >
                {isGeneratingScript ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Script
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              AI will write a Nepali Devanagari script based on your description — then you can generate the voiceover
            </p>
          </div>

          {/* Style Presets */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">
              🎨 Style Presets — click to auto-add emotion tags
            </p>
            <div className="flex flex-wrap gap-2">
              {STYLE_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  id={`preset-btn-${preset.id}`}
                  onClick={() => handlePreset(preset)}
                  className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition-all ${
                    activePreset === preset.id
                      ? 'border-[#4f6ef7] bg-[#4f6ef7] text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-[#4f6ef7] hover:text-[#4f6ef7] hover:bg-[#f0f3ff]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {!inputText.trim() && (
              <p className="mt-2 text-[11px] text-gray-400">
                💡 Type your script first, then click a preset to wrap it with emotion tags
              </p>
            )}
          </div>

          {/* Script Textarea */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            {isRomanized && inputText.trim() && (
              <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                🔤 Romanized Nepali detected — AI will auto-convert to Devanagari before voiceover generation.
              </div>
            )}
            <textarea
              id="script-textarea"
              value={inputText}
              onChange={e => { setInputText(e.target.value); setActivePreset(null); }}
              rows={8}
              placeholder="नमस्ते! यहाँ आफ्नो नेपाली पाठ टाइप गर्नुस्... (Devanagari script only — देवनागरी मा लेख्नुस्)"
              className="w-full resize-none text-base text-gray-800 placeholder-gray-300 focus:outline-none leading-relaxed"
              style={{ fontFamily: "'Noto Sans Devanagari', 'Mangal', serif" }}
            />
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-100 text-xs text-gray-400">
              <div className="flex items-center gap-3">
                <span>Tone: <strong className="text-[#4f6ef7]">{selectedTone}</strong></span>
                <span>•</span>
                <span>{inputText.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <button
                id="btn-clear-script"
                onClick={() => { setInputText(''); setActivePreset(null); }}
                className="text-gray-400 hover:text-gray-600 transition text-xs"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Error */}
          {errorMessage && (
            <div id="generation-error-alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ──────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col gap-4">

          {/* Generate button */}
          <button
            id="btn-generate-voiceover"
            onClick={handleGenerate}
            disabled={isLoading || !inputText.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#c8cdd8] hover:bg-[#4f6ef7] disabled:bg-[#c8cdd8] text-white font-semibold py-4 text-base transition-all shadow-sm disabled:cursor-not-allowed"
            style={{ background: inputText.trim() ? undefined : '#c8cdd8' }}
          >
            {isLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /><span>Generating...</span></>
            ) : (
              <><Mic className="h-5 w-5" /><span>Generate Voiceover</span></>
            )}
          </button>
          {isLoading && (
            <div className="text-center text-xs text-[#4f6ef7] animate-pulse">
              Generating your Nepali voiceover…
            </div>
          )}

          {/* Selected Voice card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Selected Voice</div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#4f6ef7] flex items-center justify-center text-white font-bold text-base shrink-0">
                {selectedVoiceArtist.nepaliName.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{selectedVoiceArtist.nepaliName}</div>
                <div className="text-xs text-gray-400">{selectedVoiceArtist.character.slice(0, 32)}…</div>
              </div>
            </div>
            {/* Sample presets from data */}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 mb-2">Quick samples:</p>
              <div className="flex flex-col gap-1">
                {SCRIPT_SAMPLES.slice(0, 3).map(sample => (
                  <button
                    key={sample.id}
                    id={`sample-btn-${sample.id}`}
                    onClick={() => {
                      setInputText(sample.text);
                      setSelectedTone(sample.tone);
                      setSelectedVoice(sample.recommendedVoice);
                      setActivePreset(null);
                    }}
                    className="text-left text-xs text-gray-600 hover:text-[#4f6ef7] px-2 py-1 rounded-lg hover:bg-[#f0f3ff] transition truncate"
                  >
                    {sample.nepaliTitle}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Generations */}
          {takesHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Generations</div>
                <button
                  id="btn-clear-history"
                  onClick={handleClearHistory}
                  className="text-[11px] text-gray-400 hover:text-red-400 transition flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              </div>
              <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
                {takesHistory.map(take => (
                  <div
                    key={take.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold text-gray-800">{take.voiceName}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-400 font-mono">
                            <Clock className="h-2.5 w-2.5" />{take.createdAt}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{take.devanagariText.slice(0, 50)}…</p>
                      </div>
                      <a
                        id={`btn-download-take-${take.id}`}
                        href={take.audioUrl}
                        download={`nepali_voiceover_${take.voiceName}_${take.id}.wav`}
                        className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#4f6ef7] hover:underline"
                        title="Download WAV"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                    <MiniPlayer take={take} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips card */}
          {takesHistory.length === 0 && (
            <div className="bg-[#f0f3ff] rounded-2xl border border-[#d0d9ff] p-4 text-xs text-[#4f6ef7]">
              <p className="font-semibold mb-1">💡 Tips</p>
              <ul className="space-y-1 text-[#6b7fc4]">
                <li>• Type Nepali Devanagari or Romanized text</li>
                <li>• Use Style Presets for emotion tags</li>
                <li>• AI Script Generator creates scripts from description</li>
                <li>• Try different voices for different moods</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
