/**
 * Phase 6/14 — Nepali dataset pipeline (HIGH quality gate).
 * Validates samples BEFORE any training. Never auto-trains.
 *
 * Usage:
 *   npx tsx scripts/dataset-validate.ts ./my-dataset
 *   npm run dataset:validate -- ./my-dataset
 *
 * Expected layout:
 *   my-dataset/
 *     metadata.jsonl   lines: {"audio":"wav/001.wav","text":"नेपाली...","duration":3.2,"category":"A-everyday"}
 *     wav/*.wav
 *
 * Checks: PCM/RMS/clipping/silence, filename↔metadata match, category A–J,
 * noise floor estimate, reverb/tail estimate (heuristic), Devanagari transcripts.
 * Writes: my-dataset/DATASET_REPORT.json
 */
import fs from "fs";
import path from "path";

/** Recommended categories for Kathmandu reference sets (docs/NEPALI_REFERENCE_RECORDING_SCRIPT.md). */
const CATEGORIES_A_J: Record<string, string> = {
  "A-everyday": "Everyday Kathmandu conversation",
  "B-aspirate": "Aspirates ख छ थ फ भ",
  "C-retroflex": "Retroflex ट ठ ड ढ ण",
  "D-nasal": "Nasals ँ ं",
  "E-conjunct": "Conjuncts ज्ञ क्ष त्र श्र",
  "F-question": "Questions / intonation",
  "G-numbers": "Numbers, dates, names",
  "H-paragraph": "Long continuous paragraph",
  "I-loanwords": "Loanwords in Devanagari",
  "J-emotion": "Subtle emotion / pace range",
};

const CATEGORY_RE = /^[A-J](-[a-z]+)?$/i;

interface MetaLine {
  audio: string;
  text: string;
  duration?: number;
  speaker?: string;
  category?: string;
}

interface Issue {
  file: string;
  level: "error" | "warn";
  code: string;
  message: string;
}

interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSec: number;
  peak: number;
  rms: number;
  silentFrac: number;
  clipped: boolean;
  noiseFloorRms: number;
  noiseToSpeechRatio: number;
  tailRms: number;
  reverbSuspect: boolean;
  noiseSuspect: boolean;
  ok: boolean;
}

function readWavInfo(buf: Buffer): WavInfo | null {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 1;
  let bitsPerSample = 16;
  let audioFormat = 1;
  let dataStart = -1;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      audioFormat = buf.readUInt16LE(offset + 8);
      channels = buf.readUInt16LE(offset + 10) || 1;
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22) || 16;
    } else if (id === "data") {
      dataStart = offset + 8;
      dataSize = Math.min(size, buf.length - dataStart);
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataStart < 0 || sampleRate === 0) return null;
  const bytesPerSample = bitsPerSample / 8;
  const frames = Math.floor(dataSize / (bytesPerSample * channels));
  const durationSec = frames / sampleRate;
  let peak = 0;
  let silent = 0;
  let clipped = false;
  const step = Math.max(1, Math.floor(frames / 80000));
  const levels: number[] = [];
  const blockSize = Math.max(1, Math.floor(frames / 200));
  let blockSum = 0;
  let blockN = 0;
  if (bitsPerSample === 16 && audioFormat === 1) {
    for (let i = 0; i < frames; i += step) {
      const s = buf.readInt16LE(dataStart + i * channels * 2);
      const a = Math.abs(s);
      if (a > peak) peak = a;
      if (a >= 32767) clipped = true;
      if (a < 200) silent++;
      const n = (s / 32768) * (s / 32768);
      blockSum += n;
      blockN++;
      if (i % blockSize === 0 && blockN > 0) {
        levels.push(Math.sqrt(blockSum / blockN));
        blockSum = 0;
        blockN = 0;
      }
    }
  }
  if (blockN > 0) levels.push(Math.sqrt(blockSum / blockN));
  const rms = levels.length ? Math.sqrt(levels.reduce((a, b) => a + b * b, 0) / levels.length) : 0;
  const sorted = [...levels].sort((a, b) => a - b);
  const noiseFloorRms = sorted.length ? sorted[Math.floor(sorted.length * 0.1)] : 0;
  const speechRms = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] || rms : rms;
  const noiseToSpeechRatio = speechRms > 1e-6 ? noiseFloorRms / speechRms : 0;
  const tailN = Math.max(1, Math.floor(levels.length * 0.1));
  const tailLevels = levels.slice(-tailN);
  const tailRms = tailLevels.length
    ? Math.sqrt(tailLevels.reduce((a, b) => a + b * b, 0) / tailLevels.length)
    : 0;
  const reverbSuspect = speechRms > 1e-6 && tailRms / speechRms > 0.45 && levels.length > 8;
  const noiseSuspect = noiseToSpeechRatio > 0.35;
  const sampled = Math.max(1, Math.ceil(frames / step));
  return {
    sampleRate,
    channels,
    bitsPerSample,
    durationSec,
    peak,
    rms,
    silentFrac: silent / sampled,
    clipped,
    noiseFloorRms,
    noiseToSpeechRatio,
    tailRms,
    reverbSuspect,
    noiseSuspect,
    ok: true,
  };
}

function basenameNoExt(p: string): string {
  return path.basename(p, path.extname(p));
}

function main() {
  const root = process.argv[2] || "./dataset";
  const metaPath = path.join(root, "metadata.jsonl");
  if (!fs.existsSync(metaPath)) {
    console.error(`Missing ${metaPath}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(metaPath, "utf-8").split(/\r?\n/).filter(Boolean);
  const issues: Issue[] = [];
  const categoriesSeen = new Set<string>();
  const stats = {
    total: lines.length,
    ok: 0,
    errors: 0,
    warns: 0,
    totalDuration: 0,
    sampleRates: {} as Record<number, number>,
    speakers: new Set<string>(),
    categories: {} as Record<string, number>,
    noiseSuspects: 0,
    reverbSuspects: 0,
    filenameMismatches: 0,
    minDuration: Infinity,
    maxDuration: 0,
    avgTextChars: 0,
  };
  let textChars = 0;

  const diskAudio = new Set<string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(wav|mp3|flac|m4a|ogg|opus)$/i.test(e.name)) {
        diskAudio.add(path.basename(e.name).toLowerCase());
        diskAudio.add(basenameNoExt(e.name).toLowerCase());
      }
    }
  };
  walk(root);

  for (let i = 0; i < lines.length; i++) {
    let meta: MetaLine;
    try {
      meta = JSON.parse(lines[i]);
    } catch {
      issues.push({ file: `line ${i + 1}`, level: "error", code: "BAD_JSON", message: "invalid JSONL" });
      stats.errors++;
      continue;
    }
    const audioPath = path.isAbsolute(meta.audio) ? meta.audio : path.join(root, meta.audio);
    const label = meta.audio || `line ${i + 1}`;
    const baseName = basenameNoExt(meta.audio || "");
    const fileBase = baseName.toLowerCase();

    if (baseName) {
      const hasOnDisk =
        diskAudio.has(path.basename(meta.audio).toLowerCase()) ||
        diskAudio.has(fileBase);
      if (!hasOnDisk) {
        issues.push({
          file: label,
          level: "warn",
          code: "FILENAME_NOT_ON_DISK",
          message: `no audio file matching "${path.basename(meta.audio)}" under ${root}`,
        });
        stats.warns++;
        stats.filenameMismatches++;
      }
      const catFromFile = fileBase.match(/^([a-j])(?:[-_]|$)/i);
      if (!meta.category && !catFromFile) {
        issues.push({
          file: label,
          level: "warn",
          code: "FILENAME_CATEGORY_MISSING",
          message: "filename does not start with category A–J (e.g. 01-A-everyday.wav) and category field empty",
        });
        stats.warns++;
      }
    }

    if (!meta.text || !meta.text.trim()) {
      issues.push({ file: label, level: "error", code: "NO_TEXT", message: "missing transcript" });
      stats.errors++;
      continue;
    }
    if (!/[ऀ-ॿ]/.test(meta.text)) {
      issues.push({ file: label, level: "error", code: "NOT_DEVANAGARI", message: "transcript has no Devanagari (must be Nepali script)" });
      stats.errors++;
      continue;
    }

    const catFromFile = fileBase.match(/^([a-j])(?:[-_]|$)/i);
    const cat = (meta.category || (catFromFile?.[1] ? catFromFile[1].toUpperCase() : "")).trim();
    if (cat) {
      const norm = cat.length === 1
        ? Object.keys(CATEGORIES_A_J).find((k) => k.startsWith(cat.toUpperCase() + "-")) || cat.toUpperCase()
        : cat;
      if (!CATEGORY_RE.test(norm) && !Object.keys(CATEGORIES_A_J).some((k) => k.toLowerCase() === norm.toLowerCase())) {
        issues.push({
          file: label,
          level: "warn",
          code: "UNKNOWN_CATEGORY",
          message: `category "${cat}" not in A–J set`,
        });
        stats.warns++;
      }
      categoriesSeen.add(norm.toUpperCase().slice(0, 1));
      stats.categories[norm] = (stats.categories[norm] || 0) + 1;
    }

    textChars += meta.text.length;
    if (meta.speaker) stats.speakers.add(meta.speaker);
    if (!fs.existsSync(audioPath)) {
      issues.push({ file: label, level: "error", code: "MISSING_AUDIO", message: meta.audio });
      stats.errors++;
      continue;
    }
    const buf = fs.readFileSync(audioPath);
    const info = readWavInfo(buf);
    if (!info) {
      issues.push({ file: label, level: "error", code: "NOT_WAV", message: "not RIFF/WAVE PCM" });
      stats.errors++;
      continue;
    }
    stats.sampleRates[info.sampleRate] = (stats.sampleRates[info.sampleRate] || 0) + 1;
    stats.totalDuration += info.durationSec;
    stats.minDuration = Math.min(stats.minDuration, info.durationSec);
    stats.maxDuration = Math.max(stats.maxDuration, info.durationSec);
    if (info.sampleRate < 16000) {
      issues.push({ file: label, level: "error", code: "LOW_SR", message: `${info.sampleRate} Hz < 16 kHz` });
      stats.errors++;
    }
    if (info.channels > 1) {
      issues.push({ file: label, level: "warn", code: "STEREO", message: "prefer mono" });
      stats.warns++;
    }
    if (info.durationSec < 0.4) {
      issues.push({ file: label, level: "error", code: "TOO_SHORT", message: `${info.durationSec.toFixed(2)}s` });
      stats.errors++;
    }
    if (info.durationSec > 30) {
      issues.push({ file: label, level: "warn", code: "TOO_LONG", message: `${info.durationSec.toFixed(1)}s — Fish clone best 15–30s per clip` });
      stats.warns++;
    }
    if (info.clipped) {
      issues.push({ file: label, level: "error", code: "CLIP", message: "peak at full scale" });
      stats.errors++;
    }
    if (info.rms < 0.01) {
      issues.push({ file: label, level: "error", code: "QUIET", message: `rms=${info.rms.toFixed(4)} too quiet/silent` });
      stats.errors++;
    }
    if (info.silentFrac > 0.5) {
      issues.push({ file: label, level: "warn", code: "MOSTLY_SILENT", message: `${(info.silentFrac * 100).toFixed(0)}% silent frames sampled` });
      stats.warns++;
    }
    if (info.noiseSuspect) {
      stats.noiseSuspects++;
      issues.push({
        file: label,
        level: "warn",
        code: "NOISE_FLOOR",
        message: `noise/speech ratio ${(info.noiseToSpeechRatio * 100).toFixed(0)}% — room may be too loud`,
      });
      stats.warns++;
    }
    if (info.reverbSuspect) {
      stats.reverbSuspects++;
      issues.push({
        file: label,
        level: "warn",
        code: "REVERB_TAIL",
        message: `tail energy elevated — possible room reverb`,
      });
      stats.warns++;
    }
    const cps = meta.text.length / Math.max(0.1, info.durationSec);
    if (cps > 25) {
      issues.push({ file: label, level: "warn", code: "TEXT_TOO_FAST", message: `${cps.toFixed(1)} chars/s — transcript/audio mismatch?` });
      stats.warns++;
    }
    if (cps < 1 && info.durationSec > 2) {
      issues.push({ file: label, level: "warn", code: "TEXT_TOO_SLOW", message: `${cps.toFixed(1)} chars/s — possible mismatch or long silence` });
      stats.warns++;
    }
    if (issues.filter((x) => x.file === label && x.level === "error").length === 0) {
      stats.ok++;
    }
  }

  const missingCats = Object.keys(CATEGORIES_A_J).filter(
    (code) => !categoriesSeen.has(code[0].toUpperCase()),
  );
  if (missingCats.length && lines.length >= 5) {
    issues.push({
      file: "(dataset)",
      level: "warn",
      code: "CATEGORY_COVERAGE",
      message: `missing recommended categories: ${missingCats.join(", ")} (see NEPALI_REFERENCE_RECORDING_SCRIPT.md)`,
    });
    stats.warns++;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    root,
    summary: {
      total: stats.total,
      ok: stats.ok,
      errors: stats.errors,
      warns: stats.warns,
      totalDurationSec: Number(stats.totalDuration.toFixed(1)),
      totalDurationHours: Number((stats.totalDuration / 3600).toFixed(3)),
      minDuration: stats.minDuration === Infinity ? 0 : Number(stats.minDuration.toFixed(2)),
      maxDuration: Number(stats.maxDuration.toFixed(2)),
      sampleRates: stats.sampleRates,
      speakers: Array.from(stats.speakers),
      categories: stats.categories,
      noiseSuspects: stats.noiseSuspects,
      reverbSuspects: stats.reverbSuspects,
      filenameMismatches: stats.filenameMismatches,
      avgTextChars: stats.total ? Number((textChars / stats.total).toFixed(1)) : 0,
      categoriesAJ: CATEGORIES_A_J,
      recommended: {
        singleSpeakerFineTuneHours: "5–20h high-quality for joint language+speaker; verify against fish-speech version docs",
        multiSpeakerLanguageHours: "50h+ for robust Nepali language adaptation",
        minSampleRate: 16000,
        preferredSampleRate: 44100,
        clipLengthSec: "15–30",
        minClones: 2,
        recordingScript: "docs/NEPALI_REFERENCE_RECORDING_SCRIPT.md",
      },
    },
    trainable: stats.errors === 0 && stats.ok >= 10,
    cloneReady: stats.errors === 0 && stats.ok >= 2,
    issues: issues.slice(0, 500),
    issuesTruncated: issues.length > 500,
  };

  const outPath = path.join(root, "DATASET_REPORT.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`Report → ${outPath}`);

  // Also emit docs/DATASET_REPORT.md (summary mirror for humans)
  try {
    const docsDir = path.join(process.cwd(), "docs");
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
    const issueLines = issues
      .slice(0, 40)
      .map((i) => `| ${i.level} | \`${i.file}\` | ${i.code} | ${i.message} |`)
      .join("\n");
    const md = `# Dataset Report

Generated: ${report.generatedAt}
Source root: \`${root}\`
Evidence: **VERIFIED (machine-checked WAV/metadata)** — not a listening quality score.

## Summary

| Metric | Value |
|---|---|
| Total samples | ${report.summary.total} |
| OK | ${report.summary.ok} |
| Errors | ${report.summary.errors} |
| Warnings | ${report.summary.warns} |
| Total duration | ${report.summary.totalDurationHours} h (${report.summary.totalDurationSec} s) |
| Duration range | ${report.summary.minDuration}–${report.summary.maxDuration} s |
| Speakers | ${report.summary.speakers.join(", ") || "—"} |
| Sample rates | ${JSON.stringify(report.summary.sampleRates)} |
| Noise suspects | ${report.summary.noiseSuspects} |
| Reverb suspects | ${report.summary.reverbSuspects} |
| Filename mismatches | ${report.summary.filenameMismatches} |
| Avg text chars | ${report.summary.avgTextChars} |

## Gates

| Gate | Result |
|---|---|
| \`trainable\` (errors=0 and ≥10 OK) | **${report.trainable}** |
| \`cloneReady\` (errors=0 and ≥2 OK) | **${report.cloneReady}** |

> Never auto-train. See \`docs/NEPALI_TTS_TRAINING_PLAN.md\`.

## Issues (first ${Math.min(issues.length, 40)} of ${issues.length})

| Level | File | Code | Message |
|---|---|---|---|
${issueLines || "| — | — | — | no issues |"}

## Full JSON

\`${path.relative(process.cwd(), outPath).replace(/\\\\/g, "/")}\`

## Related

- \`docs/NEPALI_DATASET_PLAN.md\`
- \`docs/NEPALI_RECORDING_STANDARD.md\`
- \`docs/NEPALI_REFERENCE_RECORDING_SCRIPT.md\`
`;
    const mdPath = path.join(docsDir, "DATASET_REPORT.md");
    fs.writeFileSync(mdPath, md, "utf-8");
    console.log(`Markdown → ${mdPath}`);
  } catch (e) {
    console.warn("Could not write docs/DATASET_REPORT.md:", e);
  }

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`trainable: ${report.trainable}  cloneReady: ${report.cloneReady}`);
  process.exit(report.trainable || report.cloneReady ? 0 : 2);
}

main();
