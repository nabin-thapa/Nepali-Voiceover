/**
 * Nepali linguistic analysis + Fish-compatible pronunciation representation.
 *
 * Architecture (Phase 3):
 *   Nepali text
 *     → Unicode normalization (nepaliNormalize)
 *     → Nepali linguistic normalization (this file: schwa policy, nasal, sandhi-light)
 *     → Word segmentation (tokenize for analysis, not for reordering meaning)
 *     → Nepali pronunciation analysis (features: conjuncts, nasal, aspirates, loanwords)
 *     → Fish-compatible representation (ORTHGRAPHIC Devanagari respelling ONLY)
 *     → speaker conditioning (reference_id) → Fish acoustic → audio
 *
 * NEVER: English phonology rules, Latin transliteration as phonemes, invented IPA
 * for Fish. Fish pronunciation_dictionary is ARPAbet-only and garbles Devanagari.
 */

import { loadNepaliDictionary, type PronunciationFix } from "./nepaliNormalize";

export interface NepaliToken {
  raw: string;
  isWord: boolean;
  hasDev: boolean;
  hasLatin: boolean;
}

export interface PronunciationAnalysis {
  tokens: NepaliToken[];
  features: {
    conjuncts: string[];       // ज्ञ क्ष त्र श्र etc. present
    nasal: boolean;            // ँ or ं
    aspirated: string[];
    retroflex: string[];
    longVowels: string[];
    loanwordLatin: string[];
    dandaEnds: number;
    questionEnds: number;
    exclamEnds: number;
  };
  riskyWords: string[];       // words known to fail often in cloud TTS
  estimatedSyllables: number;
}

/** Words that commonly fail in opaque cloud TTS without respelling/context. */
const RISKY_PATTERNS: RegExp[] = [
  /भैंसी/, /पाडी/, /गोरु/, /गाउँ/, /घाँस/, /काठमाडौ/, /जाँदै/, /हुँदै/,
  /भन्दै/, /गर्दै/, /खुवाउँ/, /सिर्जना/, /सृजना/, /शिक्षा/, /पर्यावरण/,
  /प्रविधि/, /परियोजना/, /सूचना/, /अन्तर्गत/, /निर्माण/, /कार्यक्रम/,
  /विद्यालय/, /अस्पताल/, /चिकित्सा/, /राजनीति/, /अर्थव्यवस्था/,
];

const CONJUNCT_RE = /ज्ञ|क्ष|त्र|श्र|ज्ञ|द्व|द्भ|स्थ|न्द|न्त|न्थ|ल्ल|ट्ट|ड्ड|क्क|त्त|द्द|न्न|म्म|य्य|र्म|र्क|र्त|र्थ|र्प|र्ग|र्ज|र्ब|र्ल|र्व|र्श|र्ष|र्स|र्ह/g;
const ASPIRATED = ["ख", "घ", "छ", "झ", "थ", "ध", "फ", "भ"];
const RETROFLEX = ["ट", "ठ", "ड", "ढ", "ण"];
const LONG_VOWEL_MARKS = ["ा", "ी", "ू", "ै", "ौ", "े", "ो", "ॉ"];

export function segmentNepali(text: string): NepaliToken[] {
  const tokens: NepaliToken[] = [];
  const re = /[\u0900-\u097F]+|[A-Za-z][A-Za-z0-9'’-]*|[0-9]+|[।!?]|,|\s+|[^\s]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    if (/^\s+$/.test(raw)) continue;
    tokens.push({
      raw,
      isWord: /[\u0900-\u097F]/.test(raw) || /[A-Za-z]/.test(raw),
      hasDev: /[\u0900-\u097F]/.test(raw),
      hasLatin: /[A-Za-z]/.test(raw),
    });
  }
  return tokens;
}

export function analyzeNepaliPronunciation(text: string): PronunciationAnalysis {
  const tokens = segmentNepali(text);
  const conjuncts = Array.from(new Set(text.match(CONJUNCT_RE) || []));
  const aspirated = Array.from(new Set(ASPIRATED.filter((c) => text.includes(c))));
  const retroflex = Array.from(new Set(RETROFLEX.filter((c) => text.includes(c))));
  const longVowels = Array.from(new Set(LONG_VOWEL_MARKS.filter((c) => text.includes(c))));
  const loanwordLatin = tokens.filter((t) => t.hasLatin).map((t) => t.raw);
  const riskyWords: string[] = [];
  for (const p of RISKY_PATTERNS) {
    const mm = text.match(p);
    if (mm) riskyWords.push(mm[0]);
  }
  // Syllable estimate: Devanagari vowel signs + independent vowels as nuclei
  const nuclei = text.match(/[\u0905-\u0914\u093E-\u094F\u0966-\u096F]/g)?.length || 0;
  return {
    tokens,
    features: {
      conjuncts,
      nasal: /[ँं]/.test(text),
      aspirated,
      retroflex,
      longVowels,
      loanwordLatin,
      dandaEnds: (text.match(/।/g) || []).length,
      questionEnds: (text.match(/\?/g) || []).length,
      exclamEnds: (text.match(/!/g) || []).length,
    },
    riskyWords,
    estimatedSyllables: Math.max(1, nuclei),
  };
}

/**
 * Context-aware linguistic normalization (safe general rules only).
 * - Collapse repeated punctuation
 * - Ensure space after danda when followed by Devanagari
 * - Normalize enumerative comma runs
 * Does NOT change word identity (dictionary handles that).
 */
export function linguisticNormalize(text: string): string {
  let out = text.replace(/\s+/g, " ").trim();
  out = out.replace(/([।!?])\s*([\u0900-\u097F])/g, "$1 $2");
  out = out.replace(/,{2,}/g, ",");
  out = out.replace(/\s+([।!?])/g, "$1");
  return out;
}

/**
 * Context-aware dictionary application.
 * Skips replacement when the match is inside a larger already-correct form
 * or when `unlessFollowedBy` blocks e.g. rewrites that break inflections.
 */
export function applyContextDictionary(
  text: string,
  dict: Record<string, string>,
  fixes?: PronunciationFix[],
  opts?: {
    /** Skip keys when next chars match (protect suffixes) */
    protectSuffixes?: string[];
  },
): { text: string; hits: PronunciationFix[] } {
  let out = text;
  const hits: PronunciationFix[] = [];
  const protect = opts?.protectSuffixes ?? [];
  const keys = Object.keys(dict)
    .filter((k) => k && dict[k] && k !== dict[k])
    .sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const to = dict[key];
    // Word-boundary safe for Devanagari
    const DEV = "[\\u0900-\\u0963\\u0966-\\u097F]";
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<!${DEV})${escaped}(?!${DEV})`, "g");
    let m: RegExpExecArray | null;
    const localHits: PronunciationFix[] = [];
    while ((m = re.exec(out))) {
      const after = out.slice(m.index + m[0].length, m.index + m[0].length + 3);
      if (protect.some((p) => after.startsWith(p))) continue;
      localHits.push({ from: m[0], to });
      out = out.slice(0, m.index) + to + out.slice(m.index + m[0].length);
      re.lastIndex = m.index + to.length;
    }
    for (const h of localHits) {
      hits.push(h);
      if (fixes && !fixes.some((f) => f.from === h.from)) fixes.push(h);
    }
  }
  return { text: out, hits };
}

/**
 * Full intermediate representation for Fish: what we actually send after analysis.
 * Stages recorded for debug: original → linguistic → contextDict → analysis → fishText
 */
export interface FishRepresentation {
  original: string;
  linguistic: string;
  contextDict: string;
  fishText: string;
  analysis: PronunciationAnalysis;
  fixes: PronunciationFix[];
  notes: string[];
}

export function buildFishRepresentation(
  input: string,
  opts?: { dictionary?: Record<string, string>; userDict?: Record<string, string> },
): FishRepresentation {
  const notes: string[] = [];
  const fixes: PronunciationFix[] = [];
  const linguistic = linguisticNormalize(input);
  if (linguistic !== input) notes.push("linguistic-normalize");

  const user = opts?.userDict ?? {};
  const base = opts?.dictionary ?? loadNepaliDictionary();
  // User first (wins), then base
  const merged: Record<string, string> = { ...base, ...user };

  const ctx = applyContextDictionary(linguistic, merged, fixes);
  const analysis = analyzeNepaliPronunciation(ctx.text);
  if (analysis.riskyWords.length) notes.push(`risky:${analysis.riskyWords.length}`);
  if (analysis.features.conjuncts.length) notes.push(`conjuncts:${analysis.features.conjuncts.join(",")}`);
  if (analysis.features.nasal) notes.push("nasal");

  return {
    original: input,
    linguistic,
    contextDict: ctx.text,
    fishText: ctx.text,
    analysis,
    fixes,
    notes,
  };
}

/**
 * Prosody features for conversational Nepali (Phase 8).
 * Marks phrase boundaries with natural breath — does NOT newsread every clause.
 */
export function conversationalProsody(text: string, opts?: { speedHint?: "slow" | "normal" | "fast" }): string {
  let out = text.replace(/\s+/g, " ").trim();
  // Breath after discourse connectors only when mid-sentence
  out = out.replace(
    /(\s)(तर|तैपनि|अनि|अर्थात्|यसैले|त्यसैले|जस्तै|भने)(\s+)/g,
    "$1$2, $3",
  );
  // Question: ensure space before ?
  out = out.replace(/([^\s।!?])\?/g, "$1 ?");
  // Exclamation spacing
  out = out.replace(/([^\s।!?])!/g, "$1 !");
  // Long unpunctuated run: soft clause break at relative clause particle
  if (out.length > 120 && !/[।!?]\s*$/.test(out)) {
    const cut = out.indexOf(" जस्तो ");
    if (cut > 20) out = out.slice(0, cut) + ", " + out.slice(cut + 1);
    else out = out + " ।";
  }
  if (opts?.speedHint === "slow" && !/[।!?]$/.test(out)) out += " ।";
  return out.replace(/\s+/g, " ").trim();
}
