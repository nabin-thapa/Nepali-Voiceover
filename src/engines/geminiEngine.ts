/**
 * GeminiEngine — quality-reference adapter (stock voices, never identity clone).
 * Evidence: VERIFIED official languageCode ne-NP; quota-limited.
 * When quota fails: return unavailable, NEVER fake audio.
 */
import type { TTSEngine, TTSEngineVoice, TTSSynthesisRequest, TTSSynthesisResult, TextRepresentation } from "./types";

export class GeminiEngine implements TTSEngine {
  readonly id = "gemini";
  readonly displayName = "Gemini TTS ne-NP (reference)";
  readonly local = false;
  readonly supportsNepali: "verified" = "verified";
  readonly supportsClone = false;
  readonly license = "Google Terms (cloud)";
  readonly representations: TextRepresentation[] = ["raw", "normalized"];

  private apiKey?: string;
  private generateFn?: (text: string, opts: { voice?: string; styleHint?: string }) => Promise<Buffer>;

  constructor(opts?: {
    apiKey?: string;
    generateFn?: (text: string, opts: { voice?: string; styleHint?: string }) => Promise<Buffer>;
  }) {
    this.apiKey = opts?.apiKey;
    this.generateFn = opts?.generateFn;
  }

  private resolveApiKey(): string | undefined {
    return this.apiKey ?? process.env.GEMINI_API_KEY;
  }

  async isAvailable() {
    if (this.generateFn) return { available: true };
    if (this.resolveApiKey()) return { available: true };
    return { available: false, reason: "GEMINI_API_KEY not set / quota exhausted" };
  }

  async listVoices(): Promise<TTSEngineVoice[]> {
    return [
      { id: "Kore", name: "Kore (stock)", supportsClone: false, languages: ["ne-NP", "en-US"] },
      { id: "Puck", name: "Puck (stock)", supportsClone: false, languages: ["ne-NP", "en-US"] },
      { id: "Charon", name: "Charon (stock)", supportsClone: false, languages: ["ne-NP", "en-US"] },
      { id: "Fenrir", name: "Fenrir (stock)", supportsClone: false, languages: ["ne-NP", "en-US"] },
    ];
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const t0 = Date.now();
    try {
      if (this.generateFn) {
        const buf = await this.generateFn(req.text, {
          voice: req.voiceId ?? "Kore",
          styleHint: req.styleHint,
        });
        return {
          ok: true,
          engineId: this.id,
          voiceId: req.voiceId ?? "Kore",
          audioBuffer: buf,
          sampleRate: req.sampleRate ?? 24000,
          latencyMs: Date.now() - t0,
          consumedRepresentation: req.representation,
          evidence: "VERIFIED",
        };
      }
      if (!this.resolveApiKey()) {
        return { ok: false, engineId: this.id, error: "Gemini unavailable (no key)", isStub: false };
      }
      const apiKey = this.resolveApiKey()!;
      const model = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
      // Live Gemini call — mirrors server.ts generateGeminiTTS shape
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      (req.styleHint
                        ? `Read in Nepali with this direction: ${req.styleHint}. `
                        : "Read naturally in Nepali. ") + req.text,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: req.voiceId ?? "Kore" },
                },
              },
            },
          }),
        },
      );
      if (!res.ok) {
        const status = res.status;
        return {
          ok: false,
          engineId: this.id,
          error: `Gemini HTTP ${status}${status === 429 || status === 503 ? " (quota — mark unavailable)" : ""}`,
          latencyMs: Date.now() - t0,
          isStub: false,
        };
      }
      const json = (await res.json()) as any;
      const b64 = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!b64) {
        return { ok: false, engineId: this.id, error: "Gemini returned no audio", latencyMs: Date.now() - t0 };
      }
      let pcm = Buffer.from(b64, "base64");
      let wavBuf = pcm;
      const sr = req.sampleRate ?? 24000;
      if (pcm.length >= 4 && pcm.toString("ascii", 0, 4) !== "RIFF") {
        // Wrap 16-bit mono PCM into standard WAV
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = (sr * numChannels * bitsPerSample) / 8;
        const blockAlign = (numChannels * bitsPerSample) / 8;
        const header = Buffer.alloc(44);
        header.write("RIFF", 0);
        header.writeUInt32LE(36 + pcm.length, 4);
        header.write("WAVE", 8);
        header.write("fmt ", 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20); // PCM format
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sr, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(bitsPerSample, 34);
        header.write("data", 36);
        header.writeUInt32LE(pcm.length, 40);
        wavBuf = Buffer.concat([header, pcm]);
      }
      const durSec = pcm.length / (sr * 2);
      return {
        ok: true,
        engineId: this.id,
        voiceId: req.voiceId ?? "Kore",
        audioBuffer: wavBuf,
        sampleRate: sr,
        durationSec: Number(durSec.toFixed(3)),
        latencyMs: Date.now() - t0,
        consumedRepresentation: req.representation,
        evidence: "VERIFIED",
      };
    } catch (e) {
      return { ok: false, engineId: this.id, error: String(e), latencyMs: Date.now() - t0 };
    }
  }
}
