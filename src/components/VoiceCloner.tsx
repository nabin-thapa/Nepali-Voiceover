import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic,
  Square,
  Upload,
  Play,
  Pause,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { ClonedVoice, VoiceSample } from '../types';

interface VoiceClonerProps {
  onCloned: (voice: ClonedVoice) => void;
  onDelete: (id: string) => void;
}

const TIPS = [
  'Record 2–3 clips of 15–30s each (one paragraph) — matches Gemini native Kathmandu quality',
  'One speaker only — no music, no reverb, quiet room',
  'Use Nepali spoken in Devanagari script samples — best for Nepali pronunciation',
  'Matching Devanagari transcript for EVERY sample is required — anchors Fish language + pronunciation',
  'Speak clearly with natural pauses — steady volume, not rushed',
  'Aim for 30–60s total clean audio for native-level clone fidelity',
];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function audioDuration(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => resolve(0);
    a.src = dataUrl;
  });
}

export const VoiceCloner: React.FC<VoiceClonerProps> = ({ onCloned, onDelete }) => {
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [title, setTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [qualityWarnings, setQualityWarnings] = useState<string[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expand, setExpand] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);
  const recTimerRef = useRef<number | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const startRecording = useCallback(async () => {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recStartRef.current = Date.now();
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        const durationSec = (Date.now() - recStartRef.current) / 1000;
        if (blob.size < 500 || durationSec < 1) return;
        const dataUrl = await blobToDataUrl(blob);
        const d = durationSec || (await audioDuration(dataUrl));
        setSamples((prev) => [
          ...prev,
          {
            id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: `Recording ${prev.length + 1}`,
            dataUrl,
            text: '',
            durationSec: d,
          },
        ]);
        setIsRecording(false);
        if (recTimerRef.current) { window.clearInterval(recTimerRef.current); recTimerRef.current = null; }
        setRecSeconds(0);
      };
      rec.start();
      mediaRecorderRef.current = rec;
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = window.setInterval(() => {
        setRecSeconds(Math.floor((Date.now() - recStartRef.current) / 1000));
      }, 250);
    } catch (e: any) {
      setErrorMsg(e?.message === 'Permission denied'
        ? 'Microphone permission denied — allow mic access or upload a file instead.'
        : `Could not start recording: ${e?.message || 'unknown error'}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setErrorMsg('');
    const list = Array.from(files);
    for (const f of list) {
      if (samples.length >= 20) { setErrorMsg('Maximum 20 samples.'); break; }
      if (!/audio\/(wav|x-wav|wave|mpeg|mp3|mp4|m4a|x-m4a|opus|ogg|webm)/.test(f.type)) {
        setErrorMsg(`Unsupported file: ${f.name} (use WAV/MP3/M4A/OGG/Opus/WebM)`);
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setErrorMsg(`${f.name} is larger than 10MB.`);
        continue;
      }
      const dataUrl = await blobToDataUrl(f);
      const durationSec = await audioDuration(dataUrl);
      setSamples((prev) => [
        ...prev,
        {
          id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          dataUrl,
          text: '',
          durationSec,
        },
      ]);
    }
  }, [samples.length]);

  const playSample = useCallback((s: VoiceSample) => {
    if (playingId === s.id) { stopPlayback(); return; }
    stopPlayback();
    const a = new Audio(s.dataUrl);
    audioRef.current = a;
    a.onended = () => setPlayingId(null);
    a.play().then(() => setPlayingId(s.id)).catch(() => setPlayingId(null));
  }, [playingId, stopPlayback]);

  const removeSample = useCallback((id: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const missingTranscripts = samples.filter((s) => !s.text || !s.text.trim()).length;
  const totalSec = samples.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  const shortClone = samples.length > 0 && (samples.length < 2 || totalSec < 15);
  const canClone =
    samples.length > 0 &&
    title.trim().length > 0 &&
    missingTranscripts === 0 &&
    !isCloning;

  const setSampleText = useCallback((id: string, text: string) => {
    setSamples((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }, []);

  const handleClone = useCallback(async () => {
    if (!canClone) {
      if (missingTranscripts > 0) {
        setErrorMsg(`${missingTranscripts} sample(s) missing Nepali transcript — required to anchor language.`);
      }
      return;
    }
    setIsCloning(true);
    setStatus('idle');
    setErrorMsg('');
    setQualityWarnings([]);
    try {
      const payload = {
        title: title.trim(),
        description: `Nepali (ne-NP) voice — काठमाडौँ मानक नेपाली · ${samples.length} sample(s)`,
        samples: samples.map((s) => ({
          dataUrl: s.dataUrl,
          text: s.text.trim(),
          durationSec: s.durationSec || 0,
        })),
        enhanceAudio: true,
      };
      const resp = await fetch('/api/voices/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'Clone failed');

      setStatus('success');
      setQualityWarnings(Array.isArray(data.qualityWarnings) ? data.qualityWarnings : []);
      onCloned(data.voice);
      // reset form
      setSamples([]);
      setTitle('');
      setExpand(false);
      setTimeout(() => {
        setStatus('idle');
        setQualityWarnings([]);
      }, 6000);
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e.message || 'Voice cloning failed.');
    } finally {
      setIsCloning(false);
    }
  }, [canClone, missingTranscripts, samples, title, onCloned]);

  const shortSamples = samples.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <button
        id="btn-toggle-cloner"
        onClick={() => setExpand((p) => !p)}
        className="w-full flex items-center justify-between"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">🧬</span>
          <span className="text-sm font-bold text-gray-700">Clone Your Voice</span>
          <span className="text-xs text-gray-400">— unlimited, free, private</span>
        </span>
        <span className="text-[11px] text-[#4f6ef7] font-semibold">
          {expand ? 'Hide' : 'Open'}
        </span>
      </button>

      {expand && (
        <div className="mt-4 space-y-3">
          {/* Tips */}
          <ul className="rounded-xl bg-[#f0f3ff] border border-[#d0d9ff] px-3 py-2 space-y-0.5">
            {TIPS.map((t) => (
              <li key={t} className="text-[11px] text-[#6b7fc4] leading-snug">• {t}</li>
            ))}
          </ul>

          {/* Title */}
          <div className="flex gap-2">
            <input
              id="clone-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Voice name (e.g. मेरो आवाज / My Narrator)"
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4f6ef7]/40 focus:border-[#4f6ef7]"
              maxLength={100}
            />
          </div>

          {/* Record + Upload row */}
          <div className="flex gap-2 items-center">
            <button
              id="btn-record-sample"
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-[#4f6ef7] text-white hover:bg-[#3d5ce5]'
              }`}
              title={isRecording ? 'Stop recording' : 'Record a sample from your mic'}
            >
              {isRecording ? <Square className="h-4 w-4 fill-white" /> : <Mic className="h-4 w-4" />}
              {isRecording ? `Stop (${recSeconds}s)` : 'Record sample'}
            </button>

            <button
              id="btn-upload-sample"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition"
              title="Upload audio files"
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/wav,audio/mpeg,audio/mp3,audio/mp4,audio/m4a,audio/ogg,audio/opus,audio/webm"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
            />

            {isRecording && (
              <span className="text-xs text-red-500 font-mono animate-pulse">
                ● REC {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:{String(recSeconds % 60).padStart(2, '0')}
              </span>
            )}
          </div>

          {/* Nepali language badge */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-semibold text-emerald-700">
              🇳🇵 Nepali (ne-NP)
            </span>
            <span className="text-gray-400">Fish anchors language from your transcript + tags</span>
          </div>

          {/* Samples list with per-sample transcripts */}
          {samples.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {samples.map((s) => (
                <div key={s.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => playSample(s)}
                      className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full bg-[#4f6ef7] text-white hover:bg-[#3d5ce5] transition"
                      title="Play sample"
                    >
                      {playingId === s.id ? <Pause className="h-3 w-3 fill-white" /> : <Play className="h-3 w-3 fill-white ml-0.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-700 truncate">{s.name}</div>
                      <div className="text-[10px] text-gray-400">
                        {s.durationSec ? `${s.durationSec.toFixed(1)}s` : ''}
                        {s.durationSec > 0 && s.durationSec < 10 && (
                          <span className="text-amber-500 ml-1">— under 10s, 30s+ is better</span>
                        )}
                        {s.durationSec >= 30 && (
                          <span className="text-emerald-600 ml-1">— good length</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        s.text.trim()
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                      title={s.text.trim() ? 'Transcript provided' : 'Transcript required'}
                    >
                      {s.text.trim() ? '✓ text' : '⚠ text'}
                    </span>
                    <button
                      onClick={() => removeSample(s.id)}
                      className="h-6 w-6 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={s.text}
                    onChange={(e) => setSampleText(s.id, e.target.value)}
                    placeholder="Exact Nepali words spoken (Devanagari)…"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4f6ef7]/40"
                  />
                </div>
              ))}
            </div>
          )}

          {samples.length > 0 && missingTranscripts > 0 && (
            <div className="text-[11px] text-amber-600">
              {missingTranscripts} sample{missingTranscripts === 1 ? '' : 's'} still need{missingTranscripts === 1 ? 's' : ''} a matching transcript before clone.
            </div>
          )}
          {shortClone && missingTranscripts === 0 && (
            <div className="text-[11px] text-amber-600">
              ⚠ Short/1-sample clone often mispronounces — add 1–2 more clips (15–20s, Devanagari transcript) for clearer speech.
            </div>
          )}

          {/* Status messages */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {status === 'success' && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span>Cloned! Your voice is ready — select it in the voice grid above and generate.</span>
                {qualityWarnings.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-amber-700">
                    {qualityWarnings.map((w) => (
                      <li key={w}>• {w}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Clone button */}
          <button
            id="btn-clone-voice"
            onClick={handleClone}
            disabled={!canClone}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7c5cf7] hover:opacity-90 text-white font-semibold py-3 text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCloning ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Training voice…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Clone voice ({shortSamples} sample{shortSamples === 1 ? '' : 's'})</>
            )}
          </button>
          <p className="text-[10px] text-gray-400 text-center">
            Private by default · stored on Fish Audio · free · usually ready instantly
          </p>
        </div>
      )}
    </div>
  );
};
