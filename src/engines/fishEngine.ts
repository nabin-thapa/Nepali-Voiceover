/**
 * FishEngine — adapter over the existing Fish Audio cloud path in server.ts.
 * Does not replace /api/tts/generate; adds a research-mode interface.
 * Evidence: VERIFIED (existing integration works; Nepali support unverified — see CASE D).
 */
import type { TTSEngine, TTSEngineVoice, TTSSynthesisRequest, TTSSynthesisResult, TextRepresentation } from "./types";

const FISH_URL = "https://api.fish.audio/v1/tts";

export class FishEngine implements TTSEngine {
  readonly id = "fish";
  readonly displayName = "Fish Audio s2.1-pro-free (cloud)";
  readonly local = false;
  readonly supportsNepali: "unverified" = "unverified";
  readonly supportsClone = true;
  readonly license = "cloud ToS (opaque)";
  readonly representations: TextRepresentation[] = ["raw", "normalized", "orthographic"];

  private apiKey?: string;
  /** Injected by registry from env or existing generateFishTTS */
  private generateFn?: (text: string, opts: { voiceId?: string; referenceAudioPath?: string }) => Promise<Buffer>;

  constructor(opts?: {
    apiKey?: string;
    generateFn?: (text: string, opts: { voiceId?: string; referenceAudioPath?: string }) => Promise<Buffer>;
  }) {
    this.apiKey = opts?.apiKey;
    this.generateFn = opts?.generateFn;
  }

  private resolveApiKey(): string | undefined {
    return this.apiKey ?? process.env.FISH_API_KEY ?? process.env.FISH_ACCESS_TOKEN;
  }

  async isAvailable() {
    if (this.generateFn) return { available: true };
    if (this.resolveApiKey()) return { available: true };
    return { available: false, reason: "FISH_API_KEY not set and no generateFn injected" };
  }

  async listVoices(): Promise<TTSEngineVoice[]> {
    // Reference voices used by the existing app; clone voices are project-specific.
    return [
      { id: "kore", name: "Kore (stock)", supportsClone: false, languages: ["multi-unverified"] },
      { id: "clone-default", name: "Project clone voice", supportsClone: true, languages: ["ne-unverified"] },
    ];
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const t0 = Date.now();
    const apiKey = this.resolveApiKey();
    if (!this.generateFn && !apiKey) {
      return { ok: false, engineId: this.id, error: "Fish unavailable: no API key / generateFn", isStub: false };
    }
    try {
      if (this.generateFn) {
        const buf = await this.generateFn(req.text, {
          voiceId: req.voiceId,
          referenceAudioPath: req.referenceAudioPath,
        });
        return {
          ok: true,
          engineId: this.id,
          voiceId: req.voiceId,
          audioBuffer: buf,
          sampleRate: req.sampleRate ?? 44100,
          latencyMs: Date.now() - t0,
          consumedRepresentation: req.representation,
          evidence: "VERIFIED",
        };
      }
      // Direct cloud call (same payload family as server.ts generateFishTTS)
      const res = await fetch(FISH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          model: "s2.1-pro-free",
        },
        body: JSON.stringify({
          text: req.text,
          format: req.format === "mp3" ? "mp3" : "wav",
          sample_rate: req.sampleRate ?? 44100,
          normalize: false,
          latency: "normal",
          chunk_length: 300,
          ...(req.referenceAudioPath
            ? { references: [{audio: req.referenceAudioPath}] }
            : { text_tokens: [] }),
        }),
      });
      if (!res.ok) {
        return { ok: false, engineId: this.id, error: `Fish HTTP ${res.status}`, latencyMs: Date.now() - t0 };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        ok: true,
        engineId: this.id,
        audioBuffer: buf,
        sampleRate: req.sampleRate ?? 44100,
        latencyMs: Date.now() - t0,
        consumedRepresentation: req.representation,
        evidence: "VERIFIED",
      };
    } catch (e) {
      return { ok: false, engineId: this.id, error: String(e), latencyMs: Date.now() - t0 };
    }
  }
}
