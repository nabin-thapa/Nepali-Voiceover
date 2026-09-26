/**
 * Optional multi-reference dataset loader for Fish /v1/tts `references[]` (msgpack).
 * Default path is OFF — only used when fishMultiReference.enabled or FISH_MULTI_REF=1.
 *
 * Layout (reference-audio/):
 *   01-kathmandu-everyday.wav
 *   01-kathmandu-everyday.txt   ← exact Devanagari transcript (or metadata.jsonl)
 *   metadata.jsonl (optional): {"file":"01-....wav","text":"...","category":"A"}
 */
import fs from "fs";
import path from "path";

export interface RefSample {
  file: string;
  audioPath: string;
  text: string;
  category?: string;
}

const AUDIO_EXT = new Set([".wav", ".mp3", ".flac", ".m4a", ".ogg", ".opus"]);

export function loadReferenceSamples(
  dir: string,
  maxSamples = 5,
): RefSample[] {
  const root = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  if (!fs.existsSync(root)) return [];

  const byFile = new Map<string, { text: string; category?: string }>();
  const metaPath = path.join(root, "metadata.jsonl");
  if (fs.existsSync(metaPath)) {
    for (const line of fs.readFileSync(metaPath, "utf-8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j && typeof j.file === "string" && typeof j.text === "string") {
          byFile.set(path.basename(j.file), {
            text: j.text.trim(),
            category: j.category,
          });
        }
      } catch {
        /* skip bad line */
      }
    }
  }

  const out: RefSample[] = [];
  for (const name of fs.readdirSync(root).sort()) {
    const full = path.join(root, name);
    if (!fs.statSync(full).isFile()) continue;
    const ext = path.extname(name).toLowerCase();
    if (!AUDIO_EXT.has(ext)) continue;
    const base = name.slice(0, name.length - ext.length);
    let text = byFile.get(name)?.text || "";
    let category = byFile.get(name)?.category;
    const side = path.join(root, base + ".txt");
    if (!text && fs.existsSync(side)) {
      text = fs.readFileSync(side, "utf-8").trim();
    }
    if (!text) continue;
    if (!/[\u0900-\u097F]/.test(text)) continue; // require Devanagari transcript
    out.push({ file: name, audioPath: full, text, category });
    if (out.length >= maxSamples) break;
  }
  return out;
}

export function isMultiRefEnabled(env: NodeJS.ProcessEnv, cfg?: { enabled?: boolean }): boolean {
  const envFlag = (env.FISH_MULTI_REF || "").toLowerCase();
  if (envFlag === "1" || envFlag === "true" || envFlag === "on") return true;
  if (envFlag === "0" || envFlag === "false" || envFlag === "off") return false;
  return cfg?.enabled === true;
}
