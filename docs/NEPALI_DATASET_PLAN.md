# Nepali Dataset Plan

Date: 2026-09-24
Status: **PLAN — VERIFIED layout constraints; no data collected yet (NOT YET TESTED)**

## Purpose

Build a **private, licensed** Nepali TTS dataset suitable for small fine-tunes (LoRA / few-hour experiments), validated by `npm run dataset:validate` before any training.

## Targets (ASSUMED starting point — adjust after first validator run)

| Tier | Hours | Use |
|---|---|---|
| Smoke | 10–30 min | Pipeline plumbing only |
| LoRA pilot | 2–5 h | First real fine-tune experiment |
| Strong FT | 10–20 h | Competitive local quality |

**Source rule:** only self-recorded, consented, or clearly licensed material. No scraped celebrity voices.

## Layout (must match `scripts/dataset-validate.ts`)

```
my-dataset/
  metadata.jsonl    # one JSON object per line
  wav/
    001.wav
    002.wav
    ...
```

metadata line:

```json
{"audio":"wav/001.wav","text":"नेपाली वाक्य...","duration":3.2,"category":"A-everyday","speaker":"spk01"}
```

## Categories (validator A–J)

| Code | Focus |
|---|---|
| A-everyday | Everyday Kathmandu conversation |
| B-aspirate | ख छ थ फ भ |
| C-retroflex | ट ठ ड ढ ण |
| D-nasal | ँ ं |
| E-conjunct | ज्ञ क्ष त्र श्र |
| F-question | Questions / intonation |
| G-numbers | Numbers, dates, names |
| H-paragraph | Long continuous paragraph |
| I-loanwords | Loanwords in Devanagari |
| J-emotion | Subtle emotion / pace range |

Corpus categories A–Z (`benchmark/nepali/corpus.json`) map into these by recording batch — see `docs/NEPALI_RECORDING_STANDARD.md`.

## Quality gates (all must PASS in DATASET_REPORT)

- WAV parseable, PCM 16-bit preferred, mono
- No hard clipping
- Silence fraction below threshold
- Noise floor / noise-to-speech within threshold
- filename ↔ metadata match
- Devanagari transcript present
- category matches `^[A-J]`

## Pipeline order

1. Record per `docs/NEPALI_RECORDING_STANDARD.md` + existing recording script
2. Transcribe / align text (manual review for Nepali)
3. `npm run dataset:validate -- ./my-dataset` → `DATASET_REPORT.json` + `docs/DATASET_REPORT.md`
4. Fix errors, re-run until PASS
5. Only then consider `docs/NEPALI_TTS_TRAINING_PLAN.md` Experiment 1
6. Never skip validator; never auto-train

## Out of scope

- Cloud dataset marketplaces with unclear rights
- Multi-speaker mixing without speaker IDs
- English-heavy datasets (wrong language for Nepali FT)
