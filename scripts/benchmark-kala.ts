/**
 * benchmark:kala — FIRST LOCAL NEPALI TTS EXPERIMENT (30 sentences).
 * Real WAV only on disk when kala produces parseable PCM. Never fabricates audio.
 *
 * Test set:
 *   10 normal Nepali (corpus A-01..A-10)
 *   10 difficult pronunciation cases (highest difficulty from pronunciation_cases.json)
 *    5 numbers/date (corpus G-01..G-05)
 *    5 Nepali-English mixed (corpus S-01..S-05)
 *
 * Usage: npm run benchmark:kala
 *        npm run benchmark:kala -- --speaker=kala
 */
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const { createEngines } = await import("../src/engines/registry");

type TTSSynthesisResult = import("../src/engines/types").TTSSynthesisResult;

interface Item {
  id: string;
  source: "corpus" | "pronunciation_cases";
  group: "normal" | "pronunciation" | "number_date" | "mixed";
  cat?: string;
  difficulty?: number;
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

function pickTestSet(): Item[] {
  const corpus = JSON.parse(fs.readFileSync(path.join(process.cwd(), "benchmark/nepali/corpus.json"), "utf8"));
  const cases = JSON.parse(fs.readFileSync(path.join(process.cwd(), "benchmark/nepali/pronunciation_cases.json"), "utf8"));

  const items: Item[] = [];

  const normals = (corpus.sentences ?? []).filter((s: any) => s.cat === "A").slice(0, 10);
  for (const s of normals) {
    items.push({ id: s.id, source: "corpus", group: "normal", cat: s.cat, text: s.text });
  }

  const hard = [...(cases.cases ?? [])]
    .sort((a: any, b: any) => (b.difficulty ?? 0) - (a.difficulty ?? 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, 10);
  for (const c of hard) {
    items.push({
      id: c.id,
      source: "pronunciation_cases",
      group: "pronunciation",
      cat: c.category,
      difficulty: c.difficulty,
      text: c.text,
    });
  }

  const numbers = (corpus.sentences ?? []).filter((s: any) => s.cat === "G").slice(0, 5);
  for (const s of numbers) {
    items.push({ id: s.id, source: "corpus", group: "number_date", cat: s.cat, text: s.text });
  }

  const mixed = (corpus.sentences ?? []).filter((s: any) => s.cat === "S").slice(0, 5);
  for (const s of mixed) {
    items.push({ id: s.id, source: "corpus", group: "mixed", cat: s.cat, text: s.text });
  }

  return items;
}

function isPlayableWav(buf: Buffer | undefined): boolean {
  if (!buf || buf.length < 44) return false;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return false;
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const speaker = args["speaker"] || process.env.KALA_SPEAKER || "kala";

  const engines = createEngines();
  const engine = engines["kala"];
  if (!engine) {
    console.error("kala engine missing from registry");
    process.exit(1);
  }

  const avail = await engine.isAvailable();
  const outDir = path.join(process.cwd(), "benchmark", "out-nepali", "kala");
  fs.mkdirSync(outDir, { recursive: true });

  const inventory = pickTestSet();
  if (inventory.length !== 30) {
    console.error(`Test set size expected 30, got ${inventory.length}`);
    process.exit(1);
  }

  const results: Array<Record<string, unknown>> = [];
  const tAll0 = Date.now();

  if (!avail.available) {
    const summary = {
      engine: "kala",
      installation: "FAILED_OR_UNAVAILABLE",
      localInference: "FAILED",
      reason: avail.reason,
      wavGenerated: 0,
      totalMs: 0,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
    console.error(JSON.stringify(summary, null, 2));
    process.exit(2);
  }

  let wavOk = 0;
  let fail = 0;
  let totalGenSec = 0;

  for (const item of inventory) {
    const t0 = Date.now();
    let result: TTSSynthesisResult;
    try {
      result = await engine.synthesize({ text: item.text, representation: "raw", voiceId: speaker });
    } catch (e) {
      result = { ok: false, engineId: "kala", error: String(e) };
    }
    const generationMs = Date.now() - t0;

    const meta: Record<string, unknown> = {
      engine: "kala",
      sentenceId: item.id,
      source: item.source,
      group: item.group,
      cat: item.cat,
      difficulty: item.difficulty,
      text: item.text,
      voiceId: speaker,
      success: false,
      localAudio: false,
      playableWav: false,
      generationTimeMs: generationMs,
      latencyMs: result.latencyMs,
      sampleRate: null as number | null,
      durationSec: null as number | null,
      bytes: null as number | null,
      outputPath: null as string | null,
      evidence: "FAILED",
      error: result.error,
      timestamp: new Date().toISOString(),
    };

    if (result.ok && result.audioBuffer && !result.isStub && isPlayableWav(result.audioBuffer)) {
      const wavPath = path.join(outDir, `${item.id}.wav`);
      fs.writeFileSync(wavPath, result.audioBuffer);
      meta.success = true;
      meta.localAudio = true;
      meta.playableWav = true;
      meta.sampleRate = result.sampleRate ?? null;
      meta.durationSec = result.durationSec ?? null;
      meta.bytes = result.audioBuffer.length;
      meta.outputPath = path.relative(process.cwd(), wavPath);
      meta.evidence = "VERIFIED";
      meta.error = undefined;
      wavOk++;
      if (typeof result.durationSec === "number") totalGenSec += result.durationSec;
    } else {
      fail++;
      meta.evidence = result.isStub ? "STUB" : "FAILED";
    }

    fs.writeFileSync(path.join(outDir, `${item.id}.json`), JSON.stringify(meta, null, 2));
    results.push(meta);
    const flag = meta.success ? "OK  " : "FAIL";
    console.log(`${flag} ${item.id.padEnd(8)} ${item.group.padEnd(14)} ${generationMs}ms  ${meta.sampleRate ?? "-"}Hz  ${meta.durationSec ?? "-"}s`);
  }

  const wallMs = Date.now() - tAll0;
  const byGroup = {
    normal: results.filter((r) => r.group === "normal" && r.success).length,
    pronunciation: results.filter((r) => r.group === "pronunciation" && r.success).length,
    number_date: results.filter((r) => r.group === "number_date" && r.success).length,
    mixed: results.filter((r) => r.group === "mixed" && r.success).length,
  };

  const summary = {
    engine: "kala",
    speaker,
    installation: "SUCCESS",
    localInference: wavOk > 0 ? "SUCCESS" : "FAILED",
    planned: inventory.length,
    wavGenerated: wavOk,
    failed: fail,
    byGroup,
    totalGenerationWallMs: wallMs,
    totalAudioDurationSec: Number(totalGenSec.toFixed(3)),
    meanLatencyMs: results.length ? Math.round(results.reduce((s, r) => s + Number(r.generationTimeMs || 0), 0) / results.length) : 0,
    evidencePolicy: "VERIFIED only if real local WAV file written and RIFF/WAVE header parsed",
    training: false,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, "_results.json"), JSON.stringify(results, null, 2));
  console.log("\n" + JSON.stringify(summary, null, 2));
  if (wavOk === 0) process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
