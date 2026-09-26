/**
 * Engine registry — single source of truth for research-mode engine selection.
 * TTS_ENGINE=fish|gemini|indic_parler|kala|chatterbox_nepali|alternative
 * Existing /api/tts/generate flow is untouched; research endpoints use this.
 */
import { FishEngine } from "./fishEngine";
import { GeminiEngine } from "./geminiEngine";
import { IndicParlerEngine } from "./indicParlerEngine";
import { KalaEngine } from "./kalaEngine";
import { LocalStubEngine } from "./localStubEngine";
import type { TTSEngine } from "./types";
import type { TextRepresentation } from "./types";

const DEVANAGARI_REPS: TextRepresentation[] = ["raw", "normalized", "orthographic"];

export function createEngines(): Record<string, TTSEngine> {
  const fish = new FishEngine();
  const gemini = new GeminiEngine();

  // Real local backend for AI4Bharat Indic Parler-TTS
  const indicParler = new IndicParlerEngine();

  // Real local backend (kala-tts + real-nepali ONNX). Replaces prior stub only for id "kala".
  const kala = new KalaEngine();

  const chatterbox = new LocalStubEngine({
    id: "chatterbox_nepali",
    displayName: "Chatterbox Nepali fine-tune (local GPU)",
    supportsNepali: "experimental",
    supportsClone: true,
    license: "MIT",
    representations: ["raw", "normalized"],
  });

  const alternative = new LocalStubEngine({
    id: "alternative",
    displayName: "Alternative engine (config: ALTERNATIVE)",
    supportsNepali: "unverified",
    supportsClone: false,
    representations: ["raw", "normalized"],
  });

  return { fish, gemini, indic_parler: indicParler, kala, chatterbox_nepali: chatterbox, alternative };
}

const cached = createEngines();

export function getEngine(id: string): TTSEngine | undefined {
  return cached[id];
}

export function listEngines(): TTSEngine[] {
  return Object.values(cached);
}

export function resolveEngineId(): string {
  const raw = (process.env.TTS_ENGINE || "fish").toLowerCase();
  const map: Record<string, string> = {
    fish: "fish",
    fish_speech: "fish",
    gemini: "gemini",
    local_model: "indic_parler",
    indic_parler: "indic_parler",
    kala: "kala",
    chatterbox: "chatterbox_nepali",
    chatterbox_nepali: "chatterbox_nepali",
    alternative: "alternative",
  };
  return map[raw] ?? "fish";
}

export type { TTSEngine } from "./types";
