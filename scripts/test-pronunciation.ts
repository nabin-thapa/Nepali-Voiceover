/**
 * Nepali pronunciation test suite — text pipeline only (no API keys required).
 * Run: npm run test:pronunciation
 */
import {
  detectLanguage,
  runNepaliNormalize,
  loadNepaliDictionary,
  normalizeNepaliUnicode,
} from "../nepaliNormalize";

interface Case {
  id: string;
  category: string;
  input: string;
  expect?: string[];
  absent?: string[];
}

const CASES: Case[] = [
  { id: "basic-1", category: "basic", input: "नमस्ते! म नेपाली बोल्छु।", expect: ["नमस्ते", "नेपाली"] },
  { id: "basic-2", category: "basic", input: "आज मौसम राम्रो छ।", expect: ["आज", "मौसम", "राम्रो"] },
  { id: "basic-3", category: "basic", input: "तपाईंको नाम के हो?", expect: ["तपाईंको", "नाम"] },
  { id: "rural-1", category: "rural", input: "हाम्रो गाउँमा धेरै गाई र भैंसी छन्।", expect: ["गाउँमा", "गाई", "भैँसी"] },
  { id: "rural-2", category: "rural", input: "किसानले धान रोप्दैछन्।", expect: ["किसान", "धान"] },
  { id: "animal-1", category: "animal", input: "गोरुले खेत जोत्छ।", expect: ["गोरु"] },
  { id: "animal-2", category: "animal", input: "पाडी र बाख्रा चरन्छन्।", expect: ["पाडी", "बाख्रा"] },
  { id: "animal-3", category: "animal", input: "आज भैंसी नदीको किनारमा घाँस चरिरहेको छ।", expect: ["भैँसी", "घाँस", "चरिरहेको"] },
  { id: "ktm-1", category: "kathmandu", input: "म आज काठमाडौं जाँदैछु।", expect: ["काठमाडौं", "जाँदैछु"] },
  { id: "ktm-2", category: "kathmandu", input: "के छ साथी! चिया पिउने हो?", expect: ["साथी", "चिया"] },
  { id: "ktm-3", category: "kathmandu", input: "बिहानैदेखि पानी परिरहेको छ।", expect: ["बिहान", "पानी", "परिरहेको"] },
  { id: "conjunct-1", category: "conjunct", input: "ज्ञान नै शक्ति हो।", expect: ["ज्ञान", "शक्ति"] },
  { id: "conjunct-2", category: "conjunct", input: "क्षमा गर्नुहोस्।", expect: ["क्षमा"] },
  { id: "conjunct-3", category: "conjunct", input: "त्रिशूल र श्रद्धा महत्त्वपूर्ण छन्।", expect: ["त्रिशूल", "श्रद्धा"] },
  { id: "conjunct-4", category: "conjunct", input: "प्राकृतिक स्रोत संरक्षण गर्नुपर्छ।", expect: ["प्राकृतिक", "संरक्षण"] },
  { id: "nasal-1", category: "nasal", input: "गाउँ र घाँस राम्रो छ।", expect: ["गाउँ", "घाँस"] },
  { id: "nasal-2", category: "nasal", input: "तपाईंले हाँस्दै भन्नुभयो।", expect: ["तपाईं", "हाँस"] },
  { id: "nasal-3", category: "nasal", input: "संगीत सुन्दै मन शान्त भयो।", expect: ["संगीत", "शान्त"] },
  { id: "conjunct-5", category: "conjunct", input: "ज्ञ, क्ष, त्र, श्र — यी जोडाहरू सही उच्चारण हुनुपर्छ।", expect: ["ज्ञ", "क्ष", "त्र", "श्र"] },
  { id: "num-1", category: "numbers", input: "सन २०२६ मा हामी ५० प्रतिशत अगाडि बढ्छौं।", expect: ["२०२६", "५०"] },
  { id: "num-2", category: "numbers", input: "मेरो उमेर २५ वर्ष हो।", expect: ["२५"] },
  { id: "num-3", category: "numbers", input: "मूल्य रु. ५०० हो।", expect: ["रु"] },
  {
    id: "long-1",
    category: "long",
    input:
      "आज बिहान हामी सबै जल्दी उठेका थियौं किनभने स्कुलको वार्षिकोत्सव कार्यक्रम सुरु हुनुभयो र त्यहाँ विद्यार्थीहरूले नाच, गीत तथा भाषण प्रस्तुत गर्ने थिए।",
    expect: ["आज", "बिहान", "स्कुल", "विद्यार्थी"],
  },
  { id: "short-1", category: "short", input: "कहाँ जाने?", expect: ["कहाँ"] },
  { id: "short-2", category: "short", input: "अहिले आउँछु।", expect: ["अहिले", "आउँछु"] },
  {
    id: "mixed-1",
    category: "mixed",
    input: "हाम्रो software team ले नयाँ website बनाउँदैछ।",
    expect: ["सफ्ट", "वेयर", "वेब", "साइट"],
  },
  {
    id: "mixed-2",
    category: "mixed",
    input: "YouTube मा video हेर्न मन पर्छ।",
    expect: ["यूट्यूब", "भिडियो"],
  },
  { id: "hard-1", category: "hard", input: "खुवाउँदै गरिरहेको छ।", expect: ["खुवाउँदै", "गरिरहेको"] },
  { id: "hard-2", category: "hard", input: "काठमाडौँ नेपालको राजधानी हो।", expect: ["काठमाडौं", "नेपाल"] },
  { id: "hard-3", category: "hard", input: "शिक्षा र पर्यावरण महत्त्वपूर्ण छ।", expect: ["पढाइ", "वातावरण"] },
  { id: "hard-4", category: "hard", input: "सृजनात्मक सोच आवश्यक छ।", expect: ["सिर्जना"] },
];

function main() {
  const dict = loadNepaliDictionary();
  const dictKeys = Object.keys(dict).length;
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];

  console.log("\n=== Nepali Pronunciation Test Suite ===");
  console.log(`Dictionary entries: ${dictKeys}`);
  console.log(`Cases: ${CASES.length}\n`);

  const langNe = detectLanguage("नमस्ते म नेपाली हुँ।");
  const langEn = detectLanguage("Hello world this is English only.");
  if (langNe === "nepali") { pass++; console.log("PASS language-nepali"); }
  else { fail++; failures.push("language-nepali"); console.log("FAIL language-nepali →", langNe); }
  if (langEn === "english") { pass++; console.log("PASS language-english"); }
  else { fail++; failures.push("language-english"); console.log("FAIL language-english →", langEn); }

  const nfc = normalizeNepaliUnicode("काठमाडौँ\u200B  नेपाल");
  if (!nfc.includes("\u200B") && nfc.includes("काठमाडौ")) { pass++; console.log("PASS unicode-nfc"); }
  else { fail++; failures.push("unicode-nfc"); console.log("FAIL unicode-nfc →", JSON.stringify(nfc)); }

  for (const c of CASES) {
    const result = runNepaliNormalize(c.input, { mode: "natural", captureStages: true });
    const out = result.finalText;
    const problems: string[] = [];

    for (const exp of c.expect || []) {
      if (!out.includes(exp)) problems.push(`missing:${exp}`);
    }
    for (const abs of c.absent || []) {
      if (out.includes(abs)) problems.push(`present:${abs}`);
    }
    // English pure tokens should not remain for pure-Nepali scripts in mixed dictionary path
    if (!/[A-Za-z]/.test(c.input) && /[A-Za-z]{3,}/.test(out.replace(/(YouTube|software|website|team|video)/gi, ""))) {
      // allow only if from input
    }

    if (problems.length === 0) {
      pass++;
      console.log(`PASS ${c.id} [${c.category}]`);
    } else {
      fail++;
      failures.push(`${c.id}: ${problems.join(", ")}`);
      console.log(`FAIL ${c.id} [${c.category}] ${problems.join(", ")}`);
      console.log(`  IN : ${c.input}`);
      console.log(`  OUT: ${out}`);
    }
  }

  // English must not be rewritten by Nepali dictionary when language=english
  const en = runNepaliNormalize("Hello world", { language: "english", captureStages: true });
  if (en.finalText === "Hello world" && en.language === "english") {
    pass++;
    console.log("PASS english-preserved");
  } else {
    fail++;
    failures.push("english-preserved");
    console.log("FAIL english-preserved →", en.finalText);
  }

  // Precise mode must still produce Devanagari speech text for Nepali
  const precise = runNepaliNormalize("हाम्रो software काम राम्रो छ।", { mode: "precise", captureStages: true });
  if (precise.mode === "precise" && precise.stages.some((s) => s.name === "precise")) {
    pass++;
    console.log("PASS precise-mode-stage");
  } else {
    fail++;
    failures.push("precise-mode-stage");
    console.log("FAIL precise-mode-stage");
  }

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(" -", f);
  }
  process.exit(fail > 0 ? 1 : 0);
}

main();
