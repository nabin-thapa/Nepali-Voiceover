/**
 * End-to-end pronunciation audio tests against a running server.
 * Prereq: npm run dev  (http://localhost:3000)
 * Run: npm run test:audio
 *
 * Generates audio for 20+ Nepali sentences via Fish (unlimited) and verifies:
 * - HTTP 200 + audio payload
 * - no hard errors
 * - debug pipeline stages when requested
 */
const BASE = process.env.APP_URL || "http://localhost:3000";

interface Case {
  id: string;
  text: string;
  mode?: "native" | "unlimited";
}

const CASES: Case[] = [
  { id: "basic-1", text: "नमस्ते! म नेपाली बोल्छु।" },
  { id: "basic-2", text: "आज मौसम राम्रो छ।" },
  { id: "basic-3", text: "तपाईंको नाम के हो?" },
  { id: "rural-1", text: "हाम्रो गाउँमा धेरै गाई र भैंसी छन्।" },
  { id: "rural-2", text: "किसानले धान रोप्दैछन्।" },
  { id: "animal-1", text: "गोरुले खेत जोत्छ।" },
  { id: "animal-2", text: "पाडी र बाख्रा चरन्छन्।" },
  { id: "animal-3", text: "आज भैंसी नदीको किनारमा घाँस चरिरहेको छ।" },
  { id: "ktm-1", text: "म आज काठमाडौं जाँदैछु।", mode: "unlimited" },
  { id: "ktm-2", text: "के छ साथी! चिया पिउने हो?" },
  { id: "ktm-3", text: "बिहानैदेखि पानी परिरहेको छ।" },
  { id: "conjunct-1", text: "ज्ञान नै शक्ति हो।" },
  { id: "conjunct-2", text: "क्षमा गर्नुहोस्।" },
  { id: "conjunct-3", text: "त्रिशूल र श्रद्धा महत्त्वपूर्ण छन्।" },
  { id: "conjunct-4", text: "प्राकृतिक स्रोत संरक्षण गर्नुपर्छ।" },
  { id: "nasal-1", text: "गाउँ र घाँस राम्रो छ।" },
  { id: "nasal-2", text: "तपाईंले हाँस्दै भन्नुभयो।" },
  { id: "nasal-3", text: "संगीत सुन्दै मन शान्त भयो।" },
  { id: "long-1", text: "आज बिहान हामी सबै जल्दी उठेका थियौं किनभने स्कुलको वार्षिकोत्सव कार्यक्रम सुरु हुनुभयो।" },
  { id: "short-1", text: "कहाँ जाने?" },
  { id: "short-2", text: "अहिले आउँछु।" },
  { id: "mixed-1", text: "हाम्रो software काम राम्रो छ।", mode: "unlimited" },
  { id: "hard-1", text: "खुवाउँदै गरिरहेको छ।" },
  { id: "hard-2", text: "काठमाडौँ नेपालको राजधानी हो।", mode: "unlimited" },
  { id: "hard-3", text: "शिक्षा र पर्यावरण महत्त्वपूर्ण छ।" },
];

async function generate(c: Case, opts?: { debug?: boolean; pronunciation?: string }) {
  const res = await fetch(`${BASE}/api/tts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: c.text,
      voiceName: "Kore",
      mode: c.mode || "unlimited",
      tone: "conversational",
      speedWpm: 140,
      language: "nepali",
      pronunciation: opts?.pronunciation || "natural",
      debug: !!opts?.debug,
    }),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, body: j as any };
}

async function main() {
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  console.log("\n=== Audio Pronunciation Tests ===");
  console.log(`Server: ${BASE}`);
  console.log(`Cases: ${CASES.length}\n`);

  try {
    const health = await fetch(`${BASE}/api/health`);
    if (!health.ok) throw new Error("health failed");
  } catch (e: any) {
    console.error("Server not reachable. Start with: npm run dev");
    console.error(e.message);
    process.exit(1);
  }

  for (const c of CASES) {
    try {
      const { status, body } = await generate(c, { debug: c.id === "ktm-1" });
      const audioLen = typeof body.audioUrl === "string" ? body.audioUrl.length : 0;
      const problems: string[] = [];
      if (status !== 200) problems.push(`status=${status}`);
      if (!body.success) problems.push(`success=false`);
      if (audioLen < 1000) problems.push(`audio too small (${audioLen})`);
      if (body.error) problems.push(String(body.error).slice(0, 80));
      if (body.devanagariText && /[A-Za-z]{4,}/.test(body.devanagariText) && !/software|website|youtube/i.test(body.devanagariText)) {
        // allow rare brand leftovers; flag only dense Latin
        const latin = (body.devanagariText.match(/[A-Za-z]+/g) || []).join("").length;
        if (latin > 12) problems.push("latin leakage in spoken text");
      }
      if (c.id === "ktm-1") {
        if (!body.debug || !Array.isArray(body.debug.stages) || body.debug.stages.length < 3) {
          problems.push("missing debug stages");
        } else if (typeof body.debug.fishInput !== "string" || !body.debug.fishInput.includes("काठमाडौं")) {
          problems.push("debug.fishInput missing काठमाडौं");
        }
      }

      if (problems.length === 0) {
        pass++;
        console.log(`PASS ${c.id} engine=${body.engine} audio=${audioLen}`);
      } else {
        fail++;
        failures.push(`${c.id}: ${problems.join(", ")}`);
        console.log(`FAIL ${c.id} ${problems.join(", ")}`);
      }
    } catch (e: any) {
      fail++;
      failures.push(`${c.id}: ${e.message}`);
      console.log(`FAIL ${c.id} exception ${e.message}`);
    }
  }

  // One precise-mode generation
  try {
    const { status, body } = await generate(
      { id: "precise-1", text: "हाम्रो software काम राम्रो छ।", mode: "unlimited" },
      { pronunciation: "precise", debug: true },
    );
    if (status === 200 && body.success && (body.audioUrl || "").length > 1000 && body.pronunciation === "precise") {
      pass++;
      console.log("PASS precise-mode audio");
    } else {
      fail++;
      failures.push("precise-mode audio");
      console.log("FAIL precise-mode audio", status, body.pronunciation, body.error);
    }
  } catch (e: any) {
    fail++;
    failures.push(`precise-mode: ${e.message}`);
    console.log("FAIL precise-mode", e.message);
  }

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(" -", f);
  }
  process.exit(fail > 0 ? 1 : 0);
}

main();
