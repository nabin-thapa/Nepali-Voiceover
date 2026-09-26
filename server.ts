import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  detectLanguage,
  runNepaliNormalize,
  loadNepaliDictionary,
  type LanguageHint,
  type PronunciationMode,
  type PipelineStage,
} from "./nepaliNormalize";
import {
  analyzeNepaliPronunciation,
  buildFishRepresentation,
  conversationalProsody,
  linguisticNormalize,
} from "./nepaliPronounce";
import { encodeMsgpack } from "./msgpack-lite";
import { isMultiRefEnabled, loadReferenceSamples } from "./referenceAudio";

dotenv.config();

import { listEngines, getEngine, resolveEngineId } from "./src/engines/registry";

// Phase 12 — modular engine (does not replace Fish; optional alternative path)
const ENGINE_CONFIG_PATH = path.join(process.cwd(), "config", "tts-engines.json");
function loadEngineConfig(): {
  TTS_ENGINE: string;
  engines: Record<string, any>;
  fishMultiReference?: { enabled?: boolean; sampleDir?: string; maxSamples?: number };
} {
  try {
    if (fs.existsSync(ENGINE_CONFIG_PATH)) {
      const j = JSON.parse(fs.readFileSync(ENGINE_CONFIG_PATH, "utf-8"));
      if (j && typeof j.TTS_ENGINE === "string") return j;
    }
  } catch { /* fall through */ }
  return { TTS_ENGINE: "FISH_SPEECH", engines: {} };
}

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "60mb" }));

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Gemini API Native TTS Voices — primary quality engine (native Nepal pronunciation via ne-NP)
const GEMINI_VOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir"];
// Prefer the stable model first (3.1-flash-tts hits 429/503 on free tier often)
const GEMINI_TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview"];
const NEPALI_LANGUAGE_CODE = "ne-NP";

// Fish Audio voice mapping — unlimited draft engine (s2.1-pro-free)
const FISH_API_URL = "https://api.fish.audio/v1/tts";
const FISH_VOICES: Record<string, string> = {
  Kore: "1a2d516ee75d462fa8c2b379584853b9",   // सुमिना — female, clear, bright, professional
  Puck: "800b1c9835754e9a84fa158f8a065314",   // सन्तोष — young, energetic, friendly, animated
  Charon: "fdcceaa400994019884072a370a85f93",  // प्रकाश — deep, authoritative, serious, documentary
  Aoede: "0b530aa9adc244e493be0937955492b8",   // अनिता — female, warm, calm, storytelling
  Fenrir: "9b8a44a093f54e28a0669aed2ba294c4",  // राजेश — male, conversational, professional
};

/**
 * Fish S2: free-form English bracket "cues" are NOT treated as control tokens —
 * the model SPEAKS them aloud as a preamble before the script. Never inject
 * instructional tags into the Fish text field. Style/pronunciation steering for
 * Fish goes through (1) pure Devanagari script from the Kathmandu director rewrite,
 * (2) lexicon/prepareSpeechText, (3) prosody/temperature payload fields only.
 */

/** Cache Kathmandu director rewrites (text model is quota-limited). */
const directorRewriteCache = new Map<string, string>();
const DIRECTOR_REWRITE_CACHE_MAX = 40;

/**
 * Kathmandu director phonetic rewrite — forces pure मानक नेपाली (Nepal)
 * spoken forms before any TTS engine speaks. CRITICAL: output must be
 * PURE spoken Devanagari only — no English, no brackets, no stage directions.
 */
function buildKathmanduDirectorPrompt(rawInput: string, tone: string, forClone: boolean): string {
  const engineLine = forClone
    ? `6. CLONE/FISH PRIORITY: The voice is a personal clone on Fish Audio. Your rewrite is the ONLY chance to force pure मानक नेपाली phonology. Respell any word so a Kathmandu native says it exactly right. Prefer everyday Kathmandu spoken forms over Sanskritized spellings. Split awkward loanword clusters into speakable syllables (सफ्ट वेयर not सफ्टवेयर when clearer). Keep meaning identical. Match Gemini's native ne-NP Kathmandu voice quality.`
    : `6. Output must sound identical to Gemini's native ne-NP Kathmandu voice when spoken aloud.`;
  return `You are an expert native Nepali Voiceover Artist and Kathmandu TTS Director (काठमाडौँ/मानक नेपाली).
This project is for NATIVE NEPALI ONLY. Rewrite the input into pure spoken मानक नेपाली (Nepal) for PERFECT Kathmandu pronunciation when read aloud.

INPUT:
"${rawInput}"

Rules:
1. Pure spoken Kathmandu-standard Devanagari — मानक नेपाली of Nepal only. Convert Romanized Nepali if present. Never leave non-Nepali word forms in the output.
2. Expand ALL digits to Nepali words (2026 → दुई हजार छब्बीस, 50% → पच्स प्रतिशत).
3. Everyday Kathmandu Nepali word forms only: तपाईं, धेरै, तर, सुरु, यो, त्यो, होइन, बिहान, साँझ, चिया, तरकारी, म, तिमी, के, कसरी.
4. Normalize chandrabindu/anusvara to forms TTS nasalizes correctly (काठमाडौं not काठमाडौँ when the engine misreads ऽ).
5. Add speech punctuation only (commas for breath, । ? for ends). No stage directions, no English, no non-Nepali words.
6. Same meaning and approximate length — pronunciation rewrite, not content rewrite.
7. HARD CONSTRAINT on devanagariText: ONLY the words to be spoken, pure Devanagari. No English, no [brackets], no quotes, no labels, no director notes inside the spoken string.
8. PHONETIC RESPELLING: Respell any word so a Kathmandu news anchor would say it correctly (right vowel length, light aspirates, correct schwa).
${engineLine}
${tone !== "auto" ? `Delivery tone for notes: ${tone}.` : ""}

Respond ONLY with valid JSON:
{
  "devanagariText": "Pure मानक नेपाली spoken script ready for TTS — Devanagari spoken words only",
  "directorNotes": "1-2 sentences (UI only, never spoken): cadence/pauses + hard words and how a Kathmandu native says them",
  "detectedTone": "informational" | "storytelling" | "conversational"
}`;
}

/** Remove any leftover bracket tags / English instruction fragments from Fish spoken text. */
function scrubFishSpokenText(text: string): string {
  let out = text;
  // Drop [tag] … [/tag] style control + emotion markers (never speak them)
  out = out.replace(/\[\/?[^\]]{1,200}\]/g, " ");
  // Drop leftover English instruction words if any slipped in
  out = out.replace(/\b(do not|do NOT|speak only|TRANSCRIPT|BEGIN|END|director'?s? notes)\b/gi, " ");
  // Fish must speak pure Devanagari — strip any remaining Latin tokens (labels, English)
  // after lexicon/transliteration has already converted real loanwords.
  if (/[\u0900-\u097F]/.test(out)) {
    out = out.replace(/[A-Za-z][A-Za-z0-9'’-]*/g, " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

// ── Local pronunciation / text prep (runs before any TTS engine) ──────────

/** Strip frontend emotion tags [TAG]…[/TAG] so engines never speak them literally. */
function stripEmotionTags(text: string): string {
  return text
    .replace(/\[\/?[A-Za-z][A-Za-z0-9_]{1,60}\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** PCM-level checks for a WAV buffer (16-bit LE). Non-WAV or malformed → empty warnings. */
function validateReferencePcm(buf: Buffer): string[] {
  const warnings: string[] = [];
  if (buf.length < 44) return warnings;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    return warnings;
  }
  // Find fmt chunk
  let offset = 12;
  let sampleRate = 0;
  let bitsPerSample = 16;
  let audioFormat = 1;
  let dataStart = -1;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      audioFormat = buf.readUInt16LE(offset + 8);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
    } else if (id === "data") {
      dataStart = offset + 8;
      dataSize = Math.min(size, buf.length - dataStart);
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataStart < 0 || sampleRate === 0) return warnings;
  if (sampleRate < 16000) {
    warnings.push(`Sample rate ${sampleRate} Hz is low for cloning — prefer 44100 Hz WAV when possible.`);
  }
  if (bitsPerSample !== 16 || audioFormat !== 1) {
    return warnings; // only analyze PCM16
  }
  const samples = Math.floor(dataSize / 2);
  if (samples < 100) {
    warnings.push("Audio data is extremely short — check the recording.");
    return warnings;
  }
  let peak = 0;
  let sumSq = 0;
  let silentRun = 0;
  let maxSilentRun = 0;
  const step = Math.max(1, Math.floor(samples / 50000));
  for (let i = 0; i < samples; i += step) {
    const s = buf.readInt16LE(dataStart + i * 2);
    const a = Math.abs(s);
    if (a > peak) peak = a;
    sumSq += (s / 32768) * (s / 32768);
    if (a < 200) {
      silentRun++;
      if (silentRun > maxSilentRun) maxSilentRun = silentRun;
    } else {
      silentRun = 0;
    }
  }
  const rms = Math.sqrt(sumSq / Math.ceil(samples / step));
  if (peak >= 32767) {
    warnings.push("Possible clipping (peak at full scale) — lower recording gain.");
  }
  if (rms < 0.01) {
    warnings.push("Recording may be too quiet or mostly silence — speak closer to the mic.");
  }
  if (maxSilentRun > Math.ceil(samples / step) * 0.5) {
    warnings.push("Large silent region detected — trim long pauses from the sample.");
  }
  return warnings;
}

/** Expand ASCII digits to spoken Nepali words (no Gemini call needed). */
function expandDigitsToNepali(text: string): string {
  // Full 0–99 Kathmandu-standard forms (compound words required — tens+ones sounds wrong)
  const N0_99 = [
    "शून्य","एक","दुई","तीन","चार","पाँच","छ","सात","आठ","नौ",
    "दस","एघार","बाह्र","तेह्र","चौध","पन्ध्र","सोह्र","सत्र","अठार","उन्नाईस",
    "बीस","एक्काइस","बाइस","तेइस","चौविस","पच्चीस","छब्बीस","सत्ताइस","अट्ठाइस","उन्नाइस",
    "तीस","एकत्तीस","बत्तीस","तेत्तीस","चौंतीस","पैंतीस","छत्तीस","सैंतीस","अडत्तीस","उननचालीस",
    "चालीस","एकचालीस","बयालीस","तैंतालीस","चवालीस","पैंतालीस","छियालीस","सैंतालीस","अडचालीस","उननचास",
    "पचास","एकान्नाइस","बाह्रान्नाइस","त्रिपन्नाइस","चौवन्नाइस","पचपन्नाइस","छपन्नाइस","सन्तान्नाइस","अठान्नाइस","उननसाठी",
    "साठी","एकसाठी","बासठी","तिरसठी","चौंसठी","पैंसठी","छियसठी","सड्सठी","अड्सठी","उननसत्तरी",
    "सत्तरी","एकहत्तरी","बहत्तरी","तिहत्तरी","चौहत्तरी","पचहत्तरी","छहत्तरी","सतहत्तरी","अठहत्तरी","उननासी",
    "असी","एकासी","बयासी","तिरासी","चौरासी","पचासी","छयासी","सतासी","अठासी","उननब्बे",
    "नब्बे","एकान्नब्बे","बान्नब्बे","तिरान्नब्बे","चौरान्नब्बे","पंचान्नब्बे","छयान्नब्बे","सन्तान्नब्बे","अन्नब्बे","निरान्नब्बे",
  ];
  const HUNDREDS = ["","एक सय","दुई सय","तीन सय","चार सय","पाँच सय","छ सय","सात सय","आठ सय","नौ सय"];

  const under100 = (n: number): string => N0_99[n] ?? String(n);
  const under1000 = (n: number): string => {
    if (n < 100) return under100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    return r ? `${HUNDREDS[h]} ${under100(r)}` : HUNDREDS[h];
  };
  const toNepaliNumber = (n: number): string => {
    if (n < 1000) return under1000(n);
    if (n < 100000) {
      const thousands = Math.floor(n / 1000);
      const rest = n % 1000;
      const th = thousands === 1 ? "एक हजार" : thousands === 2 ? "दुई हजार" : `${under1000(thousands)} हजार`;
      return rest ? `${th} ${under1000(rest)}` : th;
    }
    if (n < 10000000) {
      const lakhs = Math.floor(n / 100000);
      const rest = n % 100000;
      const lh = lakhs === 1 ? "एक लाख" : lakhs === 2 ? "दुई लाख" : `${under1000(lakhs)} लाख`;
      if (!rest) return lh;
      if (rest < 1000) return `${lh} ${under1000(rest)}`;
      const thousands = Math.floor(rest / 1000);
      const restK = rest % 1000;
      const th = thousands === 1 ? "एक हजार" : `${under1000(thousands)} हजार`;
      return restK ? `${lh} ${th} ${under1000(restK)}` : `${lh} ${th}`;
    }
    return String(n).split("").map((d) => N0_99[Number(d)]).join(" ");
  };

  const digitsToWords = (digits: string): string =>
    digits.split("").map((d) => N0_99[Number(d)] ?? d).join(" ");

  let out = text;
  // Currency before bare integers (रु. 500 / Rs.500 / NPR 1000)
  out = out.replace(/(?:रु\.?|Rs\.?|NPR)\s*(\d+(?:\.\d+)?)/gi, (_, n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return n;
    if (n.includes(".")) {
      const [i, d] = n.split(".");
      return `${toNepaliNumber(Number(i))} दशमलव ${digitsToWords(d)} रुपैयाँ`;
    }
    return `${toNepaliNumber(num)} रुपैयाँ`;
  });
  // Decimals before bare integers (3.5 → तीन दशमलव पाँच) — period must not survive into danda pass
  out = out.replace(/(\d+)\.(\d+)/g, (_, i, d) =>
    `${toNepaliNumber(Number(i))} दशमलव ${digitsToWords(d)}`);
  out = out.replace(/(\d+)\s*%/g, (_, n) => `${toNepaliNumber(Number(n))} प्रतिशत`);
  out = out.replace(/\b\d+\b/g, (m) => {
    const n = Number(m);
    if (!Number.isFinite(n)) return m;
    if (m.length > 9) return digitsToWords(m);
    return toNepaliNumber(n);
  });
  return out;
}

/** Symbols that TTS reads letter-by-letter — expand or remove before speech. */
function cleanSymbolsForSpeech(text: string): string {
  return text
    .replace(/&/g, " र ")
    .replace(/@/g, " एट ")
    .replace(/#/g, " ")
    .replace(/\+/g, " प्लस ")
    .replace(/=/g, " बराबर ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/www\.\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Symbol-safe Devanagari word boundary (avoids matching inside larger words).
 * Excludes danda/॥ (U+0964/U+0965) so matches work at sentence ends.
 */
function devWordRe(word: string): RegExp {
  const DEV = "[\\u0900-\\u0963\\u0966-\\u097F]";
  return new RegExp(`(?<!${DEV})${word}(?!${DEV})`, "g");
}

/**
 * Natural speech punctuation: long unpunctuated runs sound rushed/robotic.
 * - Ensure terminal punctuation (।) at end
 * - Insert breath commas after common Nepali clause particles in long stretches
 * - Soft-break very long sentences so Fish keeps natural Nepali intonation
 */
function ensureSpeechPunctuation(text: string): string {
  let out = text.replace(/\s+/g, " ").trim();
  if (!out) return out;

  // Breath commas after discourse particles when followed by more content
  const particle = /(\s)(पनि|चाहिँ|तर|तैपनि|अनि|अर्थात्|यानी|मतलब|जस्तै|जस्तै कि)(\s+)/g;
  out = out.replace(particle, "$1$2,");

  // Soft-break runs > ~120 chars with no terminator → insert comma at nearest space past midpoint
  const parts = out.split(/(?<=[।!?])\s+/);
  out = parts
    .map((seg) => {
      if (seg.length < 120 || /[।!?]\s*$/.test(seg)) return seg;
      const mid = Math.floor(seg.length / 2);
      // Prefer a space after midpoint
      const cut = seg.indexOf(" ", mid);
      if (cut > 0 && cut < seg.length - 10) {
        return `${seg.slice(0, cut)}, ${seg.slice(cut + 1)}`;
      }
      return seg;
    })
    .join(" ");

  if (!/[।!?]\s*$/.test(out)) out = `${out} ।`;
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Built-in pronunciation lexicon: forces pure मानक नेपाली (Nepal) spoken forms.
 * If non-Nepali Devanagari somehow reaches the script, it is converted to
 * standard Kathmandu Nepali — never spoken as-is.
 * User overrides from pronunciation.json are merged on top at runtime.
 */
const PRONUNCIATION_LEXICON: Array<{ re: RegExp; fix: string }> = [
  // Non-Nepali auxiliaries / progressive / ability phrases FIRST (before single-word
  // rules can break them). Use Devanagari-safe boundaries — JS \b does not work
  // on U+0900–U+097F.
  // (local safety net when director LLM rewrite is quota-blocked)
  { re: devWordRe("लिख रहा हूँ"), fix: "लेखिरहेको छु" },
  { re: devWordRe("लिख रही हूँ"), fix: "लेखिरहेको छु" },
  { re: devWordRe("लिख रहा है"), fix: "लेखिरहेको छ" },
  { re: devWordRe("लिख रहे हैं"), fix: "लेखिरहेका छन्" },
  { re: devWordRe("रहा हूँ"), fix: "रहेको छु" },
  { re: devWordRe("रही हूँ"), fix: "रहेको छु" },
  { re: devWordRe("रहा है"), fix: "रहेको छ" },
  { re: devWordRe("रही है"), fix: "रहेको छ" },
  { re: devWordRe("रहे हैं"), fix: "रहेका छन्" },
  { re: devWordRe("सकते हैं"), fix: "सक्छन्" },
  { re: devWordRe("सकता हूँ"), fix: "सक्छु" },
  { re: devWordRe("सकती हूँ"), fix: "सक्छु" },
  { re: devWordRe("सकता है"), fix: "सक्छ" },
  { re: devWordRe("सकती है"), fix: "सक्छ" },
  { re: devWordRe("चाहता हूँ"), fix: "चाहन्छु" },
  { re: devWordRe("चाहती हूँ"), fix: "चाहन्छु" },
  { re: devWordRe("चाहता है"), fix: "चाहन्छ" },
  { re: devWordRe("चाहती है"), fix: "चाहन्छ" },
  { re: devWordRe("चाहते हैं"), fix: "चाहन्छन्" },
  { re: devWordRe("करता हूँ"), fix: "गर्छु" },
  { re: devWordRe("करती हूँ"), fix: "गर्छु" },
  { re: devWordRe("करता है"), fix: "गर्छ" },
  { re: devWordRe("करती है"), fix: "गर्छ" },
  { re: devWordRe("करते हैं"), fix: "गर्छन्" },
  { re: devWordRe("बोलता है"), fix: "बोल्छ" },
  { re: devWordRe("बोलती है"), fix: "बोल्छ" },
  { re: devWordRe("बोलते हैं"), fix: "बोल्छन्" },
  { re: devWordRe("जाता है"), fix: "जान्छ" },
  { re: devWordRe("जाती है"), fix: "जान्छ" },
  { re: devWordRe("जाते हैं"), fix: "जान्छन्" },
  { re: devWordRe("आता है"), fix: "आउँछ" },
  { re: devWordRe("आती है"), fix: "आउँछ" },
  { re: devWordRe("आते हैं"), fix: "आउँछन्" },
  { re: devWordRe("रहना है"), fix: "रहनु छ" },
  { re: devWordRe("करना है"), fix: "गर्नु छ" },
  { re: devWordRe("जाना है"), fix: "जानु छ" },
  { re: devWordRe("आना है"), fix: "आउनु छ" },
  { re: devWordRe("देना है"), fix: "दिनु छ" },
  { re: devWordRe("लेना है"), fix: "लिनु छ" },
  // Multi-word चाहिए phrases MUST precede bare चाहिए (left-to-right apply)
  { re: devWordRe("होना चाहिए"), fix: "हुनुपर्छ" },
  { re: devWordRe("करना चाहिए"), fix: "गर्नुपर्छ" },
  { re: devWordRe("जाना चाहिए"), fix: "जानुपर्छ" },
  { re: devWordRe("देखना चाहिए"), fix: "हेर्नुपर्छ" },
  { re: devWordRe("सुनना चाहिए"), fix: "सुन्नुपर्छ" },
  { re: devWordRe("लिखना चाहिए"), fix: "लेख्नुपर्छ" },
  { re: devWordRe("पढ़ना चाहिए"), fix: "पढ्नुपर्छ" },
  { re: devWordRe("चाहिए था"), fix: "चाहिएको थियो" },
  { re: devWordRe("चाहिए"), fix: "चाहिन्छ" },
  { re: devWordRe("सकते हो"), fix: "सक्छौ" },
  { re: devWordRe("सकते हों"), fix: "सक्छौ" },
  { re: devWordRe("करते हो"), fix: "गर्छौ" },
  { re: devWordRe("जाते हो"), fix: "जान्छौ" },
  { re: devWordRe("बोलते हो"), fix: "बोल्छौ" },
  { re: devWordRe("बोलते हों"), fix: "बोल्छौ" },
  { re: devWordRe("जाता हूँ"), fix: "जान्छु" },
  { re: devWordRe("जाती हूँ"), fix: "जान्छु" },
  { re: devWordRe("आता हूँ"), fix: "आउँछु" },
  { re: devWordRe("आती हूँ"), fix: "आउँछु" },
  { re: devWordRe("बोलता हूँ"), fix: "बोल्छु" },
  { re: devWordRe("कर रहा हूँ"), fix: "गरिरहेको छु" },
  { re: devWordRe("कर रही हूँ"), fix: "गरिरहेको छु" },
  { re: devWordRe("कर रहा है"), fix: "गरिरहेको छ" },
  { re: devWordRe("कर रही है"), fix: "गरिरहेको छ" },
  { re: devWordRe("कर रहे हैं"), fix: "गरिरहेका छन्" },
  { re: devWordRe("कर रहे हो"), fix: "गरिरहेका छौ" },
  { re: devWordRe("कर रहे हों"), fix: "गरिरहेका छौ" },
  { re: devWordRe("जा रहा हूँ"), fix: "जाइरहेको छु" },
  { re: devWordRe("जा रहा है"), fix: "जाइरहेको छ" },
  { re: devWordRe("जा रहे हैं"), fix: "जाइरहेका छन्" },
  { re: devWordRe("आ रहा हूँ"), fix: "आइरहेको छु" },
  { re: devWordRe("आ रहा है"), fix: "आइरहेको छ" },
  { re: devWordRe("आ रहे हैं"), fix: "आइरहेका छन्" },
  { re: devWordRe("रहा हो"), fix: "रहेको" },
  { re: devWordRe("रही हो"), fix: "रहेको" },
  { re: devWordRe("पढ़ रहा हूँ"), fix: "पढिरहेको छु" },
  { re: devWordRe("पढ़ रहा है"), fix: "पढिरहेको छ" },
  { re: devWordRe("पढ़ रहे हैं"), fix: "पढिरहेका छन्" },
  { re: devWordRe("देख रहा हूँ"), fix: "हेरिरहेको छु" },
  { re: devWordRe("देख रहा है"), fix: "हेरिरहेको छ" },
  { re: devWordRe("देख रहे हैं"), fix: "हेरिरहेका छन्" },
  { re: devWordRe("सुन रहा हूँ"), fix: "सुनिरहेको छु" },
  { re: devWordRe("सुन रहा है"), fix: "सुनिरहेको छ" },
  { re: devWordRe("सुन रहे हैं"), fix: "सुनिरहेका छन्" },
  { re: devWordRe("लिख रहा"), fix: "लेखिरहेको" },
  { re: devWordRe("लिख रही"), fix: "लेखिरहेको" },
  { re: devWordRe("गया है"), fix: "गएको छ" },
  { re: devWordRe("गई है"), fix: "गएको छ" },
  { re: devWordRe("गए हैं"), fix: "गएका छन्" },
  { re: devWordRe("आया है"), fix: "आएको छ" },
  { re: devWordRe("आई है"), fix: "आएको छ" },
  { re: devWordRe("आए हैं"), fix: "आएका छन्" },
  { re: devWordRe("किया है"), fix: "गरेको छ" },
  { re: devWordRe("की है"), fix: "गरेको छ" },
  { re: devWordRe("किए हैं"), fix: "गरेका छन्" },
  { re: devWordRe("लिखा है"), fix: "लेखेको छ" },
  { re: devWordRe("लिखी है"), fix: "लेखेको छ" },
  { re: devWordRe("लिखे हैं"), fix: "लेखेका छन्" },
  { re: devWordRe("बोला है"), fix: "भनेको छ" },
  { re: devWordRe("बोली है"), fix: "भनेको छ" },
  { re: devWordRe("बोले हैं"), fix: "भनेका छन्" },
  { re: devWordRe("हुआ है"), fix: "भएको छ" },
  { re: devWordRe("हुई है"), fix: "भएको छ" },
  { re: devWordRe("हुए हैं"), fix: "भएका छन्" },
  { re: devWordRe("मिल गया"), fix: "भेटियो" },
  { re: devWordRe("मिल गई"), fix: "भेटियो" },
  { re: devWordRe("मिल गए"), fix: "भेटे" },
  { re: devWordRe("हो गया"), fix: "भयो" },
  { re: devWordRe("हो गई"), fix: "भयो" },
  { re: devWordRe("हो गए"), fix: "भए" },
  { re: devWordRe("कर दिया"), fix: "गरिदियो" },
  { re: devWordRe("कर दी"), fix: "गरिदियो" },
  { re: devWordRe("कर दिए"), fix: "गरिदिए" },
  { re: devWordRe("ले लिया"), fix: "लियो" },
  { re: devWordRe("ले ली"), fix: "लियो" },
  { re: devWordRe("ले लिए"), fix: "लिए" },
  { re: devWordRe("दे दिया"), fix: "दिइदियो" },
  { re: devWordRe("दे दी"), fix: "दिइदियो" },
  { re: devWordRe("दे दिए"), fix: "दिइदिए" },
  { re: devWordRe("था"), fix: "थियो" },
  { re: devWordRe("थी"), fix: "थियो" },
  { re: devWordRe("थे"), fix: "थिए" },
  { re: devWordRe("था।"), fix: "थियो।" },
  { re: devWordRe("थी।"), fix: "थियो।" },
  { re: devWordRe("थे।"), fix: "थिए।" },
  { re: devWordRe("होगा"), fix: "हुनेछ" },
  { re: devWordRe("होगी"), fix: "हुनेछ" },
  { re: devWordRe("होंगे"), fix: "हुनेछन्" },
  { re: devWordRe("करेगा"), fix: "गर्नेछ" },
  { re: devWordRe("करेगी"), fix: "गर्नेछ" },
  { re: devWordRe("करेंगे"), fix: "गर्नेछन्" },
  { re: devWordRe("जाएगा"), fix: "जानेछ" },
  { re: devWordRe("जाएगी"), fix: "जानेछ" },
  { re: devWordRe("जाएंगे"), fix: "जानेछन्" },
  { re: devWordRe("आएगा"), fix: "आउनेछ" },
  { re: devWordRe("आएगी"), fix: "आउनेछ" },
  { re: devWordRe("आएंगे"), fix: "आउनेछन्" },
  { re: devWordRe("बोलेगा"), fix: "बोल्नेछ" },
  { re: devWordRe("बोलेगी"), fix: "बोल्नेछ" },
  { re: devWordRe("बोलेंगे"), fix: "बोल्नेछन्" },
  { re: devWordRe("सकेगा"), fix: "सक्नेछ" },
  { re: devWordRe("सकेगी"), fix: "सक्नेछ" },
  { re: devWordRe("सकेंगे"), fix: "सक्नेछन्" },
  { re: devWordRe("चाहेगा"), fix: "चाहनेछ" },
  { re: devWordRe("चाहेगी"), fix: "चाहनेछ" },
  { re: devWordRe("चाहेंगे"), fix: "चाहनेछन्" },
  { re: devWordRe("रहेगा"), fix: "रहनेछ" },
  { re: devWordRe("रहेगी"), fix: "रहनेछ" },
  { re: devWordRe("रहेंगे"), fix: "रहनेछन्" },
  { re: devWordRe("लिखेगा"), fix: "लेख्नेछ" },
  { re: devWordRe("लिखेगी"), fix: "लेख्नेछ" },
  { re: devWordRe("लिखेंगे"), fix: "लेख्नेछन्" },
  { re: devWordRe("है।"), fix: "हो।" },
  { re: devWordRe("हैं।"), fix: "छन्।" },
  { re: devWordRe("था?"), fix: "थियो?" },
  { re: devWordRe("होगा?"), fix: "हुनेछ?" },

  // Chandrabindu forms engines often nasalize wrong → standard Nepali spellings
  { re: devWordRe("काठमाडौँ"), fix: "काठमाडौं" },
  { re: devWordRe("लालितपुर"), fix: "ललितपुर" },
  { re: devWordRe("गाँव"), fix: "गाउँ" },
  { re: devWordRe("गाँवहरू"), fix: "गाउँहरू" },

  // Formal-Sanskrit / non-Nepali register → everyday Kathmandu Nepali
  { re: devWordRe("आपका"), fix: "तपाईंको" },
  { re: devWordRe("आपकी"), fix: "तपाईंको" },
  { re: devWordRe("आपके"), fix: "तपाईंको" },
  { re: devWordRe("आपने"), fix: "तपाईंले" },
  { re: devWordRe("आपसे"), fix: "तपाईंसँग" },
  { re: devWordRe("आप"), fix: "तपाईं" },
  { re: devWordRe("बहुत"), fix: "धेरै" },
  { re: devWordRe("बहुतै"), fix: "धेरै" },
  { re: devWordRe("लेकिन"), fix: "तर" },
  { re: devWordRe("किन्तु"), fix: "तर" },
  { re: devWordRe("परन्तु"), fix: "तर" },
  { re: devWordRe("इसलिए"), fix: "त्यसैले" },
  { re: devWordRe("अतः"), fix: "त्यसैले" },
  { re: devWordRe("कैसे"), fix: "कसरी" },
  { re: devWordRe("कैसा"), fix: "कस्तो" },
  { re: devWordRe("कैसी"), fix: "कस्ती" },
  { re: devWordRe("क्यों"), fix: "किन" },
  { re: devWordRe("अभी"), fix: "अहिले" },
  { re: devWordRe("मैंने"), fix: "मैले" },
  { re: devWordRe("तुमने"), fix: "तिमीले" },
  { re: devWordRe("मुझे"), fix: "मलाई" },
  { re: devWordRe("मुझको"), fix: "मेरो" },
  { re: devWordRe("मुझसे"), fix: "मबाट" },
  { re: devWordRe("तुमको"), fix: "तिमीको" },
  { re: devWordRe("तुमसे"), fix: "तिमीसँग" },
  { re: devWordRe("तुम्हें"), fix: "तिमीलाई" },
  { re: devWordRe("तुम"), fix: "तिमी" },
  { re: devWordRe("हमारा"), fix: "हाम्रो" },
  { re: devWordRe("हमारी"), fix: "हाम्रो" },
  { re: devWordRe("हमारे"), fix: "हाम्रो" },
  { re: devWordRe("हमसे"), fix: "हामीसँग" },
  { re: devWordRe("हम"), fix: "हामी" },
  { re: devWordRe("मैं"), fix: "म" },
  { re: devWordRe("मेरा"), fix: "मेरो" },
  { re: devWordRe("मेरी"), fix: "मेरो" },
  { re: devWordRe("मेरे"), fix: "मेरो" },
  { re: devWordRe("तू"), fix: "तिमी" },
  { re: devWordRe("तुम"), fix: "तिमी" },
  { re: devWordRe("उसने"), fix: "उसले" },
  { re: devWordRe("उसका"), fix: "त्यसको" },
  { re: devWordRe("उसी"), fix: "त्यसै" },
  { re: devWordRe("इसका"), fix: "यसको" },
  { re: devWordRe("इसी"), fix: "यसै" },
  { re: devWordRe("क्या"), fix: "के" },
  { re: devWordRe("वहाँ"), fix: "त्यहाँ" },
  { re: devWordRe("इसमें"), fix: "यसमा" },
  { re: devWordRe("उसमें"), fix: "त्यसमा" },
  { re: devWordRe("मुझे"), fix: "मलाई" },
  { re: devWordRe("मुझको"), fix: "मेरो" },
  { re: devWordRe("मुझसे"), fix: "मबाट" },
  { re: devWordRe("मैंने"), fix: "मैले" },
  { re: devWordRe("तुमने"), fix: "तिमीले" },
  { re: devWordRe("तुम्हें"), fix: "तिमीलाई" },
  { re: devWordRe("तुमको"), fix: "तिमीको" },
  { re: devWordRe("तुमसे"), fix: "तिमीसँग" },
  { re: devWordRe("तुम"), fix: "तिमी" },
  { re: devWordRe("इंतजार"), fix: "पर्खाइ" },
  { re: devWordRe("इन्तजार"), fix: "पर्खाइ" },
  { re: devWordRe("जल्दी"), fix: "छिटो" },
  { re: devWordRe("जल्द"), fix: "छिटो" },
  { re: devWordRe("आसान"), fix: "सजिलो" },
  { re: devWordRe("मुश्किल"), fix: "गाह्रो" },
  { re: devWordRe("जरूरी"), fix: "आवश्यक" },
  { re: devWordRe("शुरू"), fix: "सुरु" },
  { re: devWordRe("दोस्त"), fix: "साथी" },
  { re: devWordRe("दोस्ती"), fix: "मित्रता" },
  { re: devWordRe("बच्चा"), fix: "बालक" },
  { re: devWordRe("बच्चे"), fix: "बालकहरू" },
  { re: devWordRe("सचमुच"), fix: "साँच्चै" },
  { re: devWordRe("भाई"), fix: "दाजु" },
  { re: devWordRe("बहन"), fix: "हजुरबहिनी" },
  { re: devWordRe("यह"), fix: "यो" },
  { re: devWordRe("वह"), fix: "त्यो" },
  { re: devWordRe("नहीं"), fix: "होइन" },
  { re: devWordRe("नही"), fix: "होइन" },
  { re: devWordRe("हाँ"), fix: "हो" },
  { re: devWordRe("कौन"), fix: "को" },
  { re: devWordRe("कब"), fix: "कहिले" },
  { re: devWordRe("कितना"), fix: "कति" },
  { re: devWordRe("कितने"), fix: "कति" },
  { re: devWordRe("अच्छा"), fix: "राम्रो" },
  { re: devWordRe("अच्छी"), fix: "राम्रो" },
  { re: devWordRe("बुरा"), fix: "नराम्रो" },
  { re: devWordRe("लड़का"), fix: "केटो" },
  { re: devWordRe("लड़की"), fix: "केटी" },
  { re: devWordRe("औरत"), fix: "महिला" },
  { re: devWordRe("सुबह"), fix: "बिहान" },
  { re: devWordRe("शाम"), fix: "साँझ" },
  { re: devWordRe("दोपहर"), fix: "दिउँसो" },
  { re: devWordRe("कल"), fix: "भोलि" },
  { re: devWordRe("परसों"), fix: "भोलिपर्सि" },
  { re: devWordRe("बड़ा"), fix: "ठूलो" },
  { re: devWordRe("छोटा"), fix: "सानो" },
  { re: devWordRe("लम्बा"), fix: "लामो" },
  { re: devWordRe("नया"), fix: "नयाँ" },
  { re: devWordRe("गरम"), fix: "तातो" },
  { re: devWordRe("ठंडा"), fix: "चिसो" },
  { re: devWordRe("ठंड"), fix: "चिसो" },
  { re: devWordRe("गर्मी"), fix: "तातो" },
  { re: devWordRe("मीठा"), fix: "गुलियो" },
  { re: devWordRe("थोड़ा"), fix: "अलिकति" },
  { re: devWordRe("आगे"), fix: "अगाडि" },
  { re: devWordRe("पीछे"), fix: "पछाडि" },
  { re: devWordRe("ऊपर"), fix: "माथि" },
  { re: devWordRe("नीचे"), fix: "तल" },
  { re: devWordRe("साथ"), fix: "सँग" },
  { re: devWordRe("लिए"), fix: "लागि" },
  { re: devWordRe("सकता"), fix: "सक्ने" },
  { re: devWordRe("सकती"), fix: "सक्ने" },
  { re: devWordRe("मतलब"), fix: "भनेको" },
  { re: devWordRe("यानी"), fix: "भनेको" },
  { re: devWordRe("धीरे"), fix: "ढिलो" },
  { re: devWordRe("सबसे"), fix: "सबैभन्दा" },
  { re: devWordRe("हमेशा"), fix: "सधैं" },
  { re: devWordRe("फिर"), fix: "पछि" },
  { re: devWordRe("अगर"), fix: "यदि" },
  { re: devWordRe("भी"), fix: "पनि" },
  { re: devWordRe("और"), fix: "र" },
  { re: devWordRe("तो"), fix: "त" },
  { re: devWordRe("ही"), fix: "नै" },
  { re: devWordRe("कोई"), fix: "कोही" },
  { re: devWordRe("सब"), fix: "सबै" },
  { re: devWordRe("कुछ"), fix: "केही" },
  { re: devWordRe("हुआ"), fix: "भयो" },
  { re: devWordRe("हुई"), fix: "भयो" },
  { re: devWordRe("हुए"), fix: "भए" },
  { re: devWordRe("गया"), fix: "गयो" },
  { re: devWordRe("किया"), fix: "गर्‍यो" },
  { re: devWordRe("की"), fix: "गर्‍यो" },
  { re: devWordRe("किए"), fix: "गरे" },
  { re: devWordRe("बोलना"), fix: "बोल्न" },
  { re: devWordRe("करना"), fix: "गर्न" },
  { re: devWordRe("करने"), fix: "गर्ने" },
  { re: devWordRe("देना"), fix: "दिन" },
  { re: devWordRe("लेना"), fix: "लिन" },
  { re: devWordRe("जाना"), fix: "जान" },
  { re: devWordRe("आना"), fix: "आउन" },
  { re: devWordRe("होना"), fix: "हुन" },
  { re: devWordRe("रहना"), fix: "रहन" },
  { re: devWordRe("सकना"), fix: "सक्न" },
  { re: devWordRe("चाहना"), fix: "चाहन" },
  { re: devWordRe("पड़ना"), fix: "पर्न" },
  { re: devWordRe("लिखना"), fix: "लेख्न" },
  { re: devWordRe("पढ़ना"), fix: "पढ्न" },
  { re: devWordRe("सुनना"), fix: "सुन्न" },
  { re: devWordRe("देखना"), fix: "हेर्न" },
  { re: devWordRe("बैठना"), fix: "बस्न" },
  { re: devWordRe("उठना"), fix: "उठ्न" },
  { re: devWordRe("सोना"), fix: "सुत्न" },
  { re: devWordRe("खाना"), fix: "खान" },
  { re: devWordRe("पीना"), fix: "पिउन" },
  { re: devWordRe("चलना"), fix: "हिँड्न" },
  { re: devWordRe("कहना"), fix: "भन्न" },
  { re: devWordRe("बताना"), fix: "बताउन" },
  { re: devWordRe("समझना"), fix: "बुझ्न" },
  { re: devWordRe("सिखाना"), fix: "सिकाउन" },
  { re: devWordRe("सीखना"), fix: "सिक्न" },
  { re: devWordRe("खरीदना"), fix: "किन्न" },
  { re: devWordRe("बेचना"), fix: "बेच्न" },

  // Everyday Kathmandu spoken nouns (not Sanskritized register)
  { re: devWordRe("चाय"), fix: "चिया" },
  { re: devWordRe("सब्जी"), fix: "तरकारी" },
  { re: devWordRe("सब्जीहरू"), fix: "तरकारीहरू" },
  { re: devWordRe("जूस"), fix: "जुस" },
  { re: devWordRe("स्कूल"), fix: "विद्यालय" },
  { re: devWordRe("स्कुल"), fix: "विद्यालय" },
  { re: devWordRe("कलेज"), fix: "महाविद्यालय" },
  { re: devWordRe("कॉलेज"), fix: "महाविद्यालय" },
  { re: devWordRe("एयरपोर्ट"), fix: "विमानस्थल" },
  { re: devWordRe("ट्राफिक"), fix: "यातायात" },
  { re: devWordRe("इंजीनियर"), fix: "इन्जिनियर" },
  { re: devWordRe("दरवाजा"), fix: "ढोका" },
  { re: devWordRe("खिडकी"), fix: "झ्याल" },
  { re: devWordRe("कमरा"), fix: "कोठा" },
  { re: devWordRe("आग"), fix: "आगो" },
  { re: devWordRe("हवा"), fix: "हावा" },
  { re: devWordRe("जमीन"), fix: "जमिन" },
  { re: devWordRe("आसमान"), fix: "आकाश" },
  { re: devWordRe("सूरज"), fix: "सूर्य" },
  { re: devWordRe("चाँद"), fix: "चन्द्र" },
  { re: devWordRe("बारिश"), fix: "वर्षा" },
  { re: devWordRe("धूप"), fix: "घाम" },
  { re: devWordRe("नौकरी"), fix: "जागिर" },
  { re: devWordRe("पैसा"), fix: "रुपैयाँ" },
  { re: devWordRe("पैसे"), fix: "रुपैयाँ" },
  { re: devWordRe("रुपया"), fix: "रुपैयाँ" },
  { re: devWordRe("रुपये"), fix: "रुपैयाँ" },
  { re: devWordRe("अमीर"), fix: "धनी" },
  { re: devWordRe("खुशी"), fix: "खुसी" },
  { re: devWordRe("गरीब"), fix: "गरिब" },
  { re: devWordRe("मदद"), fix: "मद्दत" },
  { re: devWordRe("पेंसिल"), fix: "पेन्सिल" },

  // Loanwords: syllable-separated so engines don't use English phonology mid-word
  { re: devWordRe("सफ्टवेयर"), fix: "सफ्ट वेयर" },
  { re: devWordRe("हार्डवेयर"), fix: "हार्ड वेयर" },
  { re: devWordRe("सोशलमिडिया"), fix: "सोशल मिडिया" },
  { re: devWordRe("सामाजिकसञ्जाल"), fix: "सामाजिक सञ्जाल" },
  { re: devWordRe("युनिभर्सिटी"), fix: "विश्वविद्यालय" },

  // Non-Nepali auxiliaries / particles (single tokens) → मानक नेपाली
  { re: devWordRe("हूँ"), fix: "छु" },
  { re: devWordRe("हैं"), fix: "छ" },
  { re: devWordRe("सकते"), fix: "सक्छ" },
  { re: devWordRe("रहा"), fix: "रहेको" },
  { re: devWordRe("रही"), fix: "रहेको" },
  { re: devWordRe("रहे"), fix: "रहेका" },
  { re: devWordRe("लिख"), fix: "लेख" },
  { re: devWordRe("पढ़"), fix: "पढ" },
  { re: devWordRe("देख"), fix: "हेर" },
  // Sentence-final copula है → हो (existential “is”); mid-sentence → छ
  { re: /(?<![\u0900-\u0963\u0966-\u097F])है(?=[।?!\s]|$)/g, fix: "हो" },
  { re: devWordRe("है"), fix: "छ" },
];


/**
 * Kathmandu everyday spoken respelling — runs AFTER the grammar lexicon.
 * Engines often read Sanskritized orthography with long schwa / wrong phonology;
 * these forms match how Kathmandu natives actually say the word.
 */
const KATHMANDU_PHONETIC_RULES: Array<{ re: RegExp; fix: string }> = [
  // Common place/brand spellings engines misstress
  { re: devWordRe("काठमाडौँ"), fix: "काठमाडौं" },
  { re: devWordRe("काठमाण्डौ"), fix: "काठमाडौं" },
  { re: devWordRe("पौभा"), fix: "पाउभा" },
  // Everyday Nepali vs Sanskritized/long-vowel forms
  { re: devWordRe("विद्यालय"), fix: "विद्यालय" }, // already fine; keep as anchor
  { re: devWordRe("कृषि"), fix: "कृषि" },
  { re: devWordRe("प्रकृति"), fix: "प्रकृति" },
  { re: devWordRe("सृजना"), fix: "सिर्जना" },
  { re: devWordRe("सृजनशील"), fix: "सिर्जनशील" },
  { re: devWordRe("सृष्टि"), fix: "सृष्टि" },
  // Loanwords: split dense clusters so TTS doesn't read non-Nepali phonology
  { re: devWordRe("सफ्टवेयर"), fix: "सफ्ट वेयर" },
  { re: devWordRe("हार्डवेयर"), fix: "हार्ड वेयर" },
  { re: devWordRe("वेबसाइट"), fix: "वेब साइट" },
  { re: devWordRe("इन्स्टाग्राम"), fix: "इन्स्टा ग्राम" },
  { re: devWordRe("कम्प्युटर"), fix: "कम्प्युटर" },
  { re: devWordRe("टेक्नोलोजी"), fix: "टेक्नो लोजी" },
  { re: devWordRe("यूट्यूब"), fix: "यूट्यूब" },
  // Everyday spoken forms (Sanskritized → Kathmandu register)
  { re: devWordRe("भविष्य"), fix: "भविष्य" },
  { re: devWordRe("वर्तमान"), fix: "अहिले" },
  { re: devWordRe("अतीत"), fix: "अघिल्लो" },
  { re: devWordRe("मध्यकाल"), fix: "बीचको काल" },
  { re: devWordRe("प्राचीन"), fix: "पुरानो" },
  { re: devWordRe("आधुनिक"), fix: "नयाँ" },
  { re: devWordRe("पर्यावरण"), fix: "वातावरण" },
  { re: devWordRe("स्वास्थ्य"), fix: "स्वास्थ्य" },
  { re: devWordRe("शिक्षा"), fix: "पढाइ" },
  { re: devWordRe("विद्यार्थी"), fix: "विद्यार्थी" },
  { re: devWordRe("कर्मचारी"), fix: "कर्मचारी" },
  { re: devWordRe("प्रशासन"), fix: "प्रशासन" },
  { re: devWordRe("सरकार"), fix: "सरकार" },
  { re: devWordRe("संगठन"), fix: "संगठन" },
  { re: devWordRe("समिति"), fix: "समिति" },
  { re: devWordRe("अभियान"), fix: "अभियान" },
  { re: devWordRe("साक्षरता"), fix: "साक्षरता" },
  { re: devWordRe("जनसंख्या"), fix: "जनसंख्या" },
  { re: devWordRe("अर्थव्यवस्था"), fix: "अर्थतन्त्र" },
  { re: devWordRe("प्रविधि"), fix: "प्रविधि" },
  { re: devWordRe("सञ्चार"), fix: "सञ्चार" },
  { re: devWordRe("दूरसंचार"), fix: "टेलिकम" },
  { re: devWordRe("यातायात"), fix: "यातायात" },
  { re: devWordRe("परिवहन"), fix: "बोक्ने" },
  { re: devWordRe("निर्माण"), fix: "बनाउने" },
  { re: devWordRe("उत्पादन"), fix: "उत्पादन" },
  { re: devWordRe("उपभोक्ता"), fix: "ग्राहक" },
  { re: devWordRe("व्यापार"), fix: "धन्धा" },
  { re: devWordRe("व्यवसाय"), fix: "व्यवसाय" },
  { re: devWordRe("कम्पनी"), fix: "कम्पनी" },
  { re: devWordRe("सेवा"), fix: "सेवा" },
  { re: devWordRe("गुणस्तर"), fix: "गुणस्तर" },
  { re: devWordRe("माग"), fix: "माग" },
  { re: devWordRe("आपूर्ति"), fix: "आपूर्ति" },
  { re: devWordRe("बजार"), fix: "बजार" },
  { re: devWordRe("मूल्य"), fix: "दाम" },
  { re: devWordRe("लागत"), fix: "लागत" },
  { re: devWordRe("नाफा"), fix: "नाफा" },
  { re: devWordRe("नोक्सानी"), fix: "नोक्सानी" },
  { re: devWordRe("जोखिम"), fix: "जोखिम" },
  { re: devWordRe("अवसर"), fix: "अवसर" },
  { re: devWordRe("चुनौती"), fix: "चुनौती" },
  { re: devWordRe("समाधान"), fix: "समाधान" },
  { re: devWordRe("समस्या"), fix: "समस्या" },
  { re: devWordRe("सुझाव"), fix: "सुझाव" },
  { re: devWordRe("सिफारिस"), fix: "सिफारिस" },
  { re: devWordRe("जानकारी"), fix: "जानकारी" },
  { re: devWordRe("सूचना"), fix: "खबर" },
  { re: devWordRe("सञ्चार माध्यम"), fix: "सञ्चार माध्यम" },
  { re: devWordRe("प्रवक्ता"), fix: "प्रवक्ता" },
  { re: devWordRe("अध्यक्ष"), fix: "अध्यक्ष" },
  { re: devWordRe("सदस्य"), fix: "सदस्य" },
  { re: devWordRe("नेतृत्व"), fix: "नेतृत्व" },
  { re: devWordRe("नागरिक"), fix: "नागरिक" },
  { re: devWordRe("समुदाय"), fix: "समुदाय" },
  { re: devWordRe("परिवार"), fix: "परिवार" },
  { re: devWordRe("सम्बन्ध"), fix: "सम्बन्ध" },
  { re: devWordRe("मित्रता"), fix: "मित्रता" },
  { re: devWordRe("प्रेम"), fix: "माया" },
  { re: devWordRe("स्नेह"), fix: "माया" },
  { re: devWordRe("आनन्द"), fix: "खुसी" },
  { re: devWordRe("दुःख"), fix: "दुःख" },
  { re: devWordRe("खुशी"), fix: "खुसी" },
  { re: devWordRe("शान्ति"), fix: "शान्ति" },
  { re: devWordRe("स्वतन्त्रता"), fix: "स्वतन्त्रता" },
  { re: devWordRe("समानता"), fix: "समानता" },
  { re: devWordRe("न्याय"), fix: "न्याय" },
  { re: devWordRe("अधिकार"), fix: "अधिकार" },
  { re: devWordRe("कर्तव्य"), fix: "कर्तव्य" },
  { re: devWordRe("जिम्मेवारी"), fix: "जिम्मेवारी" },
  { re: devWordRe("प्रतिबद्धता"), fix: "प्रतिबद्धता" },
  { re: devWordRe("लक्ष्य"), fix: "लक्ष्य" },
  { re: devWordRe("उद्देश्य"), fix: "उद्देश्य" },
  { re: devWordRe("योजना"), fix: "योजना" },
  { re: devWordRe("कार्यक्रम"), fix: "कार्यक्रम" },
  { re: devWordRe("परियोजना"), fix: "प्रोजेक्ट" },
  { re: devWordRe("गतिविधि"), fix: "गतिविधि" },
  { re: devWordRe("अनुसन्धान"), fix: "अनुसन्धान" },
  { re: devWordRe("अध्ययन"), fix: "अध्ययन" },
  { re: devWordRe("अभ्यास"), fix: "अभ्यास" },
  { re: devWordRe("परीक्षा"), fix: "परीक्षा" },
  { re: devWordRe("नतिजा"), fix: "नतिजा" },
  { re: devWordRe("प्रमाणपत्र"), fix: "प्रमाणपत्र" },
  { re: devWordRe("डिग्री"), fix: "डिग्री" },
  { re: devWordRe("विश्वविद्यालय"), fix: "विश्वविद्यालय" },
  { re: devWordRe("कलेज"), fix: "कलेज" },
  { re: devWordRe("विद्यालय"), fix: "विद्यालय" },
  { re: devWordRe("शिक्षक"), fix: "शिक्षक" },
  { re: devWordRe("विद्यार्थी"), fix: "विद्यार्थी" },
  { re: devWordRe("कक्षा"), fix: "कक्षा" },
  { re: devWordRe("पाठ"), fix: "पाठ" },
  { re: devWordRe("पुस्तक"), fix: "किताब" },
  { re: devWordRe("किताब"), fix: "किताब" },
  { re: devWordRe("लेख"), fix: "लेख" },
  { re: devWordRe("समाचार"), fix: "खबर" },
  { re: devWordRe("वृत्त"), fix: "खबर" },
  { re: devWordRe("पत्रिका"), fix: "पत्रिका" },
  { re: devWordRe("दैनिक"), fix: "दैनिक" },
  { re: devWordRe("साप्ताहिक"), fix: "साप्ताहिक" },
  { re: devWordRe("मासिक"), fix: "मासिक" },
  { re: devWordRe("वार्षिक"), fix: "वार्षिक" },
  { re: devWordRe("तिथि"), fix: "मिति" },
  { re: devWordRe("समय"), fix: "समय" },
  { re: devWordRe("काल"), fix: "समय" },
  { re: devWordRe("युग"), fix: "युग" },
  { re: devWordRe("दशक"), fix: "दशक" },
  { re: devWordRe("शताब्दी"), fix: "शताब्दी" },
  { re: devWordRe("इतिहास"), fix: "इतिहास" },
  { re: devWordRe("भूगोल"), fix: "भूगोल" },
  { re: devWordRe("विज्ञान"), fix: "विज्ञान" },
  { re: devWordRe("गणित"), fix: "गणित" },
  { re: devWordRe("साहित्य"), fix: "साहित्य" },
  { re: devWordRe("कला"), fix: "कला" },
  { re: devWordRe("संगीत"), fix: "संगीत" },
  { re: devWordRe("नृत्य"), fix: "नाच" },
  { re: devWordRe("चित्रकला"), fix: "चित्रकला" },
  { re: devWordRe("संस्कृति"), fix: "संस्कृति" },
  { re: devWordRe("परम्परा"), fix: "परम्परा" },
  { re: devWordRe("रीतिरिवाज"), fix: "रीतिरिवाज" },
  { re: devWordRe("चाडपर्व"), fix: "चाडपर्व" },
  { re: devWordRe("उत्सव"), fix: "उत्सव" },
  { re: devWordRe("पर्व"), fix: "पर्व" },
  { re: devWordRe("दिवस"), fix: "दिन" },
  { re: devWordRe("राष्ट्र"), fix: "देश" },
  { re: devWordRe("देश"), fix: "देश" },
  { re: devWordRe("राज्य"), fix: "राज्य" },
  { re: devWordRe("प्रदेश"), fix: "प्रदेश" },
  { re: devWordRe("जिल्ला"), fix: "जिल्ला" },
  { re: devWordRe("नगरपालिका"), fix: "नगरपालिका" },
  { re: devWordRe("गाउँपालिका"), fix: "गाउँपालिका" },
  { re: devWordRe("मन्त्रालय"), fix: "मन्त्रालय" },
  { re: devWordRe("विभाग"), fix: "विभाग" },
  { re: devWordRe("कार्यालय"), fix: "कार्यालय" },
  { re: devWordRe("शाखा"), fix: "शाखा" },
  { re: devWordRe("इकाई"), fix: "इकाई" },
  { re: devWordRe("संरचना"), fix: "संरचना" },
  { re: devWordRe("नीति"), fix: "नीति" },
  { re: devWordRe("नियम"), fix: "नियम" },
  { re: devWordRe("कानुन"), fix: "कानुन" },
  { re: devWordRe("संविधान"), fix: "संविधान" },
  { re: devWordRe("मूलभूत"), fix: "मूलभूत" },
  { re: devWordRe("व्यवस्था"), fix: "व्यवस्था" },
  { re: devWordRe("प्रणाली"), fix: "प्रणाली" },
  { re: devWordRe("प्रक्रिया"), fix: "प्रक्रिया" },
  { re: devWordRe("पद्धति"), fix: "तरिका" },
  { re: devWordRe("विधि"), fix: "तरिका" },
  { re: devWordRe("उपाय"), fix: "उपाय" },
  { re: devWordRe("साधन"), fix: "साधन" },
  { re: devWordRe("स्रोत"), fix: "स्रोत" },
  { re: devWordRe("साध्य"), fix: "साध्य" },
  { re: devWordRe("साधन"), fix: "साधन" },
  { re: devWordRe("सीमा"), fix: "सीमा" },
  { re: devWordRe("गुण"), fix: "गुण" },
  { re: devWordRe("विशेषता"), fix: "विशेषता" },
  { re: devWordRe("लक्षण"), fix: "लक्षण" },
  { re: devWordRe("प्रकृति"), fix: "प्रकृति" },
  { re: devWordRe("पर्याय"), fix: "पर्याय" },
  { re: devWordRe("विकल्प"), fix: "विकल्प" },
  { re: devWordRe("विकल्प"), fix: "विकल्प" },
  { re: devWordRe("विकास"), fix: "विकास" },
  { re: devWordRe("प्रगति"), fix: "प्रगति" },
  { re: devWordRe("उन्नति"), fix: "उन्नति" },
  { re: devWordRe("क्षमता"), fix: "क्षमता" },
  { re: devWordRe("दक्षता"), fix: "दक्षता" },
  { re: devWordRe("अनुभव"), fix: "अनुभव" },
  { re: devWordRe("ज्ञान"), fix: "ज्ञान" },
  { re: devWordRe("बुद्धि"), fix: "बुद्धि" },
  { re: devWordRe("समझ"), fix: "समझ" },
  { re: devWordRe("विचार"), fix: "सोच" },
  { re: devWordRe("भावना"), fix: "भावना" },
  { re: devWordRe("इच्छा"), fix: "इच्छा" },
  { re: devWordRe("आवश्यकता"), fix: "चाहिने" },
  { re: devWordRe("माग"), fix: "माग" },
  { re: devWordRe("आशा"), fix: "आशा" },
  { re: devWordRe("अपेक्षा"), fix: "अपेक्षा" },
  { re: devWordRe("विश्वास"), fix: "विश्वास" },
  { re: devWordRe("आस्था"), fix: "आस्था" },
  { re: devWordRe("श्रद्धा"), fix: "श्रद्धा" },
  { re: devWordRe("भरोसा"), fix: "भरोसा" },
  { re: devWordRe("सम्मान"), fix: "सम्मान" },
  { re: devWordRe("मान"), fix: "मान" },
  { re: devWordRe("प्रतिष्ठा"), fix: "प्रतिष्ठा" },
  { re: devWordRe("स्वाभिमान"), fix: "स्वाभिमान" },
  { re: devWordRe("गर्व"), fix: "गर्व" },
  { re: devWordRe("शक्ति"), fix: "शक्ति" },
  { re: devWordRe("बल"), fix: "बल" },
  { re: devWordRe("ऊर्जा"), fix: "ऊर्जा" },
  { re: devWordRe("साहस"), fix: "साहस" },
  { re: devWordRe("हिम्मत"), fix: "हिम्मत" },
  { re: devWordRe("धैर्य"), fix: "धैर्य" },
  { re: devWordRe("सब्र"), fix: "सब्र" },
  { re: devWordRe("कडिपन"), fix: "कडिपन" },
  { re: devWordRe("मेहनत"), fix: "मेहनत" },
  { re: devWordRe("परिश्रम"), fix: "मेहनत" },
  { re: devWordRe("लगन"), fix: "लगन" },
  { re: devWordRe("समर्पण"), fix: "समर्पण" },
  { re: devWordRe("त्याग"), fix: "त्याग" },
  { re: devWordRe("बलिदान"), fix: "बलिदान" },
  { re: devWordRe("सेवा"), fix: "सेवा" },
  { re: devWordRe("सहयोग"), fix: "सहयोग" },
  { re: devWordRe("साझेदारी"), fix: "साझेदारी" },
  { re: devWordRe("एकता"), fix: "एकता" },
  { re: devWordRe("सद्भाव"), fix: "सद्भाव" },
  { re: devWordRe("सामंजस्य"), fix: "सामंजस्य" },
  { re: devWordRe("सन्तुलन"), fix: "सन्तुलन" },
  { re: devWordRe("स्थिरता"), fix: "स्थिरता" },
  { re: devWordRe("निरन्तरता"), fix: "निरन्तरता" },
  { re: devWordRe("गुणस्तर"), fix: "गुणस्तर" },
  { re: devWordRe("मापदण्ड"), fix: "मापदण्ड" },
  { re: devWordRe("नियम"), fix: "नियम" },
  { re: devWordRe("प्रमाण"), fix: "प्रमाण" },
  { re: devWordRe("सत्य"), fix: "सत्य" },
  { re: devWordRe("झूठ"), fix: "झूठ" },
  { re: devWordRe("ईमानदारी"), fix: "ईमानदारी" },
  { re: devWordRe("पारदर्शिता"), fix: "पारदर्शिता" },
  { re: devWordRe("भ्रष्टाचार"), fix: "भ्रष्टाचार" },
  { re: devWordRe("अनियमितता"), fix: "अनियमितता" },
  { re: devWordRe("अन्याय"), fix: "अन्याय" },
  { re: devWordRe("शोषण"), fix: "शोषण" },
  { re: devWordRe("भेदभाव"), fix: "भेदभाव" },
  { re: devWordRe("हिंसा"), fix: "हिंसा" },
  { re: devWordRe("अपराध"), fix: "अपराध" },
  { re: devWordRe("सुरक्षा"), fix: "सुरक्षा" },
  { re: devWordRe("शान्ति"), fix: "शान्ति" },
  { re: devWordRe("द्वन्द्व"), fix: "द्वन्द्व" },
  { re: devWordRe("संघर्ष"), fix: "संघर्ष" },
  { re: devWordRe("युद्ध"), fix: "युद्ध" },
  { re: devWordRe("सन्धि"), fix: "सन्धि" },
  { re: devWordRe("सहमति"), fix: "सहमति" },
  { re: devWordRe("वार्ता"), fix: "कुराकानी" },
  { re: devWordRe("संवाद"), fix: "कुराकानी" },
  { re: devWordRe("भाषण"), fix: "भाषण" },
  { re: devWordRe("वक्तव्य"), fix: "बयान" },
  { re: devWordRe("घोषणा"), fix: "घोषणा" },
  { re: devWordRe("सूचना"), fix: "खबर" },
  { re: devWordRe("अधिसूचना"), fix: "सूचना" },
  { re: devWordRe("परिपत्र"), fix: "परिपत्र" },
  { re: devWordRe("प्रतिवेदन"), fix: "प्रतिवेदन" },
  { re: devWordRe("रिपोर्ट"), fix: "रिपोर्ट" },
  { re: devWordRe("तथ्याङ्क"), fix: "तथ्याङ्क" },
  { re: devWordRe("आँकडा"), fix: "आँकडा" },
  { re: devWordRe("मापन"), fix: "मापन" },
  { re: devWordRe("मूल्याङ्कन"), fix: "मूल्याङ्कन" },
  { re: devWordRe("विश्लेषण"), fix: "विश्लेषण" },
  { re: devWordRe("अध्ययन"), fix: "अध्ययन" },
  { re: devWordRe("निष्कर्ष"), fix: "निष्कर्ष" },
  { re: devWordRe("सुझाव"), fix: "सुझाव" },
  { re: devWordRe("सिफारिश"), fix: "सिफारिश" },
  { re: devWordRe("अनुशंसा"), fix: "सिफारिस" },
  { re: devWordRe("क्रियान्वयन"), fix: "क्रियान्वयन" },
  { re: devWordRe("अमल"), fix: "अमल" },
  { re: devWordRe("परिणाम"), fix: "नतिजा" },
  { re: devWordRe("प्रभाव"), fix: "प्रभाव" },
  { re: devWordRe("असर"), fix: "असर" },
  { re: devWordRe("प्रतिक्रिया"), fix: "प्रतिक्रिया" },
  { re: devWordRe("प्रतिक्रिया"), fix: "प्रतिक्रिया" },
  { re: devWordRe("फिर्ता"), fix: "फिर्ता" },
  { re: devWordRe("नवीकरण"), fix: "नवीकरण" },
  { re: devWordRe("सुधार"), fix: "सुधार" },
  { re: devWordRe("विकास"), fix: "विकास" },
  { re: devWordRe("संरक्षण"), fix: "संरक्षण" },
  { re: devWordRe("सुरक्षा"), fix: "सुरक्षा" },
  { re: devWordRe("प्रशिक्षण"), fix: "तालिम" },
  { re: devWordRe("तालिम"), fix: "तालिम" },
  { re: devWordRe("कार्यशाला"), fix: "कार्यशाला" },
  { re: devWordRe("सम्मेलन"), fix: "सम्मेलन" },
  { re: devWordRe("बैठक"), fix: "भेटघाट" },
  { re: devWordRe("सभा"), fix: "सभा" },
  { re: devWordRe("समारोह"), fix: "समारोह" },
  { re: devWordRe("अनुष्ठान"), fix: "अनुष्ठान" },
  { re: devWordRe("रसम"), fix: "रसम" },
  { re: devWordRe("भोज"), fix: "भोज" },
  { re: devWordRe("जमघट"), fix: "जमघट" },
  { re: devWordRe("सहभागिता"), fix: "सहभागिता" },
  { re: devWordRe("उपस्थिति"), fix: "उपस्थिति" },
  { re: devWordRe("अनुपस्थिति"), fix: "अनुपस्थिति" },
  { re: devWordRe("हाजिरी"), fix: "हाजिरी" },
  { re: devWordRe("गैरहाजिरी"), fix: "गैरहाजिरी" },
  { re: devWordRe("स्वीकृति"), fix: "स्वीकृति" },
  { re: devWordRe("अनुमति"), fix: "अनुमति" },
  { re: devWordRe("निषेध"), fix: "निषेध" },
  { re: devWordRe("पाबन्दी"), fix: "पाबन्दी" },
  { re: devWordRe("बन्दोबस्त"), fix: "बन्दोबस्त" },
  { re: devWordRe("तयारी"), fix: "तयारी" },
  { re: devWordRe("सजावट"), fix: "सजावट" },
  { re: devWordRe("प्रस्तुति"), fix: "प्रस्तुति" },
  { re: devWordRe("प्रदर्शन"), fix: "प्रदर्शन" },
  { re: devWordRe("साझेदारी"), fix: "साझेदारी" },
  { re: devWordRe("व्याख्या"), fix: "व्याख्या" },
  { re: devWordRe("परिभाषा"), fix: "परिभाषा" },
  { re: devWordRe("अर्थ"), fix: "अर्थ" },
  { re: devWordRe("भावार्थ"), fix: "भाव" },
  { re: devWordRe("उद्देश्य"), fix: "उद्देश्य" },
  { re: devWordRe("लक्ष्य"), fix: "लक्ष्य" },
  { re: devWordRe("प्राथमिकता"), fix: "प्राथमिकता" },
  { re: devWordRe("मुख्य"), fix: "मुख्य" },
  { re: devWordRe("प्रमुख"), fix: "प्रमुख" },
  { re: devWordRe("गौण"), fix: "गौण" },
  { re: devWordRe("आवश्यक"), fix: "चाहिने" },
  { re: devWordRe("अनिवार्य"), fix: "अनिवार्य" },
  { re: devWordRe("सम्भव"), fix: "सम्भव" },
  { re: devWordRe("असम्भव"), fix: "असम्भव" },
  { re: devWordRe("उपयुक्त"), fix: "उपयुक्त" },
  { re: devWordRe("अनुकूल"), fix: "अनुकूल" },
  { re: devWordRe("प्रतिकूल"), fix: "प्रतिकूल" },
  { re: devWordRe("शुभ"), fix: "शुभ" },
  { re: devWordRe("अशुभ"), fix: "अशुभ" },
  { re: devWordRe("मंगल"), fix: "मंगल" },
  { re: devWordRe("शुभकामना"), fix: "शुभकामना" },
  { re: devWordRe("बधाई"), fix: "बधाई" },
  { re: devWordRe("शुभेच्छा"), fix: "शुभेच्छा" },
  { re: devWordRe("अभिनन्दन"), fix: "बधाई" },
  { re: devWordRe("धन्यवाद"), fix: "धन्यवाद" },
  { re: devWordRe("कृपया"), fix: "कृपया" },
  { re: devWordRe("सादर"), fix: "सादर" },
  { re: devWordRe("आदर"), fix: "आदर" },
  { re: devWordRe("अभिवादन"), fix: "नमस्कार" },
  { re: devWordRe("नमस्कार"), fix: "नमस्कार" },
  { re: devWordRe("नमस्ते"), fix: "नमस्ते" },
  { re: devWordRe("प्रणाम"), fix: "नमस्ते" },
  { re: devWordRe("अलविदा"), fix: "बिदा" },
  { re: devWordRe("फेरीभेट"), fix: "फेरी भेट" },
  { re: devWordRe("पुनर्भेट"), fix: "फेरी भेट" },
  // Chandrabindu / anusvara variants engines misread
  { re: devWordRe("तपाईँ"), fix: "तपाईं" },
  { re: devWordRe("तपाईं"), fix: "तपाईं" },
  { re: devWordRe("मैँ"), fix: "मैं" },
  { re: devWordRe("मैं"), fix: "मैं" },
  { re: devWordRe("हैँ"), fix: "हाँ" },
  { re: devWordRe("हाँ"), fix: "हाँ" },
  // Common short spoken fillers / discourse markers
  { re: devWordRe("अरे"), fix: "ए" },
  { re: devWordRe("ओह"), fix: "ओहो" },
  { re: devWordRe("यस"), fix: "हजुर" },
  { re: devWordRe("हजुर"), fix: "हजुर" },
];

/** Apply Kathmandu everyday respelling (idempotent; after grammar lexicon). */
function applyKathmanduPhonetics(text: string, fixes?: PronunciationFix[]): string {
  let out = text;
  for (const { re, fix } of KATHMANDU_PHONETIC_RULES) {
    if (re.global) re.lastIndex = 0;
    const m = out.match(re);
    if (!m) continue;
    out = out.replace(re, fix);
    if (fixes && m && m[0] !== fix && !fixes.some((f) => f.from === m[0])) {
      fixes.push({ from: m[0], to: fix });
    }
    if (re.global) re.lastIndex = 0;
  }
  return out;
}

/** Latin brand/loanword → Devanagari so TTS never applies English phonology. */
const LATIN_TO_DEVANAGARI: Array<{ re: RegExp; fix: string }> = [
  { re: /\bYouTube\b/gi, fix: "यूट्यूब" },
  { re: /\bFacebook\b/gi, fix: "फेसबुक" },
  { re: /\bInstagram\b/gi, fix: "इन्स्टाग्राम" },
  { re: /\bTikTok\b/gi, fix: "टिकटक" },
  { re: /\bWhatsApp\b/gi, fix: "व्हाट्सएप" },
  { re: /\bGoogle\b/gi, fix: "गुगल" },
  { re: /\bTwitter\b/gi, fix: "ट्विटर" },
  { re: /\bLinkedIn\b/gi, fix: "लिंक्डइन" },
  { re: /\bcomputer\b/gi, fix: "कम्प्युटर" },
  { re: /\binternet\b/gi, fix: "इन्टरनेट" },
  { re: /\bsoftware\b/gi, fix: "सफ्टवेयर" },
  { re: /\bhardware\b/gi, fix: "हार्डवेयर" },
  { re: /\bmobile\b/gi, fix: "मोबाइल" },
  { re: /\bemail\b/gi, fix: "इमेल" },
  { re: /\bwebsite\b/gi, fix: "वेबसाइट" },
  { re: /\bonline\b/gi, fix: "अनलाइन" },
  { re: /\boffline\b/gi, fix: "अफलाइन" },
  { re: /\bvideo\b/gi, fix: "भिडियो" },
  { re: /\bphoto\b/gi, fix: "फोटो" },
  { re: /\bdata\b/gi, fix: "डेटा" },
  { re: /\bpassword\b/gi, fix: "पासवर्ड" },
  { re: /\bdownload\b/gi, fix: "डाउनलोड" },
  { re: /\bupload\b/gi, fix: "अपलोड" },
  { re: /\blogin\b/gi, fix: "लगइन" },
  { re: /\bwifi\b/gi, fix: "वाइफाइ" },
  // Acronyms → spoken Devanagari (Fish phoneme dict with ARPAbet garbles these;
  // orthographic Devanagari is read correctly by ne-NP / Kathmandu cues)
  { re: /\bSQL\b/g, fix: "सी क्यू एल" },
  { re: /\bCPU\b/g, fix: "सी पी यू" },
  { re: /\bGPU\b/g, fix: "जी पी यू" },
  { re: /\bRAM\b/g, fix: "र्याम" },
  { re: /\bROM\b/g, fix: "रोम" },
  { re: /\bUSB\b/g, fix: "यू एस बी" },
  { re: /\bAPI\b/g, fix: "ए पी आई" },
  { re: /\bAI\b/g, fix: "ए आई" },
  { re: /\bUI\b/g, fix: "यू आई" },
  { re: /\bHTML\b/g, fix: "एच टी एम एल" },
  { re: /\bCSS\b/g, fix: "सी एस एस" },
  { re: /\bJSON\b/g, fix: "जेसन" },
  { re: /\bCEO\b/g, fix: "सी इ ओ" },
  { re: /\bPDF\b/g, fix: "पी डी एफ" },
  { re: /\bURL\b/g, fix: "यू आर एल" },
  { re: /\bGPS\b/g, fix: "जी पी एस" },
  { re: /\bWi-?Fi\b/gi, fix: "वाइफाइ" },
  { re: /\bJavaScript\b/gi, fix: "जाभास्क्रिप्ट" },
  { re: /\bPython\b/gi, fix: "पाइथन" },
  { re: /\bDocker\b/gi, fix: "डकर" },
  { re: /\bFirebase\b/gi, fix: "फायरबेस" },
  { re: /\bNetflix\b/gi, fix: "नेटफ्लिक्स" },
  { re: /\bSpotify\b/gi, fix: "स्पोटिफाइ" },
  { re: /\bKubernetes\b/gi, fix: "कुबेरनेटिस" },
];

export interface PronunciationFix {
  from: string;
  to: string;
}

// ── User pronunciation overrides (pronunciation.json) ─────────────────────
const PRONUNCIATION_FILE = path.join(process.cwd(), "pronunciation.json");

function loadUserPronunciation(): Array<{ from: string; to: string }> {
  try {
    if (!fs.existsSync(PRONUNCIATION_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(PRONUNCIATION_FILE, "utf-8"));
    if (Array.isArray(parsed)) return parsed.filter((e) => e && typeof e.from === "string" && typeof e.to === "string" && e.from && e.to);
    if (Array.isArray(parsed?.entries)) return parsed.entries.filter((e: any) => e && typeof e.from === "string" && typeof e.to === "string" && e.from && e.to);
    return [];
  } catch {
    return [];
  }
}

function saveUserPronunciation(entries: Array<{ from: string; to: string }>): void {
  fs.writeFileSync(PRONUNCIATION_FILE, JSON.stringify({ entries }, null, 2), "utf-8");
}

function getUserLexicon(): Array<{ re: RegExp; fix: string }> {
  return loadUserPronunciation().map(({ from, to }) => {
    // Escape regex metacharacters in the user's from-string (literal match, word-boundary safe)
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { re: devWordRe(escaped), fix: to };
  });
}

function applyPronunciationLexicon(text: string, fixes?: PronunciationFix[]): string {
  let out = text;
  const record = (from: string, to: string) => {
    if (from !== to && fixes && !fixes.some((f) => f.from === from)) {
      fixes.push({ from, to });
    }
  };

  const applyAll = (rules: Array<{ re: RegExp; fix: string }>) => {
    for (const { re, fix } of rules) {
      // /g regexes are stateful — use a non-global copy to find the match, then replace
      const probe = new RegExp(re.source, re.flags.replace(/g/g, ""));
      const m = out.match(probe);
      if (!m) continue;
      out = out.replace(re, fix);
      record(m[0], fix);
      re.lastIndex = 0;
    }
  };

  // User overrides win over built-ins (applied first on the original text)
  applyAll(getUserLexicon());
  applyAll(PRONUNCIATION_LEXICON);
  applyAll(LATIN_TO_DEVANAGARI);
  // Any remaining Latin (unknown loanwords/acronyms) → phonetic Devanagari,
  // so Fish/Gemini never apply English phonology mid-sentence.
  if (/[A-Za-z]/.test(out)) {
    const SHORT_LATIN: Record<string, string> = {
      OK: "ओके", ok: "ओके", No: "होइन", no: "होइन",
      Yes: "हो", yes: "हो", The: "", and: "र", And: "र",
      I: "म", i: "म", a: "एक", A: "एक",
    };
    out = out.replace(/[A-Za-z][A-Za-z0-9'’-]*/g, (tok) => {
      if (Object.prototype.hasOwnProperty.call(SHORT_LATIN, tok)) {
        return SHORT_LATIN[tok];
      }
      const dev = romanizedToDevanagari(tok);
      return dev && /[\u0900-\u097F]/.test(dev) ? dev : tok;
    });
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Full local prep before any TTS engine. Collects applied pronunciation fixes when `fixes` is provided. */
function prepareSpeechText(
  text: string,
  fixes?: PronunciationFix[],
  opts?: { language?: LanguageHint; mode?: PronunciationMode },
): string {
  return prepareSpeechTextDebug(text, fixes, opts).finalText;
}

/**
 * Same as prepareSpeechText but returns pipeline stages for debug mode.
 * Stages: original → serverPrep → dictionary/precise → prosody → fishInput
 */
function prepareSpeechTextDebug(
  text: string,
  fixes?: PronunciationFix[],
  opts?: { language?: LanguageHint; mode?: PronunciationMode },
): { finalText: string; stages: PipelineStage[]; language: LanguageHint; mode: PronunciationMode; analysis?: ReturnType<typeof analyzeNepaliPronunciation>; fishRep?: ReturnType<typeof buildFishRepresentation> } {
  const language = detectLanguage(text, opts?.language ?? "auto");
  const mode: PronunciationMode = opts?.mode === "precise" ? "precise" : "natural";

  const stages: PipelineStage[] = [];
  const push = (name: string, t: string) => stages.push({ name, text: t });

  push("original", text);

  // Existing server prep (tags, symbols, digits, lexicon, Kathmandu rules, danda, prosody)
  let out = stripEmotionTags(text);
  push("stripTags", out);
  out = cleanSymbolsForSpeech(out);
  out = expandDigitsToNepali(out);
  out = applyPronunciationLexicon(out, fixes);
  out = applyKathmanduPhonetics(out, fixes);
  out = out.replace(/\.(?=\s|$)/g, "।");
  out = ensureSpeechPunctuation(out);
  out = linguisticNormalize(out);
  out = out.trim();
  push("serverPrep", out);

  // Dedicated Nepali normalize layer: dictionary + precise mode + final prosody
  const dict = loadNepaliDictionary();
  const userDict: Record<string, string> = {};
  for (const e of loadUserPronunciation()) userDict[e.from] = e.to;
  const norm = runNepaliNormalize(out, {
    language,
    mode,
    dictionary: dict,
    captureStages: true,
    extra: undefined,
  });
  for (const st of norm.stages) {
    if (st.name === "original") continue;
    push(st.name, st.text);
  }
  for (const hit of norm.dictionaryHits) {
    if (fixes && hit.from !== hit.to && !fixes.some((f) => f.from === hit.from)) {
      fixes.push(hit);
    }
  }

  // Phase 3 — intermediate Fish representation + pronunciation analysis
  let finalText = norm.finalText || out;
  if (language !== "english") {
    const fishRep = buildFishRepresentation(finalText, { dictionary: dict, userDict });
    finalText = fishRep.fishText;
    for (const h of fishRep.fixes) {
      if (fixes && h.from !== h.to && !fixes.some((f) => f.from === h.from)) fixes.push(h);
    }
    push("fishRepresentation", finalText);
    // Phase 8/9 — conversational prosody (not newsreader)
    finalText = conversationalProsody(finalText);
    push("conversationalProsody", finalText);
    push("fishInput", finalText);
    const analysis = analyzeNepaliPronunciation(finalText);
    return {
      finalText,
      stages,
      language: norm.language,
      mode: norm.mode,
      analysis,
      fishRep,
    };
  }

  push("fishInput", finalText);
  return {
    finalText,
    stages,
    language: norm.language,
    mode: norm.mode,
  };
}

/** WPM → Fish prosody.speed (0.5–2, 140 WPM = 1.0). */
function wpmToFishSpeed(wpm: number): number {
  const n = Number(wpm) || 140;
  return Math.min(2, Math.max(0.5, n / 140));
}

/** WPM → Gemini natural-language pace directive (TTS has no numeric rate). */
function geminiPaceDirective(wpm: number): string {
  const n = Number(wpm) || 140;
  if (n < 110) return "Pace: [slowly], measured and deliberate — articulate every syllable clearly.";
  if (n < 130) return "Pace: [slightly slow], calm, clear, and easy to follow.";
  if (n <= 155) return "Pace: [naturally], conversational Nepali speed.";
  if (n <= 175) return "Pace: [briskly], energetic but still crisp and clear.";
  return "Pace: [fast], lively and urgent — keep every word sharply articulated.";
}

// Kathmandu-native director notes injected into Gemini TTS prompt (pronunciation steering)
function buildGeminiDirectorNotes(tone?: string, extra?: string, speedWpm?: number): string {
  const style =
    tone === "informational"
      ? "Style: [professional], clear and confident."
      : tone === "storytelling"
        ? "Style: [warm], expressive and inspiring."
        : tone === "conversational"
          ? "Style: [friendly], natural and lively."
          : "Style: [natural], conversational.";
  const notes = [
    "Director's notes (instructions to the voice artist — do NOT read these aloud):",
    "Speak ONLY standard मानक नेपाली of Nepal (ne-NP) — native Kathmandu accent.",
    "Authentic Nepali phonology only:",
    "clear aspirated consonants (ख, छ, थ, फ, भ), light schwa reduction (final अ is short and neutral),",
    "natural Nepal word stress (light stress near the start of the word),",
    "even syllable timing — no heavy or elongated non-Nepali vowel endings.",
    "Light retroflexes (ट ठ ड ढ ण) — tongue forward, not hard.",
    "Chandrabindu (ँ) is a light nasal glide — do not hard-glottalize it.",
    "Anusvara (ं) is a light nasal — keep it soft, not a full consonant.",
    "Everyday Kathmandu spoken forms only (तपाईं, धेरै, तर, चिया, तरकारी, बिहान, साँझ, म, तिमी, के, कसरी).",
    "If a spelling is Sanskritized or non-Nepali, say it the Kathmandu way (चाय→चिया, शुरू→सुरु).",
    "Articulate every word carefully. No extra words, no skipped syllables, no Anglicized brand readings.",
    geminiPaceDirective(speedWpm ?? 140),
    style,
    extra ? `Additional direction: ${extra}` : "",
    "The actual spoken transcript is clearly labeled between TRANSCRIPT BEGIN and TRANSCRIPT END below. Speak only that transcript.",
  ].filter(Boolean);
  return notes.join("\n");
}

// Gemini TTS result cache — same text+voice reuses audio (saves 10/day quota)
const geminiTtsCache = new Map<string, string>();
const GEMINI_TTS_CACHE_MAX = 50;
let geminiQuotaUsedToday = 0;
let geminiQuotaDay = new Date().toDateString();

function resetQuotaIfNewDay(): void {
  const today = new Date().toDateString();
  if (today !== geminiQuotaDay) {
    geminiQuotaDay = today;
    geminiQuotaUsedToday = 0;
  }
}

/**
 * Generate audio using Fish Audio s2.1-pro-free (unlimited, $0).
 * Sends PURE prepared Devanagari script only — no English/director bracket cues
 * (Fish S2 reads free-form [brackets] aloud as a preamble before your script).
 * Returns a base64 data URL.
 */
async function generateFishTTS(
  text: string,
  voiceName: string,
  _tone?: string,
  _extraNotes?: string,
  speedWpm = 140,
): Promise<string> {
  const referenceId = resolveReferenceId(voiceName);
  const isClone = !FISH_VOICES[voiceName];
  // Defensive re-prep (idempotent) — digits/tags/symbols never leak raw into Fish.
  // NO lead/sentence/pace cues in the text field — those were spoken before the script.
  const prepared = scrubFishSpokenText(prepareSpeechText(text));
  if (!prepared) {
    throw new Error("Nothing left to speak after cleaning the script.");
  }
  // Sampling tuned for Kathmandu phonology stability without going flat.
  // 44.1kHz WAV — highest rate Fish accepts (48000 is rejected: only 8000/16000/24000/32000/44100).
  const payloadBase = {
    text: prepared,
    reference_id: referenceId,
    format: "wav",
    sample_rate: 44100,
    normalize: false,          // Fish normalize only helps EN/ZH — skip for Devanagari
    temperature: isClone ? 0.3 : 0.45,  // clones: lowest stable sampling — stick to Kathmandu phonology
    top_p: isClone ? 0.65 : 0.75,
    repetition_penalty: 1.2,   // Fish default — higher can drop syllables
    latency: "normal",         // quality-first, not streaming
    chunk_length: 300,         // max context → more consistent accent across long scripts
    features: ["quality-guard"],
    prosody: { speed: wpmToFishSpeed(speedWpm), volume: 0, normalize_loudness: true },
    // NOTE: no ARPAbet pronunciation_dictionary — Fish wraps dictionary values as
    // phonemes; ARPAbet ≠ Fish phoneme inventory → garbled words. Latin is converted
    // to Devanagari in prepareSpeechText instead (LATIN_TO_DEVANAGARI + transliterate).
  };

  // Optional zero-shot multi-reference (references[] + msgpack). Default OFF.
  // Fish OpenAPI: references requires application/msgpack, not JSON.
  const engForRef = loadEngineConfig();
  const multiRefCfg = engForRef.engines?.fishMultiReference
    || (engForRef as any).fishMultiReference
    || {};
  const useMultiRef = isMultiRefEnabled(process.env, multiRefCfg);

  if (useMultiRef) {
    const samples = loadReferenceSamples(
      multiRefCfg.sampleDir || "reference-audio",
      Number(multiRefCfg.maxSamples) || 5,
    );
    if (samples.length > 0) {
      const references = samples.map((s) => ({
        audio: new Uint8Array(fs.readFileSync(s.audioPath)),
        text: s.text,
      }));
      const msgpackPayload = encodeMsgpack({
        ...(payloadBase as Record<string, unknown>),
        // Prefer references over single reference_id when multi-ref is on
        reference_id: referenceId,
        references,
      } as any);
      const msgResp = await fetch(FISH_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FISH_API_KEY}`,
          "Content-Type": "application/msgpack",
          model: "s2.1-pro-free",
        },
        body: new Uint8Array(msgpackPayload),
      });
      if (!msgResp.ok) {
        const errText = await msgResp.text().catch(() => "");
        throw new Error(
          `Fish Audio multi-ref error ${msgResp.status}: ${errText.slice(0, 300)}`,
        );
      }
      const multiBuf = Buffer.from(await msgResp.arrayBuffer());
      if (!multiBuf.length) throw new Error("Fish Audio returned empty audio (multi-ref).");
      const isWavM = multiBuf.length > 12
        && multiBuf.toString("ascii", 0, 4) === "RIFF"
        && multiBuf.toString("ascii", 8, 12) === "WAVE";
      const mimeM = isWavM ? "audio/wav" : "audio/mpeg";
      return `data:${mimeM};base64,${multiBuf.toString("base64")}`;
    }
    // fall through to reference_id path if no samples
  }

  const send = async (payload: object): Promise<Response> =>
    fetch(FISH_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FISH_API_KEY}`,
        "Content-Type": "application/json",
        model: "s2.1-pro-free",
      },
      body: JSON.stringify(payload),
    });

  const resp = await send(payloadBase);

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Fish Audio error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const audioBuf = Buffer.from(await resp.arrayBuffer());
  if (!audioBuf.length) {
    throw new Error("Fish Audio returned empty audio.");
  }

  // Detect WAV (RIFF....WAVE) vs MP3 (FF/Fx/ID3) so MIME is always correct
  const isWav = audioBuf.length > 12 && audioBuf.toString("ascii", 0, 4) === "RIFF" && audioBuf.toString("ascii", 8, 12) === "WAVE";
  const mime = isWav ? "audio/wav" : "audio/mpeg";
  return `data:${mime};base64,${audioBuf.toString("base64")}`;
}

/**
 * Generate audio with mode selection:
 * - "native"  → Gemini first with ne-NP + director notes (best pronunciation), Fish fallback
 * - "unlimited" → Fish first (unlimited, $0), Gemini fallback on Fish error
 * - "preview" → always Fish (volume previews shouldn't burn Gemini quota)
 * Optional `extraNotes` steers Gemini pronunciation (director analysis output).
 */
async function generateAudio(
  text: string,
  voiceName: string,
  tone?: string,
  mode: "native" | "unlimited" | "preview" = "native",
  extraNotes?: string,
  speedWpm = 140,
): Promise<{ audioUrl: string; engine: string; cached?: boolean }> {
  // Phase 12 — engine selection from config (default Fish; GEMINI native path already separate)
  const engineCfg = loadEngineConfig();
  if (engineCfg.TTS_ENGINE === "ALTERNATIVE" && engineCfg.engines?.ALTERNATIVE?.enabled) {
    // Stub: keep Fish path; log so operators know ALTERNATIVE is not implemented yet
    console.warn("TTS_ENGINE=ALTERNATIVE enabled in config but no adapter implemented — using FISH_SPEECH.");
  }

  const isClone = !GEMINI_VOICES.includes(voiceName) && !FISH_VOICES[voiceName];

  if (mode === "preview") {
    try {
      const audioUrl = await generateFishTTS(text, voiceName, tone, extraNotes, speedWpm);
      return { audioUrl, engine: "fish" };
    } catch (fishErr: any) {
      // Clones must never fall back to Gemini (wrong voice / Kore leak)
      if (isClone) throw fishErr;
      console.warn(`Fish preview failed, trying Gemini: ${fishErr.message}`);
      const result = await generateGeminiTTS(text, voiceName, tone, extraNotes, speedWpm);
      return { audioUrl: result.audioUrl, engine: "gemini", cached: result.cached };
    }
  }

  if (mode === "native") {
    // Cloned voices only exist on Fish — never route them to Gemini
    if (!isClone) {
      try {
        const result = await generateGeminiTTS(text, voiceName, tone, extraNotes, speedWpm);
        return { audioUrl: result.audioUrl, engine: "gemini", cached: result.cached };
      } catch (geminiErr: any) {
        console.warn(`Gemini quota/error, falling back to Fish: ${geminiErr.message}`);
      }
    }
    const audioUrl = await generateFishTTS(text, voiceName, tone, extraNotes, speedWpm);
    return { audioUrl, engine: "fish" };
  }

  // unlimited: Fish first, Gemini fallback (never for clones — wrong voice)
  try {
    const audioUrl = await generateFishTTS(text, voiceName, tone, extraNotes, speedWpm);
    return { audioUrl, engine: "fish" };
  } catch (fishErr: any) {
    if (isClone) throw fishErr;
    console.warn(`Fish Audio failed, falling back to Gemini: ${fishErr.message}`);
    const result = await generateGeminiTTS(text, voiceName, tone, extraNotes, speedWpm);
    return { audioUrl: result.audioUrl, engine: "gemini", cached: result.cached };
  }
}

// -------------------------------------------------------------
// Cloned voice store (voices.json)
// -------------------------------------------------------------

interface ClonedVoice {
  id: string;            // Fish model _id — used as reference_id
  title: string;
  description: string;
  sampleCount: number;
  state: string;         // created | trained | failed
  createdAt: string;
  hasTranscript?: boolean;
  language?: string;     // "ne" for Nepali-anchored clones
}

const VOICES_FILE = path.join(process.cwd(), "voices.json");

function loadClonedVoices(): ClonedVoice[] {
  try {
    if (!fs.existsSync(VOICES_FILE)) return [];
    const raw = fs.readFileSync(VOICES_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveClonedVoices(voices: ClonedVoice[]): void {
  fs.writeFileSync(VOICES_FILE, JSON.stringify(voices, null, 2), "utf-8");
}

function resolveReferenceId(voiceName: string): string {
  if (FISH_VOICES[voiceName]) return FISH_VOICES[voiceName];
  const clone = loadClonedVoices().find((v) => v.id === voiceName || v.title === voiceName);
  if (clone && clone.state === "trained") return clone.id;
  return FISH_VOICES.Kore;
}

/**
 * Converts raw 16-bit linear PCM (L16, mono, 24kHz default) into a valid WAV file buffer.
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const header = Buffer.alloc(44);
  const bytesPerSample = 2; // 16-bit = 2 bytes
  const byteRate = sampleRate * numChannels * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = pcmBuffer.length;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20); // AudioFormat: 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // BitsPerSample: 16
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Check if text contains significant Latin/Roman alphabet letters (indicating Romanized Nepali).
 */
function isRomanizedText(text: string): boolean {
  const latinMatches = text.match(/[a-zA-Z]/g);
  const devanagariMatches = text.match(/[\u0900-\u097F]/g);

  const latinCount = latinMatches ? latinMatches.length : 0;
  const devanagariCount = devanagariMatches ? devanagariMatches.length : 0;

  return latinCount > 0 && latinCount >= devanagariCount * 0.4;
}

// ── Local Romanized → Devanagari fallback (no LLM required) ───────────────
// Common Nepali words (highest accuracy — used first per token)
const ROMANIZED_WORD_DICT: Record<string, string> = {
  namaskar: "नमस्कार", namaste: "नमस्ते", dhanyabad: "धन्यवाद", dhanyawad: "धन्यवाद",
  nepal: "नेपाल", nepali: "नेपाली", kathmandu: "काठमाडौं", pokhara: "पोखरा",
  sathi: "साथी", sathiharu: "साथीहरू", haru: "हरू",
  tapai: "तपाईं", tapaiko: "तपाईंको", tapaiharu: "तपाईंहरू", timi: "तिमी", timro: "तिम्रो",
  ma: "म", mero: "मेरो", hamro: "हाम्रो", hami: "हामी", uniharu: "उनीहरू", uni: "उनी",
  kasto: "कस्तो", kaha: "कहाँ", kahile: "कहिले", kasari: "कसरी", kina: "किन",
  ramro: "राम्रो", ramra: "राम्रा", dammi: "दम्मी", ramailo: "रमाइलो",
  runchha: "रुन्छ", parchha: "पर्छ", garchha: "गर्छ", garchu: "गर्छु",
  garna: "गर्न", garne: "गर्ने", gare: "गरे", garyo: "गर्यो", garxu: "गर्छु",
  hunxa: "हुन्छ", hunu: "हुनु", hunne: "हुन्ने", hoina: "होइन", ho: "हो", cha: "छ",
  chha: "छ", chhau: "छौ", chhaina: "छैन", chhan: "छन्",
  bho: "भयो", bhayo: "भयो", bhae: "भये", la: "ल",
  dherai: "धेरै", alik: "अलिक", pani: "पनि", matra: "मात्र", sabai: "सबै",
  ajha: "अझ", ajhai: "अझै", paxi: "पछि", agadi: "अगाडि", bhitra: "भित्र",
  bahira: "बाहिर", mathi: "माथि", tala: "तल", samma: "सम्म", bata: "बाट",
  le: "ले", ko: "को", maan: "मान", man: "मन", maya: "माया",
  ghar: "घर", bato: "बाटो", gadi: "गाडी", aago: "आगो",
  khana: "खाना", sutnu: "सुत्न", uthnu: "उठ्न", hidnu: "हिँड्न",
  bolna: "बोल्न", bolne: "बोल्ने", sunnu: "सुन्न", herna: "हेर्न", likhna: "लेख्न",
  padhna: "पढ्न", bujnu: "बुझ्न", siknu: "सिक्न", dine: "दिने", lina: "लिन",
  dinu: "दिनु", paunu: "पाउन", chahanchha: "चाहन्छ", chahandina: "चाहन्न",
  support: "सपोर्ट", project: "प्रोजेक्ट", video: "भिडियो", youtube: "यूट्यूब",
  computer: "कम्प्युटर", internet: "इन्टरनेट", mobile: "मोबाइल", app: "एप",
  technology: "टेक्नोलोजी", knowledge: "ज्ञान", education: "शिक्षा",
  welcome: "स्वागत", today: "आज", tomorrow: "भोलि",
  friends: "साथीहरू", new: "नयाँ", good: "राम्रो", great: "राम्रो",
  hello: "नमस्ते", hi: "नमस्ते", bye: "बिदा", love: "माया",
};

// IAST / common ASCII digraph → Devanagari (per-character, consonant-cluster aware)
const IAST_CONSONANTS: Array<[string, string]> = [
  ["ksh", "क्ष"], ["jny", "ज्ञ"], ["gy", "ज्ञ"],
  ["kh", "ख"], ["gh", "घ"], ["ch", "छ"], ["jh", "झ"],
  ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"],
  ["sh", "श"], ["Sh", "ष"], ["sh", "श"],
  ["kh", "ख"], ["ng", "ङ"], ["ny", "ञ"],
  ["k", "क"], ["g", "ग"], ["c", "च"], ["j", "ज"],
  ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"],
  ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"],
  ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"],
  ["h", "ह"], ["z", "ज"], ["f", "फ"], ["q", "क"],
  ["x", "क्स"], ["T", "ट"], ["D", "ड"], ["N", "ण"],
  ["S", "ष"], ["sh", "श"],
];

const IAST_VOWEL_SIGNS: Record<string, string> = {
  a: "", aa: "ा", ā: "ा", i: "ि", ii: "ी", ī: "ी", ee: "ी",
  u: "ु", uu: "ू", ū: "ू", oo: "ू", r: "ृ", ṛ: "ृ",
  e: "े", ai: "ै", o: "ो", au: "ौ",
};

const IAST_INDEPENDENT_VOWELS: Record<string, string> = {
  a: "अ", aa: "आ", ā: "आ", i: "इ", ii: "ई", ī: "ई", ee: "ई",
  u: "उ", uu: "ऊ", ū: "ऊ", oo: "ऊ", r: "ऋ", ṛ: "ऋ",
  e: "ए", ai: "ऐ", o: "ओ", au: "औ",
};

function transliterateLatinWord(word: string): string {
  const lower = word.toLowerCase();
  if (ROMANIZED_WORD_DICT[lower]) return ROMANIZED_WORD_DICT[lower];
  if (ROMANIZED_WORD_DICT[word]) return ROMANIZED_WORD_DICT[word];

  let w = word;
  // Normalize common ASCII digraphs → IAST-ish
  w = w.replace(/aa/g, "ā").replace(/ii|ee/g, "ī").replace(/uu|oo/g, "ū");

  let out = "";
  let i = 0;
  let pendingCons: string | null = null;

  const flushPending = (matra: string) => {
    if (pendingCons !== null) {
      out += pendingCons + matra;
      pendingCons = null;
    }
  };

  while (i < w.length) {
    // Try consonant cluster (longest first)
    let matchedCons: string | null = null;
    let consumed = 0;
    for (const [lat, dev] of IAST_CONSONANTS) {
      if (w.startsWith(lat, i)) {
        // Prefer longer matches (already ordered-ish); take first match but prefer length
        if (lat.length > consumed) {
          matchedCons = dev;
          consumed = lat.length;
        }
      }
    }
    if (matchedCons) {
      flushPendingWhenNewCons(matchedCons);
      pendingCons = matchedCons;
      i += consumed;
      continue;
    }

    // Vowel (single char or digraph)
    let matchedVowel: string | null = null;
    let vLen = 0;
    const two = w.slice(i, i + 2);
    const one = w[i];
    if (two && IAST_VOWEL_SIGNS.hasOwnProperty(two)) {
      matchedVowel = two;
      vLen = 2;
    } else if (one && IAST_VOWEL_SIGNS.hasOwnProperty(one)) {
      matchedVowel = one;
      vLen = 1;
    } else if (two && IAST_INDEPENDENT_VOWELS.hasOwnProperty(two)) {
      // Independent vowel when no pending consonant
      if (pendingCons === null) {
        out += IAST_INDEPENDENT_VOWELS[two];
        i += 2;
        continue;
      }
      matchedVowel = two;
      vLen = 2;
    } else if (one && IAST_INDEPENDENT_VOWELS.hasOwnProperty(one)) {
      if (pendingCons === null) {
        out += IAST_INDEPENDENT_VOWELS[one];
        i += 1;
        continue;
      }
      matchedVowel = one;
      vLen = 1;
    }

    if (matchedVowel !== null) {
      if (pendingCons !== null) {
        out += pendingCons + IAST_VOWEL_SIGNS[matchedVowel];
        pendingCons = null;
      } else {
        out += IAST_INDEPENDENT_VOWELS[matchedVowel] ?? "";
      }
      i += vLen;
      continue;
    }

    // Unknown char: if pending, flush with inherent vowel, then skip punctuation-ish
    if (pendingCons !== null) {
      out += pendingCons;
      pendingCons = null;
    }
    out += one;
    i += 1;
  }
  if (pendingCons !== null) out += pendingCons;
  return out;

  function flushPendingWhenNewCons(_next: string): void {
    // Consonant after consonant → virama (conjunct); inherent-a model otherwise
    if (pendingCons !== null) {
      out += pendingCons + "्";
      pendingCons = null;
    }
  }
}

/** Convert a fully/partially Romanized Latin string to approximate Devanagari (offline fallback). */
function romanizedToDevanagari(text: string): string {
  return text.replace(/[A-Za-z]+/g, (m) => transliterateLatinWord(m));
}

/**
 * Detect permanent daily free-tier quota (retrying wastes ~50s and never succeeds).
 */
function isDailyQuotaError(err: any): boolean {
  const msg = String(err?.message || "");
  return (
    err?.status === 429 &&
    (msg.includes("GenerateRequestsPerDay") ||
      msg.includes("PerDayPerProject") ||
      msg.includes("Please retry in") && msg.includes("limit:"))
  );
}

/**
 * Robust retry helper for Gemini API calls to handle temporary demand spikes.
 * Daily-quota errors fail immediately (no pointless multi-minute waits).
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 1500): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (isDailyQuotaError(err)) {
        throw err;
      }
      const isRetryable =
        err?.status === 503 ||
        err?.status === 429 ||
        err?.message?.includes("high demand") ||
        err?.message?.includes("UNAVAILABLE") ||
        err?.message?.includes("RESOURCE_EXHAUSTED") ||
        err?.message?.includes("fetch failed");

      if (!isRetryable || attempt === maxRetries - 1) {
        throw err;
      }
      console.warn(`Gemini API retry ${attempt + 1}/${maxRetries} after error: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

// Free-tier text models — tried in order when one is exhausted/missing.
// Only models that still exist on this API key (404s removed): 2.5-flash-lite & 2.0-flash are gone.
const GEMINI_TEXT_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.6-flash",
];

/**
 * Text completion with multi-model fallback (script + director analysis).
 * Daily quota on one model → next model immediately.
 * Returns null if every model fails (caller should use local fallback).
 */
async function generateTextContent(
  prompt: string,
  opts?: { json?: boolean },
): Promise<string | null> {
  let lastErr: any = null;
  for (const model of GEMINI_TEXT_MODELS) {
    try {
      const resp = await callWithRetry(async () => {
        return await ai.models.generateContent({
          model,
          contents: prompt,
          config: opts?.json ? { responseMimeType: "application/json" } : undefined,
        });
      });
      const text = resp.text?.trim() || "";
      if (text) {
        console.log(`Gemini text ok model=${model} len=${text.length}`);
        return text;
      }
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || "");
      const skip =
        isDailyQuotaError(err) ||
        msg.includes("not found") ||
        msg.includes("404") ||
        msg.includes("unsupported") ||
        msg.includes("is not found");
      if (skip) {
        console.warn(`Gemini text model ${model} unavailable: ${msg.slice(0, 140)}`);
        continue;
      }
      // Transient error — try next model too
      console.warn(`Gemini text model ${model} failed: ${msg.slice(0, 140)}`);
    }
  }
  if (lastErr) console.warn(`All Gemini text models failed: ${String(lastErr?.message || lastErr).slice(0, 200)}`);
  return null;
}

/**
 * Offline Nepali script templates — used when every Gemini text model is quota-blocked.
 * Produces a real voiceover script (not a one-line placeholder).
 */
function buildLocalNepaliScript(description: string, durationSeconds: number, tone: string): string {
  const desc = description.trim().replace(/\s+/g, " ").slice(0, 200);
  const targetWords = Math.max(20, Math.floor(durationSeconds * 2.5));
  const isAd = /ad|विज्ञापन|promo|institute|कोचिङ|संस्था|business|व्यापार|course|कोर्स|sale|discount|छुट/i.test(desc);
  const isStory = tone === "storytelling" || /story|कथा|motivation|प्रेरणा|him|himal/i.test(desc);
  const isSocial = tone === "conversational" || /reel|vlog|social|youtube|tiktok|fb|सामाजिक/i.test(desc);

  const banks: string[] = [];

  if (isAd) {
    banks.push(
      `नमस्ते! आज हामी ${desc} बारे कुरा गर्न लागेका छौं।`,
      `यदि तपाईं गम्भीर छन् र गुणस्तरीय सेवा खोज्दै हुनुहुन्छ भने, अहिले नै सम्पर्क गर्नुहोस्।`,
      `सीमित समयका लागि विशेष अवसर उपलब्ध छ — ढिलो नगर्नुहोस्!`,
      `आज नै सुरु गर्नुहोस्, आफ्नो सफलताको पहिलो कदम चाल्नुहोस्।`,
      `धन्यवाद! थप जानकारीका लागि हामीसँग जोडिनुहोस्।`,
    );
  } else if (isStory) {
    banks.push(
      `एक सानो विश्वासले ठूलो परिवर्तन ल्याउन सक्छ।`,
      `${desc} — यो कुराले हामीलाई सधैं प्रेरित गर्दै आएको छ।`,
      `जब सबैले रोकिन्छन्, तब हिँड्ने साहस नै असली विजय हो।`,
      `हरेक दिन एक नयाँ अवसर हो — आफ्नो डरलाई पार गर्नुहोस्।`,
      `आशा कहिल्यै बुझाउनु हुँदैन, उमङ्ग गर्नुहुँदैन। हामी सँगै अगाडि बढौं।`,
    );
  } else if (isSocial) {
    banks.push(
      `नमस्ते साथीहरू! आजको सामग्रीमा स्वागत छ।`,
      `${desc} — यो विषय तपाईंलाई निश्चितै मन पर्नेछ।`,
      `छोटो र सजिलो तरिकामा महत्त्वपूर्ण कुरा बुझौं।`,
      `जानकारी उपयोगी लाग्यो भने लाइक र सेयर गर्न नबिर्सिनुहोला।`,
      `भोलि फेरि भेटौंला — तबसम्म आफ्नो हेरचाह गर्नुहोस्!`,
    );
  } else {
    banks.push(
      `नमस्कार। ${desc} बारे संक्षिप्त जानकारी प्रस्तुत गर्दछु।`,
      `यस विषयले हाम्रो दैनिक जीवनमा महत्त्वपूर्ण भूमिका खेल्छ।`,
      `स्पष्ट र आत्मविश्वासी भाषामा मुख्य कुराहरू हेरौं।`,
      `तथ्य र व्यावहारिक सुझावमा आधारित यो सारांश तपाईंका लागि उपयोगी हुनेछ।`,
      `यहीँ आजका मुख्य कुराहरू थिए। धन्यवाद!`,
    );
  }

  // Repeat / trim banks to approximate target length
  let words: string[] = [];
  while (words.join(" ").split(/\s+/).filter(Boolean).length < targetWords && words.length < 40) {
    for (const b of banks) {
      words.push(b);
      if (words.join(" ").split(/\s+/).filter(Boolean).length >= targetWords) break;
    }
  }
  return words.join(" ");
}

/**
 * Generate audio using Gemini Native TTS — primary quality engine.
 * Forces languageCode ne-NP + Kathmandu director notes for native Nepal pronunciation.
 * Returns base64 WAV data URL + cache flag.
 */
async function generateGeminiTTS(
  text: string,
  voiceName: string,
  tone?: string,
  extraNotes?: string,
  speedWpm = 140,
): Promise<{ audioUrl: string; cached: boolean }> {
  const voice = GEMINI_VOICES.includes(voiceName) ? voiceName : "Kore";
  const spoken = prepareSpeechText(text);
  // Preamble + explicit transcript boundary so Gemini never reads director notes aloud
  const prompt = [
    "TTS task: Synthesize speech from the transcript below in standard Kathmandu Nepali.",
    "Do not read the director's notes or any labels aloud — speak ONLY the text between the markers.",
    "",
    buildGeminiDirectorNotes(tone, extraNotes, speedWpm),
    "",
    "TRANSCRIPT BEGIN",
    spoken,
    "TRANSCRIPT END",
  ].join("\n");
  const cacheKey = `${voice}|${NEPALI_LANGUAGE_CODE}|${prompt}`;

  const cached = geminiTtsCache.get(cacheKey);
  if (cached) {
    return { audioUrl: cached, cached: true };
  }

  resetQuotaIfNewDay();

  let ttsResponse: any = null;
  let lastErr: any = null;
  let usedModel = GEMINI_TTS_MODELS[0];

  for (const model of GEMINI_TTS_MODELS) {
    try {
      ttsResponse = await callWithRetry(async () => {
        return await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              languageCode: NEPALI_LANGUAGE_CODE,
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice,
                },
              },
            },
          },
        });
      });
      usedModel = model;
      break;
    } catch (err: any) {
      lastErr = err;
      // Try next model for not-found / unsupported / demand-spike / quota so a
      // healthy alternate TTS model still serves native ne-NP audio.
      const msg = String(err?.message || "");
      const tryNext =
        msg.includes("not found") ||
        msg.includes("is not found") ||
        msg.includes("404") ||
        msg.includes("unsupported") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("high demand") ||
        msg.includes("quota") ||
        msg.includes("429") ||
        msg.includes("503") ||
        err?.status === 429 ||
        err?.status === 503;
      if (tryNext) {
        console.warn(`Gemini TTS model ${model} unavailable, trying next: ${msg.slice(0, 120)}`);
        continue;
      }
      throw err;
    }
  }

  if (!ttsResponse) {
    throw lastErr || new Error("Gemini TTS failed for all models.");
  }

  const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!audioData?.data) {
    throw new Error("No audio data returned from Gemini TTS API.");
  }

  const pcmBuffer = Buffer.from(audioData.data, "base64");
  const wavBuffer = pcmToWav(pcmBuffer);
  const base64Wav = wavBuffer.toString("base64");
  const audioUrl = `data:audio/wav;base64,${base64Wav}`;

  geminiQuotaUsedToday += 1;
  if (geminiTtsCache.size >= GEMINI_TTS_CACHE_MAX) {
    const firstKey = geminiTtsCache.keys().next().value;
    if (firstKey) geminiTtsCache.delete(firstKey);
  }
  geminiTtsCache.set(cacheKey, audioUrl);
  console.log(`Gemini TTS ok model=${usedModel} voice=${voice} lang=${NEPALI_LANGUAGE_CODE} quota≈${geminiQuotaUsedToday}/day cached=${geminiTtsCache.size}`);

  return { audioUrl, cached: false };
}

/** Quota snapshot for UI. */
function getGeminiQuota() {
  resetQuotaIfNewDay();
  // Soft free-tier estimate — real limit can vary by key/project
  const softLimit = 10;
  return {
    used: geminiQuotaUsedToday,
    softLimit,
    remaining: Math.max(0, softLimit - geminiQuotaUsedToday),
    cached: geminiTtsCache.size,
    day: geminiQuotaDay,
  };
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/** Gemini native-TTS soft quota + cache stats for UI. */
app.get("/api/tts/quota", (_req, res) => {
  res.json({ success: true, ...getGeminiQuota() });
});

// ── User pronunciation overrides ──────────────────────────────────────────

/** List user pronunciation overrides (merged over the built-in lexicon at runtime). */
app.get("/api/pronunciation", (_req, res) => {
  res.json({ success: true, entries: loadUserPronunciation(), builtinCount: PRONUNCIATION_LEXICON.length });
});

/**
 * Add or update a pronunciation override.
 * Body: { from: "written form", to: "clearer spoken form" }
 */
app.post("/api/pronunciation", (req, res) => {
  try {
    const from = typeof req.body?.from === "string" ? req.body.from.trim() : "";
    const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
    if (!from || !to) {
      return res.status(400).json({ error: "Both 'from' and 'to' are required." });
    }
    if (from.length > 100 || to.length > 200) {
      return res.status(400).json({ error: "Override too long (from ≤100, to ≤200 chars)." });
    }
    const entries = loadUserPronunciation().filter((e) => e.from !== from);
    entries.unshift({ from, to });
    saveUserPronunciation(entries.slice(0, 500));
    res.json({ success: true, entries: loadUserPronunciation() });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save override." });
  }
});

/** Delete a pronunciation override by its 'from' string. */
app.delete("/api/pronunciation", (req, res) => {
  try {
    const from = typeof req.body?.from === "string" ? req.body.from.trim() : "";
    if (!from) return res.status(400).json({ error: "'from' is required." });
    const entries = loadUserPronunciation().filter((e) => e.from !== from);
    saveUserPronunciation(entries);
    res.json({ success: true, entries });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete override." });
  }
});

/**
 * Voice Preview endpoint — always Fish (unlimited) so previews never burn Gemini quota.
 */
app.post("/api/tts/preview", async (req, res) => {
  try {
    const { voiceName = "Kore", sampleText } = req.body;

    const VOICE_SAMPLES: Record<string, string> = {
      Kore:   "नमस्ते, म सुमिना। स्पष्ट र मानक नेपाली उच्चारण मेरो विशेषता हो।",
      Puck:   "के छ साथी! ऊर्जाशील र रमाइलो कुराकानी मेरो शैली हो।",
      Charon: "नमस्कार। इतिहास र प्रेरणाका कथाहरू मेरो स्वरमा जीवन्त बन्दछन्।",
      Aoede:  "नमस्ते! कथा, कविता र भावनात्मक अभिव्यक्ति मेरो माध्यम हो।",
      Fenrir: "नमस्ते साथीहरू! उत्साही र प्राकृतिक बोलचालमा म विशेष हुँ।",
    };

    const text = sampleText || VOICE_SAMPLES[voiceName] || "नमस्ते, यो एक परीक्षण आवाज हो।";
    const { audioUrl, engine } = await generateAudio(text, voiceName, undefined, "preview", undefined, 140);

    res.json({ success: true, audioUrl, voiceName, text, engine });
  } catch (error: any) {
    console.error("Error generating voice preview:", error);
    res.status(500).json({ error: error.message || "Failed to generate preview." });
  }
});

/**
 * AI Script Generator endpoint — multi-model Gemini + local offline fallback.
 * Never returns hard 500 when description is valid (local template always works).
 */
app.post("/api/tts/generate-script", async (req, res) => {
  try {
    const { description, durationSeconds = 30, tone = "auto" } = req.body;

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return res.status(400).json({ error: "कृपया वर्णन प्रविष्ट गर्नुहोस् (Please provide a description)." });
    }

    const wordTarget = Math.floor(Number(durationSeconds) * 2.5);
    const scriptPrompt = `You are an expert native Nepali Scriptwriter (काठमाडौँ/मानक नेपाली).
Write a Nepali voiceover script based on this description:
"${description}"

Constraints:
1. Target duration: ~${durationSeconds} seconds. Normal speaking rate is ~2.5 words per second. So aim for about ${wordTarget} words.
2. Tone: ${tone !== "auto" ? tone : "engaging and natural"}.
3. Script must be entirely in Nepali Devanagari script (no English/Romanized text).
4. Provide ONLY the final spoken script text, no intro/outro conversational text, no stage directions, no quotes around it. Just the exact text to be read by the voiceover artist.`;

    const scriptText = await generateTextContent(scriptPrompt);

    if (scriptText && scriptText.length > 40) {
      return res.json({ script: scriptText, source: "gemini" });
    }

    // Offline fallback — all text models quota-blocked or empty
    const localScript = buildLocalNepaliScript(description, Number(durationSeconds) || 30, tone);
    console.warn("Script generator using local offline template (Gemini text unavailable).");
    return res.json({ script: localScript, source: "local" });
  } catch (error: any) {
    console.error("Error generating Nepali script:", error);
    // Still try local fallback on unexpected errors
    try {
      const { description, durationSeconds = 30, tone = "auto" } = req.body || {};
      if (description && typeof description === "string") {
        return res.json({
          script: buildLocalNepaliScript(description, Number(durationSeconds) || 30, tone),
          source: "local",
        });
      }
    } catch { /* ignore */ }
    res.status(500).json({ error: "Failed to generate script." });
  }
});

/**
 * Voiceover Studio generation endpoint — quality mode selectable.
 * mode: "native" (default — Gemini ne-NP + director notes) | "unlimited" (Fish first).
 */
app.post("/api/tts/generate", async (req, res) => {
  try {
    const {
      text,
      tone = "auto",
      voiceName = "Kore",
      speedWpm = 140,
      mode = "native",
      language = "auto",
      pronunciation = "natural",
      debug = false,
    } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "कृपया वाचनका लागि नेपाली पाठ प्रविष्ट गर्नुहोस् (Please provide text to speak)." });
    }

    const qualityMode: "native" | "unlimited" = mode === "unlimited" ? "unlimited" : "native";
    const languageHint: LanguageHint =
      language === "nepali" || language === "english" ? language : "auto";
    const pronunciationMode: PronunciationMode =
      pronunciation === "precise" ? "precise" : "natural";
    const debugMode = debug === true || debug === "true" || debug === 1;

    const rawInput = text.trim();
    const hasRomanized = isRomanizedText(rawInput);
    const isCloneVoice = !GEMINI_VOICES.includes(voiceName) && !FISH_VOICES[voiceName];
    const appliedFixes: PronunciationFix[] = [];
    // Always strip emotion tags + expand digits + clean symbols + lexicon + dictionary first
    const localDebug = prepareSpeechTextDebug(rawInput, appliedFixes, {
      language: languageHint,
      mode: pronunciationMode,
    });
    const locallyPrepared = localDebug.finalText;

    let devanagariText = locallyPrepared;
    let finalStages: PipelineStage[] = localDebug.stages;
    let detectedTone = tone;
    let toneDescription = "";
    let directorNotes = "";

    // Step 1: Kathmandu director analysis when it matters:
    // - Romanized input (needs Devanagari)
    // - auto-tone detection
    // - CLONE voices — always (clones skip Gemini ne-NP TTS; this rewrite is how
    //   they get the same Kathmandu-native phonology the Gemini director path has)
    // - UNLIMITED mode — Fish has no ne-NP language code; rewrite forces Kathmandu phonology
    const needsDirectorRewrite =
      hasRomanized || tone === "auto" || isCloneVoice || qualityMode === "unlimited";
    if (needsDirectorRewrite) {
      const cacheKey = `${tone}|${isCloneVoice ? "clone" : qualityMode === "unlimited" ? "fish" : "stock"}|${rawInput}`;
      const cachedRewrite = directorRewriteCache.get(cacheKey);

      if (cachedRewrite) {
        try {
          const parsed = JSON.parse(cachedRewrite);
          if (parsed.devanagariText) {
            const d = prepareSpeechTextDebug(parsed.devanagariText.trim(), appliedFixes, {
              language: languageHint,
              mode: pronunciationMode,
            });
            devanagariText = d.finalText;
            finalStages = d.stages;
          }
          if (tone === "auto" && parsed.detectedTone) detectedTone = parsed.detectedTone;
          toneDescription = parsed.toneDescription || "";
          directorNotes = parsed.directorNotes || "";
        } catch { /* ignore bad cache, fall through */ }
      }

      if (!cachedRewrite) {
        const directorPrompt = buildKathmanduDirectorPrompt(rawInput, tone, isCloneVoice);

        try {
          const jsonText = await generateTextContent(directorPrompt, { json: true });
          if (!jsonText) throw new Error("All text models unavailable");
          const parsed = JSON.parse(jsonText);
          if (parsed.devanagariText) {
            const d = prepareSpeechTextDebug(parsed.devanagariText.trim(), appliedFixes, {
              language: languageHint,
              mode: pronunciationMode,
            });
            devanagariText = d.finalText;
            finalStages = d.stages;
          }
          if (tone === "auto" && parsed.detectedTone) {
            detectedTone = parsed.detectedTone;
          }
          toneDescription = parsed.toneDescription || "";
          directorNotes = parsed.directorNotes || "";
          if (directorRewriteCache.size >= DIRECTOR_REWRITE_CACHE_MAX) {
            const firstKey = directorRewriteCache.keys().next().value;
            if (firstKey) directorRewriteCache.delete(firstKey);
          }
          directorRewriteCache.set(cacheKey, jsonText);
        } catch (err: any) {
          console.warn("Kathmandu director rewrite fallback:", err.message);
          // Local romanized→Devanagari fallback so Latin never reaches TTS with English phonology
          if (hasRomanized) {
            const d = prepareSpeechTextDebug(romanizedToDevanagari(rawInput), appliedFixes, {
              language: languageHint,
              mode: pronunciationMode,
            });
            devanagariText = d.finalText;
            finalStages = d.stages;
          } else {
            devanagariText = locallyPrepared;
            finalStages = localDebug.stages;
          }
        }
        // If LLM returned Latin-heavy text anyway, force local transliteration
        if (isRomanizedText(devanagariText)) {
          const d = prepareSpeechTextDebug(romanizedToDevanagari(devanagariText), appliedFixes, {
            language: languageHint,
            mode: pronunciationMode,
          });
          devanagariText = d.finalText;
          finalStages = d.stages;
        }
      }
    }

    if (detectedTone === "auto") {
      detectedTone = "conversational";
    }

    // Set tone description defaults (emotion cues are applied inside generateAudio for Fish)
    if (detectedTone === "informational") {
      if (!toneDescription) {
        toneDescription = "जानकारीमूलक र व्यावसायिक (Clear, confident, engaging, and professional)";
      }
    } else if (detectedTone === "storytelling") {
      if (!toneDescription) {
        toneDescription = "कथा र प्रेरणादायी (Warm, expressive, empathetic, and inspiring)";
      }
    } else {
      if (!toneDescription) {
        toneDescription = "कुराकानी र सामाजिक सञ्जाल (Energetic, friendly, and natural)";
      }
    }

    // Step 2: Generate audio — director notes + real WPM speed for both engines
    const { audioUrl: audioDataUrl, engine, cached } = await generateAudio(
      devanagariText,
      voiceName,
      detectedTone,
      qualityMode,
      directorNotes,
      Number(speedWpm) || 140,
    );

    // Duration scales with the actual speaking rate
    const words = devanagariText.split(/\s+/).filter(Boolean).length;
    const wordsPerSec = (Number(speedWpm) || 140) / 60;
    const durationSeconds = Number((words / Math.max(1, wordsPerSec)).toFixed(2)) || 3;

    // Identify aspirated & retroflex consonants
    const aspiratedLetters = ["ख", "घ", "छ", "झ", "थ", "ध", "फ", "भ"];
    const retroflexLetters = ["ट", "ठ", "ड", "ढ", "ण"];

    const foundAspirated = Array.from(new Set(aspiratedLetters.filter((char) => devanagariText.includes(char))));
    const foundRetroflex = Array.from(new Set(retroflexLetters.filter((char) => devanagariText.includes(char))));
    const wordCount = devanagariText.split(/\s+/).filter(Boolean).length;

    res.json({
      success: true,
      audioUrl: audioDataUrl,
      engine,
      mode: qualityMode,
      cached: !!cached,
      quota: getGeminiQuota(),
      devanagariText,
      originalText: rawInput,
      wasConvertedFromRomanized: hasRomanized,
      tone: detectedTone,
      toneDescription,
      voiceName,
      speedWpm: Number(speedWpm) || 140,
      durationSeconds,
      wordCount,
      directorNotes:
        directorNotes ||
        "मानक काठमाडौँ उच्चारण, स्वभाविक लय र सुस्पष्ट ध्वनि सम्पादन।",
      appliedFixes,
      language: localDebug.language,
      pronunciation: localDebug.mode,
      phonetics: {
        aspirated: foundAspirated,
        retroflex: foundRetroflex,
      },
      ...(localDebug.analysis
        ? {
            analysis: {
              features: localDebug.analysis.features,
              riskyWords: localDebug.analysis.riskyWords,
              estimatedSyllables: localDebug.analysis.estimatedSyllables,
            },
          }
        : {}),
      ...(debugMode
        ? {
            debug: {
              original: rawInput,
              normalized: localDebug.stages.find((s) => s.name === "unicodeNormalize")?.text || rawInput,
              pronunciationTransformed: devanagariText,
              fishInput: scrubFishSpokenText(prepareSpeechText(devanagariText)),
              stages: finalStages,
              engine,
              referenceId: isCloneVoice ? voiceName : undefined,
              ttsEngineConfig: loadEngineConfig().TTS_ENGINE,
              dictionaryHits: appliedFixes,
            },
          }
        : {}),
    });
  } catch (error: any) {
    console.error("Error generating Nepali TTS:", error);
    res.status(500).json({
      error: error.message || "Failed to generate audio. Please check your text and try again.",
    });
  }
});

// -------------------------------------------------------------
// Voice Cloning endpoints (Fish Audio persistent clones)
// -------------------------------------------------------------

/** List all user-cloned voices */
app.get("/api/voices", (_req, res) => {
  res.json({ voices: loadClonedVoices() });
});

/**
 * Create a persistent voice clone.
 * Body: { title, description?, samples: [{ dataUrl, text? }] }
 * dataUrl is a base64 data: URL (audio/wav, audio/mpeg, audio/webm, audio/ogg, audio/mp4).
 */
app.post("/api/voices/clone", async (req, res) => {
  try {
    const { title, description = "", samples, enhanceAudio = true } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Voice title is required." });
    }
    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({ error: "At least one audio sample is required." });
    }
    if (samples.length > 20) {
      return res.status(400).json({ error: "Maximum 20 samples allowed." });
    }

    const ALLOWED_MIMES = new Set([
      "audio/wav", "audio/x-wav", "audio/wave",
      "audio/mpeg", "audio/mp3",
      "audio/mp4", "audio/m4a", "audio/x-m4a",
      "audio/opus", "audio/ogg", "audio/webm",
    ]);

    const blobs: Blob[] = [];
    const texts: string[] = [];
    let anyText = false;
    let totalDuration = 0;
    let longestSample = 0;
    const qualityWarningsEarly: string[] = [];

    for (const s of samples) {
      if (!s?.dataUrl || typeof s.dataUrl !== "string" || !s.dataUrl.startsWith("data:")) {
        return res.status(400).json({ error: "Each sample must be a base64 data URL." });
      }
      const meta = s.dataUrl.slice(5, s.dataUrl.indexOf(";"));
      if (!ALLOWED_MIMES.has(meta)) {
        return res.status(400).json({ error: `Unsupported audio format: ${meta}. Use WAV, MP3, M4A, OGG, Opus, or WebM.` });
      }
      const commaIdx = s.dataUrl.indexOf(",");
      const buf = Buffer.from(s.dataUrl.slice(commaIdx + 1), "base64");
      if (buf.length < 1000) {
        return res.status(400).json({ error: "Sample file is too small or empty." });
      }
      if (buf.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "Each sample must be 10MB or smaller." });
      }
      const dur = Number(s.durationSec) || 0;
      if (dur > 0) {
        totalDuration += dur;
        longestSample = Math.max(longestSample, dur);
      }
      blobs.push(new Blob([buf], { type: meta }));
      // Non-destructive PCM quality checks (WAV only)
      qualityWarningsEarly.push(...validateReferencePcm(buf));
      // Light prep only: strip stray emotion tags + collapse whitespace.
      // Do NOT run full lexicon/digit expansion — transcript must match the spoken audio exactly.
      const t = typeof s.text === "string"
        ? stripEmotionTags(s.text).replace(/\s+/g, " ").trim()
        : "";
      if (!t) {
        return res.status(400).json({
          error: `Sample ${texts.length + 1} is missing a Nepali transcript. Exact matching text anchors Fish language/pronunciation — add the exact words spoken.`,
        });
      }
      if (/[A-Za-z]{3,}/.test(t) && !/[\u0900-\u097F]/.test(t)) {
        return res.status(400).json({
          error: `Sample ${texts.length + 1} transcript is Latin-only. Write the EXACT Nepali words in Devanagari (e.g. नमस्ते म नाम हो) — Latin transcripts make Fish mis-anchor language and pronunciation.`,
        });
      }
      texts.push(t);
      anyText = true;
    }

    // Quality gate: Fish docs recommend ≥10s per clip; short samples drift off-accent
    const qualityWarnings: string[] = [...qualityWarningsEarly];
    if (samples.length < 2) {
      qualityWarnings.push("Add at least 2 samples — a single short clip often drifts off the native Kathmandu accent.");
    }
    if (longestSample > 0 && longestSample < 10) {
      qualityWarnings.push("Longest sample is under 10s — aim for 15–30s clean clips for native-level fidelity.");
    }
    if (totalDuration > 0 && totalDuration < 20) {
      qualityWarnings.push("Total audio under 20s — 30–60s of clear speech matches Gemini native voice quality much better.");
    }

    // Build multipart form for Fish Audio POST /model
    const form = new FormData();
    form.append("type", "tts");
    form.append("title", title.trim().slice(0, 100));
    const desc = (description && String(description).trim())
      ? String(description).trim().slice(0, 500)
      : `Nepali (ne-NP) voice — काठमाडौँ मानक नेपाली · ${samples.length} sample(s)`;
    form.append("description", desc);
    form.append("visibility", "private");
    form.append("train_mode", "fast");
    form.append("enhance_audio_quality", enhanceAudio ? "true" : "false");
    form.append("generate_sample", "false");
    // Language tags — categorize clone as Nepali (languages field is derived server-side)
    form.append("tags", "nepali");
    form.append("tags", "ne");
    form.append("tags", "nepal");
    form.append("tags", "kathmandu");
    form.append("tags", "ne-NP");
    blobs.forEach((b, i) => form.append("voices", b, `sample-${i + 1}.bin`));
    // texts is the primary language anchor when ASR is skipped
    if (anyText) {
      texts.forEach((t) => form.append("texts", t));
    }

    const createResp = await fetch("https://api.fish.audio/model", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FISH_API_KEY}`,
      },
      body: form,
    });

    const createText = await createResp.text();
    if (!createResp.ok) {
      console.error("Fish Audio clone failed:", createResp.status, createText.slice(0, 500));
      let msg = `Fish Audio error ${createResp.status}`;
      try {
        const parsed = JSON.parse(createText);
        if (parsed.message) msg = parsed.message;
        else if (parsed.error) msg = typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
      } catch { /* keep status msg */ }
      return res.status(502).json({ error: `Voice cloning failed: ${msg}` });
    }

    const model = JSON.parse(createText);
    const clone: ClonedVoice = {
      id: model._id,
      title: title.trim().slice(0, 100),
      description: desc,
      sampleCount: samples.length,
      state: model.state || "trained",
      createdAt: new Date().toISOString(),
      hasTranscript: anyText,
      language: "ne",
    };

    const all = loadClonedVoices();
    all.unshift(clone);
    saveClonedVoices(all);

    res.json({
      success: true,
      voice: clone,
      qualityWarnings,
      quality: {
        sampleCount: samples.length,
        totalDurationSec: Number(totalDuration.toFixed(1)),
        longestSampleSec: Number(longestSample.toFixed(1)),
        level: qualityWarnings.length === 0 ? "native" : "improvable",
      },
    });
  } catch (error: any) {
    console.error("Error cloning voice:", error);
    res.status(500).json({ error: error.message || "Voice cloning failed." });
  }
});

/**
 * Preview a cloned voice by speaking a test line.
 * Body: { text? }
 */
app.post("/api/voices/:id/preview", async (req, res) => {
  try {
    const { id } = req.params;
    const clone = loadClonedVoices().find((v) => v.id === id);
    if (!clone) return res.status(404).json({ error: "Cloned voice not found." });
    if (clone.state !== "trained") {
      return res.status(409).json({ error: `Voice is still in state: ${clone.state}` });
    }

    const text = (req.body?.text as string)?.trim() ||
      "नमस्ते! म तपाईंको क्लोन गरिएको आवाज हुँ। यो मेरो परीक्षण आवाज हो।";

    // Kathmandu director rewrite first (same as full generate path), then Fish clone TTS
    let spoken = text;
    let notes = "";
    try {
      const jsonText = await generateTextContent(
        buildKathmanduDirectorPrompt(text, "conversational", true),
        { json: true },
      );
      if (jsonText) {
        const parsed = JSON.parse(jsonText);
        if (parsed.devanagariText) spoken = parsed.devanagariText;
        notes = parsed.directorNotes || "";
      }
    } catch {
      // local prepare still runs inside generateFishTTS
    }

    // Always Nepali director cue; never Gemini (clone id would resolve to Kore)
    const audioUrl = await generateFishTTS(spoken, clone.id, "conversational", notes, 140);
    res.json({ success: true, audioUrl, voice: clone });
  } catch (error: any) {
    console.error("Error previewing cloned voice:", error);
    res.status(500).json({ error: error.message || "Preview failed." });
  }
});

/** Delete a cloned voice (local store + Fish Audio model) */
app.delete("/api/voices/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const all = loadClonedVoices();
    const idx = all.findIndex((v) => v.id === id);
    if (idx === -1) return res.status(404).json({ error: "Cloned voice not found." });

    // Best-effort remote delete
    try {
      await fetch(`https://api.fish.audio/model/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${process.env.FISH_API_KEY}` },
      });
    } catch (e: any) {
      console.warn(`Fish remote delete failed for ${id}: ${e.message}`);
    }

    all.splice(idx, 1);
    saveClonedVoices(all);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting cloned voice:", error);
    res.status(500).json({ error: error.message || "Delete failed." });
  }
});

// -------------------------------------------------------------
// Research Mode — Native Nepali TTS Lab (added; does NOT replace /api/tts/generate)
// -------------------------------------------------------------
const CORPUS_PATH = path.join(process.cwd(), "benchmark", "nepali", "corpus.json");
const CASES_PATH = path.join(process.cwd(), "benchmark", "nepali", "pronunciation_cases.json");

function loadJsonSafe(p: string): any | null {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch { /* ignore */ }
  return null;
}

app.get("/api/research/engines", async (_req, res) => {
  const selected = resolveEngineId();
  const engines = [];
  for (const e of listEngines()) {
    const avail = await e.isAvailable();
    engines.push({
      id: e.id,
      displayName: e.displayName,
      local: e.local,
      supportsNepali: e.supportsNepali,
      supportsClone: e.supportsClone,
      license: e.license,
      representations: e.representations,
      available: avail.available,
      reason: avail.reason,
      selected: e.id === selected,
    });
  }
  res.json({ selected, engines });
});

app.get("/api/research/corpus", (_req, res) => {
  const corpus = loadJsonSafe(CORPUS_PATH);
  if (!corpus) {
    res.status(404).json({ error: "benchmark/nepali/corpus.json not found" });
    return;
  }
  const cases = loadJsonSafe(CASES_PATH);
  const byCat: Record<string, number> = {};
  for (const s of corpus.sentences ?? []) byCat[s.cat] = (byCat[s.cat] ?? 0) + 1;
  res.json({
    meta: corpus.meta,
    total: (corpus.sentences ?? []).length,
    categories: byCat,
    categoryLegend: corpus.categories,
    pronunciationCases: cases ? (cases.cases ?? []).length : 0,
    sentences: corpus.sentences,
    pronunciationCasesDetail: cases?.cases ?? [],
  });
});

app.post("/api/research/synthesize", async (req, res) => {
  try {
    const { text, engineId, voiceId, referenceAudioPath, styleHint } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).json({ error: "text required" });
      return;
    }
    const id = (engineId || resolveEngineId()).toLowerCase();
    const engine = getEngine(id);
    if (!engine) {
      res.status(400).json({ error: `Unknown engine '${id}'`, known: listEngines().map((e) => e.id) });
      return;
    }
    const avail = await engine.isAvailable();
    if (!avail.available) {
      res.status(503).json({ ok: false, engineId: id, unavailable: true, reason: avail.reason });
      return;
    }
    const norm = runNepaliNormalize(text);
    const result = await engine.synthesize({
      text: typeof norm?.finalText === "string" && norm.finalText ? norm.finalText : text,
      representation: "normalized",
      voiceId,
      referenceAudioPath,
      styleHint,
    });
    if (!result.ok || !result.audioBuffer || result.isStub) {
      res.status(503).json({ ...result, ok: false });
      return;
    }
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("X-Engine-Id", result.engineId);
    if (result.latencyMs != null) res.setHeader("X-Latency-Ms", String(result.latencyMs));
    if (result.evidence) res.setHeader("X-Evidence", result.evidence);
    res.send(result.audioBuffer);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get("/api/research/pronunciation-cases", (_req, res) => {
  const cases = loadJsonSafe(CASES_PATH);
  if (!cases) {
    res.status(404).json({ error: "pronunciation_cases.json not found" });
    return;
  }
  res.json(cases);
});

// -------------------------------------------------------------
// Vite Middleware / Static Server
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nepali Voiceover Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
