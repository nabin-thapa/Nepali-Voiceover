import React, { useEffect, useState, useCallback } from 'react';
import { FlaskConical, Loader2, AlertCircle, CheckCircle2, Play, Download } from 'lucide-react';

interface EngineInfo {
  id: string;
  displayName: string;
  local: boolean;
  supportsNepali: string;
  supportsClone: boolean;
  license?: string;
  representations: string[];
  available: boolean;
  reason?: string;
  selected: boolean;
}

interface CorpusMeta {
  total: number;
  categories: Record<string, number>;
  categoryLegend: Record<string, string>;
  pronunciationCases: number;
}

/**
 * Native Nepali TTS Lab — Research Mode.
 * Read-only status + optional research synthesis via /api/research/*.
 * Does not replace the main generate flow.
 */
export const ResearchLab: React.FC = () => {
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [corpus, setCorpus] = useState<CorpusMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [synthEngine, setSynthEngine] = useState('fish');
  const [synthText, setSynthText] = useState('नमस्ते, तपाईं कस्तो हुनुहुन्छ?');
  const [synthBusy, setSynthBusy] = useState(false);
  const [synthError, setSynthError] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [eRes, cRes] = await Promise.all([
        fetch('/api/research/engines'),
        fetch('/api/research/corpus'),
      ]);
      if (eRes.ok) {
        const ej = await eRes.json();
        setEngines(ej.engines ?? []);
        setSelected(ej.selected ?? '');
        const sel = (ej.engines ?? []).find((e: EngineInfo) => e.selected);
        if (sel) setSynthEngine(sel.id);
      } else {
        setError('Engines endpoint unavailable (is the server running?)');
      }
      if (cRes.ok) {
        const cj = await cRes.json();
        setCorpus({
          total: cj.total ?? 0,
          categories: cj.categories ?? {},
          categoryLegend: cj.categoryLegend ?? {},
          pronunciationCases: cj.pronunciationCases ?? 0,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const synthesize = async () => {
    setSynthBusy(true);
    setSynthError('');
    setStatus('');
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    try {
      const res = await fetch('/api/research/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: synthText, engineId: synthEngine }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          if (j?.reason) msg += ` — ${j.reason}`;
          if (j?.error) msg += ` — ${j.error}`;
          if (j?.isStub) msg = j.error || 'Stub engine not wired';
        } catch { /* keep status */ }
        setSynthError(msg);
        return;
      }
      const buf = await res.arrayBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
      setAudioUrl(url);
      setStatus(
        `OK engine=${res.headers.get('X-Engine-Id') ?? synthEngine}` +
          (res.headers.get('X-Latency-Ms') ? ` latency=${res.headers.get('X-Latency-Ms')}ms` : '') +
          (res.headers.get('X-Evidence') ? ` evidence=${res.headers.get('X-Evidence')}` : ''),
      );
    } catch (e) {
      setSynthError(e instanceof Error ? e.message : String(e));
    } finally {
      setSynthBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4" id="research-lab">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-semibold text-purple-600">Native Nepali TTS Lab</span>
        <span className="text-gray-400 text-xs">— Research Mode (does not replace main generate)</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Pipeline: Nepali Text → Normalizer → Representation → TTSEngine. Evidence labels: VERIFIED / EXPERIMENTAL / NOT YET TESTED.
        See <code className="text-[11px]">docs/NEPALI_TTS_ARCHITECTURE.md</code>.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading engines…
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2 mb-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && engines.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="py-1 pr-2 font-medium">Engine</th>
                <th className="py-1 pr-2 font-medium">Nepali</th>
                <th className="py-1 pr-2 font-medium">Clone</th>
                <th className="py-1 pr-2 font-medium">Local</th>
                <th className="py-1 pr-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {engines.map((e) => (
                <tr key={e.id} className={`border-b border-gray-50 ${e.selected ? 'bg-purple-50/50' : ''}`}>
                  <td className="py-1.5 pr-2">
                    <span className="font-mono text-[10px] text-gray-700">{e.id}</span>
                    {e.selected && <span className="ml-1 text-[9px] font-bold text-purple-600 uppercase">sel</span>}
                    <div className="text-gray-400 text-[10px]">{e.displayName}</div>
                  </td>
                  <td className="py-1.5 pr-2">
                    <span
                      className={`px-1 rounded text-[9px] font-semibold ${
                        e.supportsNepali === 'verified'
                          ? 'bg-green-100 text-green-700'
                          : e.supportsNepali === 'experimental'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {e.supportsNepali}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">{e.supportsClone ? 'yes' : 'no'}</td>
                  <td className="py-1.5 pr-2">{e.local ? 'local' : 'cloud'}</td>
                  <td className="py-1.5 pr-2">
                    {e.available ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400" title={e.reason}>
                        <AlertCircle className="h-3 w-3" /> unavailable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {corpus && (
        <div className="text-[11px] text-gray-500 mb-3 bg-gray-50 rounded-lg px-3 py-2">
          Benchmark corpus: <strong>{corpus.total}</strong> sentences ·{' '}
          <strong>{Object.keys(corpus.categories).length}</strong> categories (A–Z) ·{' '}
          <strong>{corpus.pronunciationCases}</strong> pronunciation cases (difficulty 1–5)
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          id="research-engine-select"
          value={synthEngine}
          onChange={(e) => setSynthEngine(e.target.value)}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        >
          {engines.map((e) => (
            <option key={e.id} value={e.id} disabled={!e.available}>
              {e.id}
              {!e.available ? ' (unavailable)' : ''}
            </option>
          ))}
        </select>
        <input
          id="research-text-input"
          type="text"
          value={synthText}
          onChange={(e) => setSynthText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !synthBusy && synthText.trim() && synthesize()}
          placeholder="Nepali sentence…"
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
        />
        <button
          id="btn-research-synth"
          onClick={synthesize}
          disabled={synthBusy || !synthText.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition"
        >
          {synthBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Synthesize
        </button>
      </div>

      {synthError && (
        <div className="mt-2 flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{synthError}</span>
        </div>
      )}
      {status && <div className="mt-2 text-[11px] text-green-700">{status}</div>}

      {audioUrl && (
        <div className="mt-2 flex items-center gap-3">
          <audio controls src={audioUrl} className="h-8 flex-1" />
          <a
            href={audioUrl}
            download={`research-${synthEngine}.wav`}
            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> wav
          </a>
        </div>
      )}

      <p className="mt-3 text-[10px] text-gray-400">
        Quality claims require human listening —{' '}
        <code>docs/NEPALI_HUMAN_EVALUATION.md</code>. Generation success ≠ pronunciation score.
      </p>
    </div>
  );
};
