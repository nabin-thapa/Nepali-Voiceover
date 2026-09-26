/**
 * LocalStubEngine — clearly marked stub for local/offline engines
 * (Indic Parler-TTS, kala-tts, Chatterbox-Nepali, alternative).
 * NEVER pretends to synthesize: isStub=true, ok=false until a real
 * backend is wired and `npm run system:check` reports it available.
 */
import type { TTSEngine, TTSEngineVoice, TTSSynthesisRequest, TTSSynthesisResult, TextRepresentation } from "./types";

export interface StubEngineConfig {
  id: string;
  displayName: string;
  supportsNepali: "verified" | "experimental" | "unverified" | "no";
  supportsClone: boolean;
  license?: string;
  representations: TextRepresentation[];
  /** How availability is probed (e.g. python import, onnx file path, HF cache) */
  probe?: () => Promise<{ available: boolean; reason?: string }>;
}

export class LocalStubEngine implements TTSEngine {
  readonly id: string;
  readonly displayName: string;
  readonly local = true;
  readonly supportsNepali: StubEngineConfig["supportsNepali"];
  readonly supportsClone: boolean;
  readonly license?: string;
  readonly representations: TextRepresentation[];

  private probe?: StubEngineConfig["probe"];

  constructor(cfg: StubEngineConfig) {
    this.id = cfg.id;
    this.displayName = cfg.displayName;
    this.supportsNepali = cfg.supportsNepali;
    this.supportsClone = cfg.supportsClone;
    this.license = cfg.license;
    this.representations = cfg.representations;
    this.probe = cfg.probe;
  }

  async isAvailable() {
    if (this.probe) return this.probe();
    return { available: false, reason: "No local backend wired yet (EXPERIMENTAL stub)" };
  }

  async listVoices(): Promise<TTSEngineVoice[]> {
    return [];
  }

  async synthesize(_req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    return {
      ok: false,
      engineId: this.id,
      isStub: true,
      error: `Stub engine '${this.id}' — not wired. See docs/TTS_FOUNDATION_RESEARCH.md and run npm run system:check.`,
      evidence: "NOT_YET_TESTED",
    };
  }
}
