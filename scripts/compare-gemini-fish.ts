/**
 * Phase 10/14 — Gemini reference vs Fish clone comparison workflow.
 * Same Nepali sentence → REFERENCE (Gemini ne-NP) + TEST (Fish clone/stock).
 * Does NOT copy Gemini voice. Quality reference only.
 *
 * Output layout (Task 7):
 *   benchmark/comparison/gemini/<id>/audio.*   ← Gemini side
 *   benchmark/comparison/fish/<id>/audio.*     ← Fish side
 *   benchmark/comparison/<id>/meta.json        ← pair metadata
 *   benchmark/comparison/SUMMARY.json
 *   benchmark/comparisons/                     ← legacy (older runs)
 *
 * Prereq: npm run dev
 * Run:    npx tsx scripts/compare-gemini-fish.ts   (or npm run compare:reference)
 */
import fs from "fs";
import path from "path";

const BASE = process.env.APP_URL || "http://localhost:3000";
const OUT_ROOT = path.join(process.cwd(), "benchmark", "comparison");
const OUT_FISH = path.join(OUT_ROOT, "fish");
const OUT_GEMINI = path.join(OUT_ROOT, "gemini");
// Legacy path kept for older scripts
const OUT_LEGACY = path.join(process.cwd(), "benchmark", "comparisons");

interface Pair {
  id: string;
  text: string;
  voiceName?: string; // fish voice/clone id
}

const PAIRS: Pair[] = [
  { id: "ktm-02", text: "म आज काठमाडौं जाँदैछु।" },
  { id: "rural-01", text: "हाम्रो गाउँमा धेरै गाई र भैंसी छन्।" },
  { id: "animal-03", text: "आज भैंसी नदीको किनारमा घाँस चरिरहेको छ।" },
  { id: "conj-01", text: "ज्ञान नै शक्ति हो।" },
  { id: "hard-02", text: "शिक्षा र पर्यावरण महत्त्वपूर्ण छ।" },
  { id: "type-q-01", text: "तपाईंको नाम के हो?" },
  { id: "type-l-01", text: "आज बिहान हामी सबै जल्दी उठेका थियौं किनभने स्कुलको वार्षिकोत्सव कार्यक्रम सुरु हुनुभयो।" },
  { id: "mix-01", text: "हाम्रो software काम राम्रो छ।" },
  { id: "nasal-01", text: "गाउँ र घाँस राम्रो छ।" },
  { id: "conv-04", text: "के छ साथी! ल चिया पिउने हो?" },
];

async function gen(
  text: string,
  mode: "native" | "unlimited",
  voiceName: string,
  language = "nepali",
  pronunciation = "natural",
) {
  const res = await fetch(`${BASE}/api/tts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voiceName,
      mode,
      language,
      pronunciation,
      tone: "conversational",
      speedWpm: 140,
      debug: true,
    }),
  });
  const j: any = await res.json().catch(() => ({}));
  return { status: res.status, body: j };
}

function saveAudio(dataUrl: string, file: string) {
  if (!dataUrl || !dataUrl.startsWith("data:")) return false;
  const comma = dataUrl.indexOf(",");
  const b64 = dataUrl.slice(comma + 1);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  return true;
}

async function main() {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.mkdirSync(OUT_FISH, { recursive: true });
  fs.mkdirSync(OUT_GEMINI, { recursive: true });
  const fishVoice = process.env.FISH_VOICE || "bee6e30d95e3443b83b9890deec5dc80"; // Thapa clone default
  const report: any[] = [];

  for (const p of PAIRS) {
    const pairDir = path.join(OUT_ROOT, p.id);
    const geminiDir = path.join(OUT_GEMINI, p.id);
    const fishDir = path.join(OUT_FISH, p.id);
    fs.mkdirSync(pairDir, { recursive: true });
    fs.mkdirSync(geminiDir, { recursive: true });
    fs.mkdirSync(fishDir, { recursive: true });

    // REFERENCE: Gemini native (stock voice — quality bar, not identity clone)
    const ref = await gen(p.text, "native", "Kore");
    // TEST: Fish clone (or stock if env says so)
    const test = await gen(p.text, "unlimited", fishVoice);

    // If Gemini fell back to Fish, mark clearly so we don't claim a true reference
    const refIsTrueGemini = ref.body?.engine === "gemini";

    const entry = {
      id: p.id,
      text: p.text,
      reference: {
        engine: ref.body?.engine,
        status: ref.status,
        ok: !!ref.body?.success,
        isTrueGeminiReference: refIsTrueGemini,
        audioBytes: typeof ref.body?.audioUrl === "string" ? ref.body.audioUrl.length : 0,
        devanagariText: ref.body?.devanagariText,
        pronunciation: ref.body?.pronunciation,
        stages: ref.body?.debug?.stages?.map((s: any) => s.name),
        dir: path.join("benchmark", "comparison", "gemini", p.id),
      },
      test: {
        engine: test.body?.engine,
        status: test.status,
        ok: !!test.body?.success,
        audioBytes: typeof test.body?.audioUrl === "string" ? test.body.audioUrl.length : 0,
        devanagariText: test.body?.devanagariText,
        fishInput: test.body?.debug?.fishInput,
        pronunciation: test.body?.pronunciation,
        appliedFixes: test.body?.appliedFixes,
        stages: test.body?.debug?.stages?.map((s: any) => s.name),
        dir: path.join("benchmark", "comparison", "fish", p.id),
      },
      humanChecklist: [
        "1 word pronunciation",
        "2 syllable pronunciation",
        "3 rhythm",
        "4 pauses",
        "5 intonation",
        "6 naturalness",
        "7 speaker identity (test only — must remain YOUR voice)",
      ],
      errorReportTemplate: "docs/PRONUNCIATION_ERROR_REPORT.md",
      saved: {
        gemini: false,
        fish: false,
      },
    };

    if (typeof ref.body?.audioUrl === "string") {
      const ext = ref.body.audioUrl.includes("mpeg") ? "mp3" : "wav";
      const dest = path.join(geminiDir, `audio.${ext}`);
      entry.saved.gemini = saveAudio(ref.body.audioUrl, dest);
      // legacy alias
      const legacyDir = path.join(OUT_LEGACY, p.id);
      fs.mkdirSync(legacyDir, { recursive: true });
      saveAudio(ref.body.audioUrl, path.join(legacyDir, `reference.${ext}`));
    }
    if (typeof test.body?.audioUrl === "string") {
      const ext = test.body.audioUrl.includes("mpeg") ? "mp3" : "wav";
      const dest = path.join(fishDir, `audio.${ext}`);
      entry.saved.fish = saveAudio(test.body.audioUrl, dest);
      const legacyDir = path.join(OUT_LEGACY, p.id);
      fs.mkdirSync(legacyDir, { recursive: true });
      saveAudio(test.body.audioUrl, path.join(legacyDir, `test.${ext}`));
    }
    fs.mkdirSync(pairDir, { recursive: true });
    fs.writeFileSync(path.join(pairDir, "meta.json"), JSON.stringify(entry, null, 2), "utf-8");
    // also drop side copies next to each engine audio
    fs.writeFileSync(path.join(geminiDir, "meta.json"), JSON.stringify({
      id: p.id, side: "gemini-reference", text: p.text, ...entry.reference,
    }, null, 2), "utf-8");
    fs.writeFileSync(path.join(fishDir, "meta.json"), JSON.stringify({
      id: p.id, side: "fish-test", text: p.text, ...entry.test,
    }, null, 2), "utf-8");
    report.push(entry);
    console.log(
      `${p.id}: gemini=${entry.reference.ok}/${entry.reference.engine}${refIsTrueGemini ? "" : "(FALLBACK)"} fish=${entry.test.ok}/${entry.test.engine} saved=${entry.saved.gemini}/${entry.saved.fish}`,
    );
  }

  const summaryPath = path.join(OUT_ROOT, "SUMMARY.json");
  fs.writeFileSync(summaryPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: report.length,
    trueGeminiReferences: report.filter((r) => r.reference.isTrueGeminiReference).length,
    report,
  }, null, 2), "utf-8");
  console.log(`\nSummary → ${summaryPath}`);
  console.log("Fish:    benchmark/comparison/fish/<id>/audio.*");
  console.log("Gemini:  benchmark/comparison/gemini/<id>/audio.*");
  console.log("Errors:  fill docs/PRONUNCIATION_ERROR_REPORT.md → <id>/errors.json");
  const fails = report.filter((r) => !r.reference.ok || !r.test.ok);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
