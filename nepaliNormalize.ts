/**
 * Nepali pronunciation preprocessing layer for Fish Audio s2.1 + Gemini ne-NP.
 *
 * Fish Audio cloud API has NO local tokenizer/IPA path for Nepali.
 * Official phoneme tags support only EN (CMU Arpabet), ZH (pinyin), JA (OpenJTalk).
 * Therefore dictionary values are ORTHOGRAPHIC Devanagari respellings — never fake IPA.
 *
 * Pipeline stages (debug mode captures each):
 *   input → languageDetect → unicodeNormalize → punctuation/whitespace
 *         → digits/symbols (server) → lexicon (server) → dictionary
 *         → precise/natural mode → prosody punctuation → fishInput
 */

import fs from "fs";
import path from "path";

export type LanguageHint = "auto" | "nepali" | "english";
export type PronunciationMode = "natural" | "precise";

export interface PronunciationFix {
  from: string;
  to: string;
}

export interface PipelineStage {
  name: string;
  text: string;
}

export interface PipelineResult {
  language: LanguageHint;
  mode: PronunciationMode;
  stages: PipelineStage[];
  finalText: string;
  dictionaryHits: PronunciationFix[];
}

const DEV = "[\\u0900-\\u0963\\u0966-\\u097F]";
const DEV_RUN = /[\u0900-\u097F]/g;

function devWordRe(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!${DEV})${escaped}(?!${DEV})`, "g");
}

/** Detect whether text is primarily Nepali (Devanagari), English/Latin, or mixed. */
export function detectLanguage(text: string, hint: LanguageHint = "auto"): LanguageHint {
  if (hint !== "auto") return hint;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const dev = (text.match(DEV_RUN) || []).length;
  if (dev === 0 && latin > 0) return "english";
  if (dev > 0) return "nepali";
  return "nepali";
}

/**
 * Devanagari Unicode + punctuation normalization.
 * - NFC (composition) so matras/chandrabindu compose consistently
 * - Map common lookalike punctuation to speech-safe forms
 * - Collapse whitespace / zero-width / nbsp
 * - Normalize danda variants (। U+0964, ॥ U+0965, |, ||)
 * Does NOT rewrite English words.
 */
export function normalizeNepaliUnicode(text: string): string {
  let out = text.normalize("NFC");
  // Zero-width + BOM + nbsp
  out = out.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ");
  // Curly quotes → straight (safe for both languages)
  out = out.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  // Em dash / en dash → comma-like pause (not spoken as hyphen junk)
  out = out.replace(/[\u2013\u2014]/g, ", ");
  // ASCII pipes used as danda stand-ins (only when Devanagari present)
  if (/[\u0900-\u097F]/.test(out)) {
    out = out.replace(/\|\|/g, "॥").replace(/\|/g, "।");
  }
  // Multiple dandas / spaces
  out = out.replace(/।{2,}/g, "।").replace(/\s+/g, " ").trim();
  // Chandrabindu compose variants already handled by NFC; no blind rewrite here.
  return out;
}

/** Load orthographic dictionary from nepali_pronunciation.json. */
export function loadNepaliDictionary(
  filePath = path.join(process.cwd(), "nepali_pronunciation.json"),
): Record<string, string> {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (raw && raw.entries && typeof raw.entries === "object" && !Array.isArray(raw.entries)) {
      return raw.entries as Record<string, string>;
    }
    if (Array.isArray(raw)) {
      const out: Record<string, string> = {};
      for (const e of raw) {
        if (e && typeof e.from === "string" && typeof e.to === "string") out[e.from] = e.to;
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Apply dictionary word → orthographic spoken form.
 * Longer keys first so multi-word entries win over bare words.
 */
export function applyNepaliDictionary(
  text: string,
  dict: Record<string, string>,
  fixes?: PronunciationFix[],
): { text: string; hits: PronunciationFix[] } {
  let out = text;
  const hits: PronunciationFix[] = [];
  const keys = Object.keys(dict)
    .filter((k) => k && dict[k] && k !== dict[k])
    .sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const to = dict[key];
    const re = devWordRe(key);
    const m = out.match(re);
    if (!m) continue;
    out = out.replace(re, to);
    const hit = { from: m[0], to };
    hits.push(hit);
    if (fixes && !fixes.some((f) => f.from === hit.from)) fixes.push(hit);
  }
  return { text: out, hits };
}

/**
 * Precise mode: extra syllable-friendly respellings for loanwords/conjuncts
 * that Fish often mis-splits. Natural mode only uses the dictionary + lexicon.
 */
const PRECISE_RULES: Array<{ from: string; to: string }> = [
  { from: "सफ्टवेयर", to: "सफ्ट वेयर" },
  { from: "हार्डवेयर", to: "हार्ड वेयर" },
  { from: "वेबसाइट", to: "वेब साइट" },
  { from: "इन्स्टाग्राम", to: "इन्स्टा ग्राम" },
  { from: "टेक्नोलोजी", to: "टेक्नो लोजी" },
  { from: "कम्प्युटर", to: "कम्प्यु टर" },
  { from: "इन्टरनेट", to: "इन्टर नेट" },
  { from: "मोबाइल", to: "मो बाइल" },
  { from: "यूट्यूब", to: "यू ट्यूब" },
  { from: "स्पोटिफाइ", to: "स्पो टि फाइ" },
  { from: "नेटफ्लिक्स", to: "नेट फ्लिक्स" },
  { from: "प्राकृतिक", to: "प्राकृतिक" },
  { from: "ज्ञान", to: "ज्ञान" },
  { from: "क्षमा", to: "क्षमा" },
  { from: "श्रद्धा", to: "श्रद्धा" },
  { from: "त्रिशूल", to: "त्रिशूल" },
];

export function applyPreciseMode(
  text: string,
  fixes?: PronunciationFix[],
): string {
  let out = text;
  for (const { from, to } of PRECISE_RULES) {
    if (from === to) continue;
    const re = devWordRe(from);
    const m = out.match(re);
    if (!m) continue;
    out = out.replace(re, to);
    if (fixes && !fixes.some((f) => f.from === m[0])) {
      fixes.push({ from: m[0], to });
    }
  }
  return out;
}

/** Known Latin loanwords/brands → Devanagari so Fish never applies English phonology. */
const LATIN_BRANDS: Record<string, string> = {
  software: "सफ्टवेयर",
  hardware: "हार्डवेयर",
  website: "वेबसाइट",
  youtube: "यूट्यूब",
  facebook: "फेसबुक",
  instagram: "इन्स्टाग्राम",
  whatsapp: "व्हाट्सएप",
  google: "गुगल",
  computer: "कम्प्युटर",
  internet: "इन्टरनेट",
  mobile: "मोबाइल",
  video: "भिडियो",
  photo: "फोटो",
  online: "अनलाइन",
  offline: "अफलाइन",
  email: "इमेल",
  password: "पासवर्ड",
  technology: "टेक्नोलोजी",
  team: "टोली",
  app: "एप",
  data: "डेटा",
  login: "लगइन",
  download: "डाउनलोड",
  upload: "अपलोड",
};

function convertKnownLatin(text: string): string {
  return text.replace(/[A-Za-z][A-Za-z0-9'’-]*/g, (tok) => {
    const hit = LATIN_BRANDS[tok.toLowerCase()];
    return hit ?? tok;
  });
}

/**
 * Light punctuation / sentence-boundary pass for natural prosody.
 * Does NOT insert a pause between every word.
 */
export function applyProsodyPunctuation(text: string): string {
  let out = text.replace(/\s+/g, " ").trim();
  if (!out) return out;

  // Breath commas after discourse particles (only when followed by more content)
  out = out.replace(
    /(\s)(पनि|चाहिँ|तर|तैपनि|अनि|अर्थात्|यानी|मतलब|जस्तै)(\s+)/g,
    "$1$2,",
  );

  // Soft-break very long unpunctuated runs at a natural clause particle
  const parts = out.split(/(?<=[।!?])\s+/);
  out = parts
    .map((seg) => {
      if (seg.length < 140 || /[।!?]\s*$/.test(seg)) return seg;
      const mid = Math.floor(seg.length / 2);
      const cut = seg.indexOf(" ", mid);
      if (cut > 0 && cut < seg.length - 12) {
        return `${seg.slice(0, cut)}, ${seg.slice(cut + 1)}`;
      }
      return seg;
    })
    .join(" ");

  // Question mark spacing: ensure space before ? if glued
  out = out.replace(/([^\s।!?])\?/g, "$1 ?");
  // Terminal punctuation
  if (!/[।!?]\s*$/.test(out)) out = `${out} ।`;
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Full Nepali-facing normalize layer used by the server.
 * `englishOnly` short-circuits to light cleanup so English is not force-rewritten.
 */
export function runNepaliNormalize(
  input: string,
  opts?: {
    language?: LanguageHint;
    mode?: PronunciationMode;
    dictionary?: Record<string, string>;
    extra?: (text: string) => string;
    captureStages?: boolean;
  },
): PipelineResult {
  const language = detectLanguage(input, opts?.language ?? "auto");
  const mode: PronunciationMode = opts?.mode === "precise" ? "precise" : "natural";
  const dict = opts?.dictionary ?? loadNepaliDictionary();
  const stages: PipelineStage[] = [];
  const dictHits: PronunciationFix[] = [];

  const push = (name: string, text: string) => {
    if (opts?.captureStages) stages.push({ name, text });
  };

  push("original", input);

  if (language === "english") {
    // Do not apply Nepali dictionary/respelling to pure English.
    const light = input.replace(/\s+/g, " ").trim();
    push("englishLight", light);
    return {
      language,
      mode,
      stages,
      finalText: light,
      dictionaryHits: [],
    };
  }

  let out = normalizeNepaliUnicode(input);
  push("unicodeNormalize", out);

  // Nepali script path: convert known Latin brands first so dictionary can respell them.
  out = convertKnownLatin(out);
  push("latinBrands", out);

  if (opts?.extra) {
    out = opts.extra(out);
    push("serverLexicon", out);
  }

  const dictResult = applyNepaliDictionary(out, dict, dictHits);
  out = dictResult.text;
  push("dictionary", out);

  if (mode === "precise") {
    out = applyPreciseMode(out, dictHits);
    push("precise", out);
  }

  out = applyProsodyPunctuation(out);
  push("prosody", out);
  push("fishInput", out);

  return {
    language,
    mode,
    stages,
    finalText: out,
    dictionaryHits: dictHits,
  };
}
