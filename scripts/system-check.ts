/**
 * system:check — probe every registered TTSEngine and print availability.
 * Never fabricates availability. Local stubs report unavailable until wired.
 *
 * Usage: npm run system:check
 */
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const { listEngines, resolveEngineId } = await import("../src/engines/registry");

async function main() {
  const rows: string[] = [];
  const selected = resolveEngineId();

  rows.push(`TTS_ENGINE selected: ${selected}`);
  rows.push("");

  for (const engine of listEngines()) {
    const avail = await engine.isAvailable();
    const flag = avail.available ? "AVAILABLE" : "UNAVAILABLE";
    const reason = avail.reason ? ` — ${avail.reason}` : "";
    rows.push(
      `[${flag}] ${engine.id.padEnd(18)} ${engine.displayName}` +
        ` | local=${engine.local} | nepali=${engine.supportsNepali} | clone=${engine.supportsClone}${reason}`,
    );
  }

  rows.push("");

  // File / path checks
  const checks: Array<[string, boolean, string]> = [
    ["benchmark/nepali/corpus.json", fs.existsSync(path.join(process.cwd(), "benchmark/nepali/corpus.json")), "main corpus"],
    [
      "benchmark/nepali/pronunciation_cases.json",
      fs.existsSync(path.join(process.cwd(), "benchmark/nepali/pronunciation_cases.json")),
      "pronunciation cases",
    ],
    ["docs/TTS_FOUNDATION_RESEARCH.md", fs.existsSync(path.join(process.cwd(), "docs/TTS_FOUNDATION_RESEARCH.md")), "research doc"],
    ["docs/NEPALI_HUMAN_EVALUATION.md", fs.existsSync(path.join(process.cwd(), "docs/NEPALI_HUMAN_EVALUATION.md")), "eval protocol"],
    [".env FISH_API_KEY", Boolean(process.env.FISH_API_KEY || process.env.FISH_ACCESS_TOKEN), "cloud Fish"],
    [".env GEMINI_API_KEY", Boolean(process.env.GEMINI_API_KEY), "Gemini reference"],
  ];

  for (const [name, ok, desc] of checks) {
    rows.push(`[${ok ? "OK" : "MISSING"}] ${name} (${desc})`);
  }

  // Corpus stats
  try {
    const corpusPath = path.join(process.cwd(), "benchmark/nepali/corpus.json");
    if (fs.existsSync(corpusPath)) {
      const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
      const n = corpus?.sentences?.length ?? 0;
      const cats = new Set((corpus?.sentences ?? []).map((s: any) => s.cat));
      rows.push("");
      rows.push(`Corpus: ${n} sentences across ${cats.size} categories (A–Z target ≥300) ${n >= 300 ? "PASS" : "FAIL"}`);
    }
  } catch (e) {
    rows.push(`Corpus parse error: ${String(e)}`);
  }

  const report = rows.join("\n");
  console.log(report);
  fs.writeFileSync(path.join(process.cwd(), "benchmark", "system-check.txt"), report, "utf8");
  console.log("\nWrote benchmark/system-check.txt");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
