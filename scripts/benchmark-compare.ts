/**
 * benchmark:compare — A/B/C engine comparison driver.
 * Synthesizes the same sentence set on each requested engine, writes
 * benchmark/comparison/<engine>/<sentence-id>.wav + metadata.json.
 *
 * Unwired/stub engines are recorded as skipped — never faked.
 *
 * Usage:
 *   npm run benchmark:compare -- --engines=fish,gemini --limit=10
 *   npm run benchmark:compare -- --engines=fish --use=cases
 */
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const { createEngines } = await import("../src/engines/registry");
type TTSEngine = import("../src/engines/types").TTSEngine;
type TTSSynthesisResult = import("../src/engines/types").TTSSynthesisResult;

interface Sentence {
  id: string;
  cat: string;
  text: string;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? "true";
  }
  return args;
}

function loadSentences(use: string): Sentence[] {
  if (use === "cases") {
    const p = path.join(process.cwd(), "benchmark/nepali/pronunciation_cases.json");
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return (j.cases ?? []).map((c: any) => ({ id: c.id, cat: c.category, text: c.text }));
  }
  const p = path.join(process.cwd(), "benchmark/nepali/corpus.json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return (j.sentences ?? []).map((s: any) => ({ id: s.id, cat: s.cat, text: s.text }));
}

async function saveWav(filePath: string, buf: Buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
}

async function runEngine(engine: TTSEngine, sentences: Sentence[], outRoot: string) {
  const outDir = path.join(outRoot, engine.id);
  fs.mkdirSync(outDir, { recursive: true });

  const avail = await engine.isAvailable();
  const results: Array<Record<string, unknown>> = [];

  if (!avail.available) {
    console.log(`SKIP ${engine.id}: ${avail.reason ?? "unavailable"}`);
    fs.writeFileSync(
      path.join(outDir, "SKIPPED.json"),
      JSON.stringify({ engine: engine.id, reason: avail.reason, skipped: true, timestamp: new Date().toISOString() }, null, 2),
    );
    return { engine: engine.id, skipped: true, ok: 0, fail: 0 };
  }

  let ok = 0;
  let fail = 0;
  for (const s of sentences) {
    const t0 = Date.now();
    let result: TTSSynthesisResult;
    try {
      result = await engine.synthesize({ text: s.text, representation: "raw", voiceId: undefined });
    } catch (e) {
      result = { ok: false, engineId: engine.id, error: String(e) };
    }

    const meta: Record<string, unknown> = {
      sentenceId: s.id,
      cat: s.cat,
      text: s.text,
      engine: engine.id,
      ok: result.ok,
      isStub: result.isStub ?? false,
      error: result.error,
      latencyMs: result.latencyMs ?? Date.now() - t0,
      voiceId: result.voiceId,
      evidence: result.evidence ?? "NOT_YET_TESTED",
      timestamp: new Date().toISOString(),
    };

    if (result.ok && result.audioBuffer && !result.isStub) {
      const wavPath = path.join(outDir, `${s.id}.wav`);
      await saveWav(wavPath, result.audioBuffer);
      meta["wav"] = path.relative(process.cwd(), wavPath);
      ok++;
    } else {
      fail++;
    }
    fs.writeFileSync(path.join(outDir, `${s.id}.json`), JSON.stringify(meta, null, 2));
    results.push(meta);
  }

  const summary = {
    engine: engine.id,
    skipped: false,
    total: sentences.length,
    ok,
    fail,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`${engine.id}: ok=${ok} fail=${fail} total=${sentences.length}`);
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawEngines = args["engines"] ?? "fish,gemini";
  const engineIds = rawEngines
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const limit = Number(args["limit"] ?? "10");
  const use = args["use"] ?? "cases";

  const all = loadSentences(use);
  const sentences = all.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10);

  const enginesMap = createEngines();
  const outRoot = path.join(process.cwd(), "benchmark", "comparison");

  console.log(`Comparing engines [${engineIds.join(", ")}] on ${sentences.length} sentences (source=${use})`);

  const summaries = [];
  for (const id of engineIds) {
    const engine = enginesMap[id];
    if (!engine) {
      console.warn(`Unknown engine: ${id}`);
      summaries.push({ engine: id, skipped: true, reason: "unknown" });
      continue;
    }
    summaries.push(await runEngine(engine, sentences, outRoot));
  }

  const rollup = {
    generatedAt: new Date().toISOString(),
    use,
    limit,
    summaries,
  };
  fs.writeFileSync(path.join(outRoot, "rollup.json"), JSON.stringify(rollup, null, 2));
  console.log(`Wrote ${path.join(outRoot, "rollup.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
