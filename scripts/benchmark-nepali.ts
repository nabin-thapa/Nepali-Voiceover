/**
 * benchmark:nepali — generate the Nepali corpus (or a subset) on the
 * currently selected TTS_ENGINE. Writes to benchmark/out-nepali/.
 *
 * Usage:
 *   npm run benchmark:nepali -- --limit=20
 *   npm run benchmark:nepali -- --limit=5 --engine=fish
 */
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const { createEngines } = await import("../src/engines/registry");

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? "true";
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const engineId = args["engine"] || process.env.TTS_ENGINE?.toLowerCase() || "fish";
  const limit = Number(args["limit"] ?? "20");

  const corpusPath = path.join(process.cwd(), "benchmark/nepali/corpus.json");
  const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
  const sentences: Array<{ id: string; cat: string; text: string }> = (corpus.sentences ?? []).slice(
    0,
    Number.isFinite(limit) && limit > 0 ? limit : 20,
  );

  const engines = createEngines();
  const engine = engines[engineId];
  if (!engine) {
    console.error(`Unknown engine: ${engineId}. Known: ${Object.keys(engines).join(", ")}`);
    process.exit(1);
  }

  const avail = await engine.isAvailable();
  if (!avail.available) {
    console.error(`Engine ${engineId} unavailable: ${avail.reason ?? "unknown"}`);
    // Still write a report so results are explicit, not silent.
    const outDir = path.join(process.cwd(), "benchmark", "out-nepali", engineId);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "UNAVAILABLE.json"),
      JSON.stringify({ engine: engineId, reason: avail.reason, count: sentences.length, timestamp: new Date().toISOString() }, null, 2),
    );
    process.exit(2);
  }

  const outDir = path.join(process.cwd(), "benchmark", "out-nepali", engineId);
  fs.mkdirSync(outDir, { recursive: true });

  let ok = 0;
  let fail = 0;
  for (const s of sentences) {
    const r = await engine.synthesize({ text: s.text, representation: "raw" });
    const meta: Record<string, unknown> = {
      sentenceId: s.id,
      cat: s.cat,
      text: s.text,
      engine: engineId,
      ok: r.ok,
      isStub: r.isStub ?? false,
      error: r.error,
      latencyMs: r.latencyMs,
      evidence: r.evidence ?? "NOT_YET_TESTED",
      timestamp: new Date().toISOString(),
    };
    if (r.ok && r.audioBuffer && !r.isStub) {
      const wav = path.join(outDir, `${s.id}.wav`);
      fs.writeFileSync(wav, r.audioBuffer);
      meta["wav"] = path.relative(process.cwd(), wav);
      ok++;
    } else {
      fail++;
    }
    fs.writeFileSync(path.join(outDir, `${s.id}.json`), JSON.stringify(meta, null, 2));
  }

  const summary = { engine: engineId, total: sentences.length, ok, fail, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (fail > 0 && ok === 0) process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
