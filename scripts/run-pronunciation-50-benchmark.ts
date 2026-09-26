/**
 * Pronunciation benchmark runner for Native Nepali TTS Lab.
 * Runs 50 benchmark cases across Gemini (reference) and Indic Parler-TTS (local).
 * Preserves exact text, audio WAVs, generation times, and success/failure.
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import dotenv from "dotenv";
import { GeminiEngine } from "../src/engines/geminiEngine";

dotenv.config();

const CASES_PATH = path.join(process.cwd(), "benchmark", "nepali", "pronunciation_cases.json");
const OUT_DIR = path.join(process.cwd(), "benchmark", "comparison", "pronunciation_50");
const GEMINI_DIR = path.join(OUT_DIR, "gemini");
const PARLER_DIR = path.join(OUT_DIR, "indic_parler");
const BATCH_FILE = path.join(OUT_DIR, "parler_batch.json");
const RESULTS_FILE = path.join(OUT_DIR, "benchmark_results.json");

interface TestCase {
  id: string;
  text: string;
  category: string;
  difficulty: number;
  expectedNotes: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runPython(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const py = process.env.INDIC_PARLER_PYTHON || process.env.PYTHON || "python";
    const child = spawn(py, args, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => {
      const s = d.toString("utf8");
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (d) => {
      const s = d.toString("utf8");
      stderr += s;
      process.stderr.write(s);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
    child.on("error", (err) => {
      resolve({ code: -1, stdout, stderr: String(err) });
    });
  });
}

async function main() {
  console.log("=== Starting Native Nepali Pronunciation Benchmark (50 Cases) ===");
  fs.mkdirSync(GEMINI_DIR, { recursive: true });
  fs.mkdirSync(PARLER_DIR, { recursive: true });

  const rawCases = JSON.parse(fs.readFileSync(CASES_PATH, "utf8"));
  const cases: TestCase[] = rawCases.cases;
  console.log(`Loaded ${cases.length} pronunciation benchmark cases from ${CASES_PATH}\n`);

  // Step 1: Run Gemini TTS for all 50 cases
  console.log("--- Phase 1: Gemini TTS Reference Synthesis ---");
  const gemini = new GeminiEngine();
  const geminiAvail = await gemini.isAvailable();
  console.log(`Gemini available: ${geminiAvail.available}`);

  const geminiResults: Record<string, any> = {};

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const outPath = path.join(GEMINI_DIR, `${c.id}.wav`);
    console.log(`[Gemini ${i + 1}/${cases.length}] ${c.id}: ${c.text.slice(0, 30)}...`);

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 44) {
      console.log(`  ✓ CACHED on disk (${fs.statSync(outPath).size} bytes)`);
      geminiResults[c.id] = {
        ok: true,
        audioPath: path.relative(process.cwd(), outPath).replace(/\\/g, "/"),
        bytes: fs.statSync(outPath).size,
        latencyMs: 0,
        sampleRate: 24000,
      };
      continue;
    }

    const t0 = Date.now();
    let success = false;
    const modelsToTry = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview"];

    for (const modelName of modelsToTry) {
      try {
        process.env.GEMINI_TTS_MODEL = modelName;
        const res = await gemini.synthesize({
          text: c.text,
          representation: "raw",
          voiceId: "Kore",
        });

        if (res.ok && res.audioBuffer && res.audioBuffer.length > 44) {
          fs.writeFileSync(outPath, res.audioBuffer);
          geminiResults[c.id] = {
            ok: true,
            audioPath: path.relative(process.cwd(), outPath).replace(/\\/g, "/"),
            bytes: res.audioBuffer.length,
            latencyMs: res.latencyMs ?? Date.now() - t0,
            durationSec: res.durationSec ?? 0,
            sampleRate: res.sampleRate ?? 24000,
            model: modelName,
          };
          console.log(`  ✓ OK via ${modelName} (${geminiResults[c.id].latencyMs}ms, ${geminiResults[c.id].durationSec}s)`);
          success = true;
          break;
        } else if (res.error && res.error.includes("429")) {
          console.log(`  [429 on ${modelName}, trying fallback...]`);
          await sleep(1000);
          continue;
        } else {
          console.log(`  [Error on ${modelName}: ${res.error}]`);
        }
      } catch (e: any) {
        console.log(`  [Exception on ${modelName}: ${e.message || e}]`);
      }
    }

    if (!success) {
      // One more retry after a short wait
      console.log(`  Waiting 8s for rate-limit reset before retry...`);
      await sleep(8000);
      try {
        process.env.GEMINI_TTS_MODEL = "gemini-3.8-flash-tts";
        const res = await gemini.synthesize({
          text: c.text,
          representation: "raw",
          voiceId: "Kore",
        });
        if (res.ok && res.audioBuffer && res.audioBuffer.length > 44) {
          fs.writeFileSync(outPath, res.audioBuffer);
          geminiResults[c.id] = {
            ok: true,
            audioPath: path.relative(process.cwd(), outPath).replace(/\\/g, "/"),
            bytes: res.audioBuffer.length,
            latencyMs: res.latencyMs ?? Date.now() - t0,
            durationSec: res.durationSec ?? 0,
            sampleRate: res.sampleRate ?? 24000,
          };
          console.log(`  ✓ OK on retry (${geminiResults[c.id].latencyMs}ms)`);
          success = true;
        } else {
          geminiResults[c.id] = {
            ok: false,
            error: res.error ?? "Failed across all models",
            latencyMs: Date.now() - t0,
          };
          console.log(`  ✗ FAILED: ${res.error}`);
        }
      } catch (err: any) {
        geminiResults[c.id] = {
          ok: false,
          error: String(err),
          latencyMs: Date.now() - t0,
        };
        console.log(`  ✗ ERROR: ${err.message || err}`);
      }
    }

    // Pace delay between Gemini requests
    await sleep(2000);
  }

  // Step 2: Run Indic Parler-TTS in batch mode
  console.log("\n--- Phase 2: Indic Parler-TTS Local Synthesis (Batch Mode) ---");
  const parlerBatch = cases.map((c) => ({
    id: c.id,
    text: c.text,
    out: path.join(PARLER_DIR, `${c.id}.wav`),
    voice: "Amrita",
  }));

  fs.writeFileSync(BATCH_FILE, JSON.stringify(parlerBatch, null, 2), "utf8");
  console.log(`Wrote batch configuration to ${BATCH_FILE}`);
  console.log("Invoking scripts/indic_parler_synth.py with batch file on CPU...\n");

  const synthScript = path.join(process.cwd(), "scripts", "indic_parler_synth.py");
  const pyProc = await runPython([synthScript, "--batch-file", BATCH_FILE]);

  let parlerResults: Record<string, any> = {};
  try {
    // Find the JSON line at the end of stdout
    const lines = pyProc.stdout.trim().split("\n");
    const lastJsonLine = lines.filter((l) => l.trim().startsWith("{")).pop();
    if (lastJsonLine) {
      const parsed = JSON.parse(lastJsonLine);
      if (parsed.results) {
        for (const r of parsed.results) {
          parlerResults[r.id] = {
            ok: r.ok,
            audioPath: r.out ? path.relative(process.cwd(), r.out).replace(/\\/g, "/") : undefined,
            bytes: r.bytes,
            latencyMs: r.latencyMs,
            durationSec: r.durationSec,
            sampleRate: r.sampleRate,
            error: r.error,
          };
        }
      }
    }
  } catch (parseErr) {
    console.error("Failed to parse batch JSON output:", parseErr);
  }

  // Verify on disk which parler files exist
  for (const c of cases) {
    const p = path.join(PARLER_DIR, `${c.id}.wav`);
    if (fs.existsSync(p) && fs.statSync(p).size > 44) {
      if (!parlerResults[c.id]) {
        parlerResults[c.id] = { ok: true };
      }
      parlerResults[c.id].audioPath = path.relative(process.cwd(), p).replace(/\\/g, "/");
      parlerResults[c.id].bytes = fs.statSync(p).size;
      parlerResults[c.id].ok = true;
    }
  }

  // Step 3: Compile combined results
  console.log("\n--- Phase 3: Consolidating Results ---");
  const combined = cases.map((c) => {
    return {
      id: c.id,
      text: c.text,
      category: c.category,
      difficulty: c.difficulty,
      expectedNotes: c.expectedNotes,
      gemini: geminiResults[c.id] || { ok: false, error: "Not run" },
      indicParler: parlerResults[c.id] || { ok: false, error: "Not run" },
    };
  });

  const summary = {
    date: new Date().toISOString(),
    totalCases: cases.length,
    geminiSuccess: Object.values(geminiResults).filter((r: any) => r.ok).length,
    parlerSuccess: Object.values(parlerResults).filter((r: any) => r.ok).length,
    cases: combined,
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nCompleted! Results written to ${RESULTS_FILE}`);
  console.log(`Gemini successful: ${summary.geminiSuccess}/${cases.length}`);
  console.log(`Indic Parler successful: ${summary.parlerSuccess}/${cases.length}`);
}

main().catch((err) => {
  console.error("Fatal benchmark error:", err);
  process.exit(1);
});
