/**
 * IndicParlerEngine — real local adapter for AI4Bharat Indic Parler-TTS.
 * Model: ai4bharat/indic-parler-tts (Apache-2.0) / naklitechie/indic-parler-tts mirror.
 * Python >=3.10 · parler-tts 0.2.2 · transformers · torch · soundfile.
 * Supports Devanagari text directly with controllable descriptive captions and 69 speakers (Amrita recommended for Nepali).
 * Evidence: VERIFIED only when real local WAV audio is generated and parsed.
 */
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { TTSEngine, TTSEngineVoice, TTSSynthesisRequest, TTSSynthesisResult, TextRepresentation } from "./types";

const DEFAULT_SPEAKER = process.env.INDIC_PARLER_SPEAKER || "Amrita";
const PY = process.env.INDIC_PARLER_PYTHON || process.env.PYTHON || "python";
const SCRIPT_PATH = path.join(process.cwd(), "scripts", "indic_parler_synth.py");

function parseWav(buf: Buffer): { sampleRate: number; durationSec: number; channels: number; bitsPerSample: number } | null {
  if (buf.length < 44) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bitsPerSample = buf.readUInt16LE(body + 14);
    } else if (id === "data") {
      dataSize = Math.min(size, buf.length - body);
      break;
    }
    offset = body + size + (size % 2);
  }
  if (!sampleRate || !channels || !bitsPerSample) return null;
  const bytesPerFrame = (bitsPerSample / 8) * channels;
  const durationSec = bytesPerFrame > 0 ? dataSize / bytesPerFrame / sampleRate : 0;
  return { sampleRate, durationSec, channels, bitsPerSample };
}

function runPython(args: string[], opts?: { timeoutMs?: number; input?: string }): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(PY, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" } });
    let stdout = "";
    let stderr = "";
    const timeoutMs = opts?.timeoutMs ?? 180000;
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: -1, stdout, stderr: stderr + "\n[timeout]" });
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(err) });
    });

    if (opts?.input) {
      child.stdin.write(opts.input, "utf8");
      child.stdin.end();
    }
  });
}

export class IndicParlerEngine implements TTSEngine {
  readonly id = "indic_parler";
  readonly displayName = "Indic Parler-TTS (local, AI4Bharat)";
  readonly local = true;
  readonly supportsNepali: "verified" = "verified";
  readonly supportsClone = false;
  readonly license = "Apache-2.0";
  readonly representations: TextRepresentation[] = ["normalized", "raw", "engine-specific"];

  private availableCache?: { available: boolean; reason?: string };

  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    if (this.availableCache) return this.availableCache;
    const probe = await runPython([SCRIPT_PATH, "--probe"], { timeoutMs: 15000 });
    if (probe.code === 0 && probe.stdout.includes('"available": true')) {
      this.availableCache = { available: true };
    } else {
      this.availableCache = {
        available: false,
        reason: probe.code === -1 && probe.stderr.includes("timeout")
          ? "Indic Parler probe timeout"
          : `Indic Parler dependencies not available via '${PY}'. ${probe.stderr.slice(0, 200)}`,
      };
    }
    return this.availableCache;
  }

  async listVoices(): Promise<TTSEngineVoice[]> {
    return [
      { id: "Amrita", name: "Amrita (Nepali recommended female)", supportsClone: false, languages: ["ne"] },
      { id: "Rohit", name: "Rohit (Indic male)", supportsClone: false, languages: ["hi", "ne"] },
      { id: "Divya", name: "Divya (Indic female)", supportsClone: false, languages: ["hi", "ne"] },
    ];
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const t0 = Date.now();
    const avail = await this.isAvailable();
    if (!avail.available) {
      return { ok: false, engineId: this.id, error: avail.reason ?? "indic_parler unavailable", isStub: false };
    }

    const speaker = (req.voiceId || DEFAULT_SPEAKER).trim();
    const text = (req.text ?? "").trim();
    if (!text) {
      return { ok: false, engineId: this.id, error: "empty text", latencyMs: Date.now() - t0 };
    }

    const outDir = path.join(process.cwd(), "benchmark", "out-nepali", "indic_parler", "_tmp");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `synth-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`);

    const args = [
      SCRIPT_PATH,
      "--voice", speaker,
      "--out", outFile,
    ];
    if (req.styleHint) {
      args.push("--style", req.styleHint);
    }

    try {
      const proc = await runPython(args, {
        timeoutMs: 180000,
        input: text,
      });

      const latencyMs = Date.now() - t0;
      if (proc.code !== 0 || !fs.existsSync(outFile)) {
        return {
          ok: false,
          engineId: this.id,
          latencyMs,
          error: `Indic Parler python failed (code ${proc.code}): ${proc.stderr.slice(0, 400) || proc.stdout.slice(0, 400)}`,
        };
      }

      const buf = fs.readFileSync(outFile);
      try {
        fs.unlinkSync(outFile);
      } catch { /* ignore */ }

      const wav = parseWav(buf);
      if (!wav || wav.durationSec <= 0.01 || buf.length < 44) {
        return { ok: false, engineId: this.id, latencyMs, error: "output missing/invalid WAV header or zero duration" };
      }

      return {
        ok: true,
        engineId: this.id,
        voiceId: speaker,
        audioBuffer: buf,
        sampleRate: wav.sampleRate,
        durationSec: wav.durationSec,
        latencyMs,
        consumedRepresentation: req.representation,
        isStub: false,
        evidence: "VERIFIED",
      };
    } catch (e) {
      return { ok: false, engineId: this.id, latencyMs: Date.now() - t0, error: String(e), isStub: false };
    }
  }
}
