/**
 * TTSEngine — pluggable interface for Nepali TTS research.
 * Every engine decides which text representation it accepts (raw Devanagari,
 * normalized Devanagari, orthographic respelling, IPA, etc.). The pipeline
 * NEVER forces IPA into an engine that does not support it.
 */

export type TextRepresentation =
  | "raw"
  | "normalized"
  | "orthographic"
  | "ipa"
  | "engine-specific";

export interface TTSEngineVoice {
  id: string;
  name: string;
  /** true = zero-shot clone from reference audio */
  supportsClone: boolean;
  /** languages this voice is known to support; "ne" only when VERIFIED */
  languages: string[];
}

export interface TTSSynthesisRequest {
  text: string;
  /** Which representation `text` is in. Engines validate compatibility. */
  representation: TextRepresentation;
  voiceId?: string;
  /** Path or URL to reference audio for clone engines */
  referenceAudioPath?: string;
  /** Optional style/caption hint (Parler-style, Gemini director notes) */
  styleHint?: string;
  /** Output sample rate preference; engines may override */
  sampleRate?: number;
  /** Output format; default wav */
  format?: "wav" | "mp3";
}

export interface TTSSynthesisResult {
  ok: boolean;
  engineId: string;
  voiceId?: string;
  /** Absolute path or buffer depending on caller */
  audioPath?: string;
  audioBuffer?: Buffer;
  sampleRate?: number;
  durationSec?: number;
  latencyMs?: number;
  /** Representation the engine actually consumed */
  consumedRepresentation?: TextRepresentation;
  /** True when result is a stub / placeholder, not real synthesis */
  isStub?: boolean;
  /** Human-readable error when ok=false */
  error?: string;
  /** Evidence label for docs: VERIFIED | EXPERIMENTAL | NOT_YET_TESTED */
  evidence?: string;
}

export interface TTSEngine {
  readonly id: string;
  readonly displayName: string;
  readonly local: boolean;
  readonly supportsNepali: "verified" | "experimental" | "unverified" | "no";
  readonly supportsClone: boolean;
  readonly license?: string;
  readonly representations: TextRepresentation[];

  isAvailable(): Promise<{ available: boolean; reason?: string }>;
  listVoices(): Promise<TTSEngineVoice[]>;
  synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult>;
}
