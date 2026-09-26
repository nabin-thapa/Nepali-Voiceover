/**
 * KalaEngine — real local CPU adapter for Ampixa kala-tts (real-nepali VITS ONNX).
 * Package: pypi kala-tts 0.1.4 · Python >=3.10 · model ampixa/real-nepali-v0.2-kala (~78 MB ONNX, first call).
 * License: MIT (code) / CC-BY-SA-4.0 (weights). Evidence: VERIFIED only when WAV bytes parse as real PCM.
 */
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { TTSEngine, TTSEngineVoice, TTSSynthesisRequest, TTSSynthesisResult, TextRepresentation } from "./types";

const DEFAULT_SPEAKER = process.env.KALA_SPEAKER || "kala";
const PY = process.env.KALA_PYTHON || process.env.PYTHON || "python";

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

function runPython(args: string[], opts?: { timeoutMs?: number }): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(PY, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" } });
    let stdout = "";
    let stderr = "";
    const timeoutMs = opts?.timeoutMs ?? 60000;
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
  });
}

export class KalaEngine implements TTSEngine {
  readonly id = "kala";
  readonly displayName = "kala-tts real-nepali (local CPU)";
  readonly local = true;
  readonly supportsNepali: "verified" = "verified";
  readonly supportsClone = false;
  readonly license = "MIT code / CC-BY-SA-4.0 weights";
  readonly representations: TextRepresentation[] = ["normalized", "raw", "engine-specific"];

  private availableCache?: { available: boolean; reason?: string };

  async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    if (this.availableCache) return this.availableCache;
    const probe = await runPython(
      ["-c", "import kala_tts,sys; print('OK', getattr(kala_tts,'__version__','0.1.4')); print('speakers', list(kala_tts.list_speakers()) if callable(getattr(kala_tts,'list_speakers',None)) else 'n/a')"],
      { timeoutMs: 15000 },
    );
    if (probe.code === 0 && probe.stdout.includes("OK")) {
      this.availableCache = { available: true };
    } else {
      this.availableCache = {
        available: false,
        reason: probe.code === -1 && probe.stderr.includes("timeout")
          ? "python/kala-tts probe timeout"
          : `kala-tts not importable via '${PY}' — pip install kala-tts (Python>=3.10). ${probe.stderr.slice(0, 200)}`,
      };
    }
    return this.availableCache;
  }

  async listVoices(): Promise<TTSEngineVoice[]> {
    const speakers = ["kala", "barsha", "slr143_F", "slr43_0546", "slr43_2099"];
    return speakers.map((id) => ({
      id,
      name: id === "kala" ? "kala (recommended)" : id,
      supportsClone: false,
      languages: ["ne"],
    }));
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const t0 = Date.now();
    const avail = await this.isAvailable();
    if (!avail.available) {
      return { ok: false, engineId: this.id, error: avail.reason ?? "kala unavailable", isStub: false };
    }

    const speaker = (req.voiceId || DEFAULT_SPEAKER).trim();
    const text = (req.text ?? "").trim();
    if (!text) {
      return { ok: false, engineId: this.id, error: "empty text", latencyMs: Date.now() - t0 };
    }

    const outDir = path.join(process.cwd(), "benchmark", "out-nepali", "kala", "_tmp");
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `synth-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`);

    // Isolated UTF-8 helper — avoids shell quoting issues with Devanagari on Windows.
    const helper = [
      "import json,sys,time,os",
      "sys.stdout.reconfigure(encoding='utf-8')",
      "import kala_tts",
      "text=sys.stdin.read()",
      "speaker=sys.argv[1]",
      "out=sys.argv[2]",
      "t0=time.time()",
      "wav=kala_tts.synthesize(text, speaker=speaker)",
      "dt=time.time()-t0",
      "open(out,'wb').write(wav)",
      "print(json.dumps({'ok':True,'bytes':len(wav),'genSec':round(dt,4),'speaker':speaker}))",
    ].join(";");

    try {
      const proc = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn(PY, ["-c", helper, speaker, outFile], {
          windowsHide: true,
          env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
        });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
          child.kill();
          resolve({ code: -1, stdout, stderr: stderr + "\n[timeout 60s]" });
        }, 60000);
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
        child.stdin.write(text, "utf8");
        child.stdin.end();
      });

      const latencyMs = Date.now() - t0;
      if (proc.code !== 0 || !fs.existsSync(outFile)) {
        return {
          ok: false,
          engineId: this.id,
          latencyMs,
          error: `kala python failed (code ${proc.code}): ${proc.stderr.slice(0, 400) || proc.stdout.slice(0, 400)}`,
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
        // VERIFIED = real local PCM written and parsed (playable WAV bytes), not API-only success.
        evidence: "VERIFIED",
      };
    } catch (e) {
      return { ok: false, engineId: this.id, latencyMs: Date.now() - t0, error: String(e), isStub: false };
    }
  }
}
