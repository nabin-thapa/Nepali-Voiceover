# Nepali TTS Training Plan

Date: 2026-09-24
Status: **EXPERIMENTAL PLAN — nothing auto-starts. Requires: PASS dataset-report + human eval baseline + explicit user command.**

Related: `docs/NEPALI_DATASET_PLAN.md`, `docs/NEPALI_RECORDING_STANDARD.md`, `docs/TTS_FOUNDATION_RESEARCH.md`.

---

## Pre-flight gates (all required)

| Gate | Command / artifact |
|---|---|
| Dataset validated | `npm run dataset:validate -- ./my-dataset` → PASS in DATASET_REPORT.json |
| Human baseline exists | ≥10 listening rows in `docs/ENGINE_COMPARISON.md` |
| Engine choice documented | Why this base model (license + Nepali + clone needs) |
| GPU/disk checked | `npm run system:check` + free VRAM/disk noted |
| User explicit | Human types the train command — **no schedule, no CI auto-run** |

---

## Experiment matrix (1–6)

### Experiment 1 — Smoke fine-tune (no quality claims)

| Field | Value |
|---|---|
| Base | Smallest viable: Matcha-Nepali or kala-style head OR LoRA on chosen base |
| Data | 10–30 min validated smoke set |
| Steps | Tiny (e.g. ≤1k steps) — prove plumbing only |
| Success | Loss decreases; samples generate; **not** "good quality" |
| Fail | Crash / NaN → fix env, do not scale data yet |
| Evidence after | NOT YET TESTED |

### Experiment 2 — LoRA pilot (primary path)

| Field | Value |
|---|---|
| Base | Top local candidate after research: **Indic Parler-TTS** (Apache-2.0) or **Chatterbox-Nepali** (MIT) |
| Data | 2–5 h validated, single speaker first |
| Method | LoRA / adapter (freeze most weights) |
| Eval | Same 50 pronunciation cases vs zero-shot base + Fish |
| Success | Human pronunciation mean ↑ vs base without naturalness collapse |
| Evidence | Human listening required (protocol above) |

### Experiment 3 — Data ablation

| Field | Value |
|---|---|
| Question | Does category balance (B/C/D/E aspirate/retroflex/nasal/conjunct) beat random hours? |
| Arms | (a) balanced 2 h vs (b) random 2 h |
| Metric | Category-wise human pronunciation on hard cases K–R |

### Experiment 4 — Multi-speaker (only if needed)

| Field | Value |
|---|---|
| When | Product needs ≥2 identities |
| Data | 2+ speakers, speaker IDs in metadata |
| Risk | Quality drop at low data — keep single-speaker champion as fallback |

### Experiment 5 — Clone + FT hybrid

| Field | Value |
|---|---|
| Idea | Zero-shot clone (Fish/Chatterbox) for identity + FT for Nepali phonemes |
| Test | Does FT base + short clone prompt beat pure cloud clone? |
| License | Must remain private-usable |

### Experiment 6 — Distill / quantize for CPU

| Field | Value |
|---|---|
| When | Local GPU inconvenient; want kala-class CPU speed |
| Method | Distill to smaller student or ONNX quantize |
| Constraint | Measure intelligibility, not just RTF |

---

## Explicit non-goals

- No multi-week pretrain from scratch on this machine
- No claiming SOTA without external benchmark protocol
- No shipping CC-BY-NC / CPML weights commercially without license pass
- No scraping to fill data holes

## Stop rules

1. Two failed smoke runs → stop, fix environment.
2. Human pronunciation worse than Fish baseline after pilot → do not scale steps; re-check data/G2P.
3. License conflict discovered → abandon that base, document in ENGINE_COMPARISON.

## How to actually start (human only)

Example shape — **do not run automatically**:

```bash
# ONLY after gates pass and human decides:
# <base-model-train-command> --config configs/exp2-lora.yaml
```

Record: git commit, dataset hash, config, date, VRAM, results in this file.
