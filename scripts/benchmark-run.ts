/**
 * Phase 2 — Generate audio for the 100+ Nepali benchmark.
 * Does NOT score pronunciation automatically (no reliable ASR for Kathmandu accent here).
 * Emits per-item: status, engine, appliedFixes, fishInput, audio file.
 * Human/ASR scoring is required for pronunciation quality.
 *
 * Prereq: npm run dev
 * Run:    npm run benchmark
 * Out:    benchmark/out/<id>/ + benchmark/out/RESULTS.json
 */
import fs from "fs";
import path from "path";

const BASE = process.env.APP_URL || "http://localhost:3000";
const CORPUS = process.env.BENCH_CORPUS
  ? path.resolve(process.env.BENCH_CORPUS)
  : path.join(process.cwd(), "benchmark", "nepali-benchmark-100.json");
const OUT = process.env.BENCH_OUT
  ? path.resolve(process.env.BENCH_OUT)
  : path.join(process.cwd(), "benchmark", "out");

interface BenchItem {
  id: string;
  cat: string;
  text: string;
  focus?: string;
}

async function health(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`);
    return r.ok;
  } catch {
    return false;
  }
}

async function generate(item: BenchItem, voiceName: string, mode: string) {
  const res = await fetch(`${BASE}/api/tts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: item.text,
      voiceName,
      mode,
      language: "nepali",
      pronunciation: process.env.PRONUNCIATION || "natural",
      tone: "conversational",
      speedWpm: 140,
      debug: true,
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function saveDataUrl(dataUrl: string, file: string): boolean {
  if (!dataUrl || !dataUrl.startsWith("data:")) return false;
  const i = dataUrl.indexOf(",");
  fs.writeFileSync(file, Buffer.from(dataUrl.slice(i + 1), "base64"));
  return true;
}

async function main() {
  if (!(await health())) {
    console.error("Server not reachable — start with: npm run dev");
    process.exit(1);
  }
  const corpus = JSON.parse(fs.readFileSync(CORPUS, "utf-8"));
  const items: BenchItem[] = corpus.sentences || [];
  if (items.length < 100) {
    console.warn(`Warning: only ${items.length} sentences (want ≥100)`);
  }
  const voiceName = process.env.FISH_VOICE || process.env.BENCH_VOICE || "Kore";
  const mode = process.env.BENCH_MODE || "unlimited";

  fs.mkdirSync(OUT, { recursive: true });
  const results: any[] = [];
  let pass = 0;
  let fail = 0;

  console.log(`Benchmark ${items.length} items → voice=${voiceName} mode=${mode}`);
  for (const item of items) {
    try {
      const { status, body } = await generate(item, voiceName, mode);
      const dir = path.join(OUT, item.id);
      fs.mkdirSync(dir, { recursive: true });
      let saved = false;
      if (typeof body.audioUrl === "string") {
        const ext = body.audioUrl.includes("mpeg") ? "mp3" : "wav";
        saved = saveDataUrl(body.audioUrl, path.join(dir, `audio.${ext}`));
      }
      const ok = status === 200 && body.success && saved && (body.audioUrl || "").length > 500;
      if (ok) pass++;
      else fail++;
      const row = {
        id: item.id,
        cat: item.cat,
        text: item.text,
        focus: item.focus,
        ok,
        status,
        engine: body.engine,
        audioBytes: typeof body.audioUrl === "string" ? body.audioUrl.length : 0,
        fishInput: body.debug?.fishInput,
        devanagariText: body.devanagariText,
        appliedFixes: body.appliedFixes || [],
        stages: body.debug?.stages?.map((s: any) => s.name),
        error: body.error,
        humanScore: null as number | null,
        humanNotes: "",
      };
      fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(row, null, 2), "utf-8");
      results.push(row);
      console.log(`${ok ? "OK  " : "FAIL"} ${item.id} ${item.cat} ${row.engine || ""} ${row.audioBytes}`);
    } catch (e: any) {
      fail++;
      results.push({ id: item.id, cat: item.cat, text: item.text, ok: false, error: e.message, humanScore: null, humanNotes: "" });
      console.log(`FAIL ${item.id} ${e.message}`);
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    voiceName,
    mode,
    total: items.length,
    pass,
    fail,
    byCategory: {} as Record<string, { total: number; ok: number }>,
    results,
  };
  for (const r of results) {
    const c = r.cat || "unknown";
    if (!summary.byCategory[c]) summary.byCategory[c] = { total: 0, ok: 0 };
    summary.byCategory[c].total++;
    if (r.ok) summary.byCategory[c].ok++;
  }
  fs.writeFileSync(path.join(OUT, "RESULTS.json"), JSON.stringify(summary, null, 2), "utf-8");
  console.log(`\n=== ${pass}/${items.length} generated OK (${fail} fail) ===`);
  console.log(`Results → benchmark/out/RESULTS.json`);
  console.log("Pronunciation quality requires human listen or ASR — generation success ≠ correct Nepali.");
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
