# Phase 5 / 11 — Fine-tuning plan & real limit

**Status:** PLAN ONLY. No training is started by this project.

## What your app actually is

- **Not** local fish-speech Python.
- **100% Fish Audio cloud** (`POST /v1/tts`, header `model: s2.1-pro-free`).
- Cloning = cloud zero-shot via `reference_id` + sample upload (`POST /model`).
- Gemini ne-NP = quality reference / native mode (stock voices only, not your clone).

## Can the CURRENT checkpoint be fine-tuned for Nepali?

| Path | Possible today? | Notes |
|---|---|---|
| **A. Fish cloud full/language FT** | **Unknown — must check Fish dashboard/docs** | Repo only shows clone API. If cloud has no language FT, CASE D cannot be fixed on Fish alone. |
| **B. Local fish-speech FT** | **Not without adding a whole new subsystem** | No `.py`, no weights, no GPU loop in this repo. Would be Phase 5b separate project. |
| **C. Alternative engine** | **Optional modular flag** | `config/tts-engines.json` → `TTS_ENGINE=ALTERNATIVE` without destroying Fish path. |

## If you pursue local FT later (VERIFY against YOUR fish-speech version)

| Item | Guidance |
|---|---|
| Method | LoRA on text/LM backbone first; full FT only if LoRA insufficient |
| Language + speaker together | Mix Nepali corpus; freeze or lightly touch speaker encoder; keep target-speaker audio in mix to protect identity |
| Min single-speaker joint data | ~5–20 h clean Nepali for serious adaptation; clone samples (minutes) are not enough for deep language FT |
| Multi-speaker language | 50 h+ recommended for robust ne-TTS |
| Format | 16-bit PCM WAV; ≥16 kHz (22.05/24 kHz typical); UTF-8 Devanagari transcripts |
| Segments | ~0.5–15 s, one speaker, no music/overlap |
| VRAM | LoRA often feasible on 12–24 GB class; full FT higher — **confirm in fish-speech docs** |
| Risk | Language FT on a *different* speaker can destroy your clone similarity → always A/B speaker identity (Phase 7) |
| Auto-train | **Forbidden** until plan approved |

**Dataset tooling:** `npx tsx scripts/dataset-validate.ts ./my-dataset` → `DATASET_REPORT.json` (never trains).

## Honest limit (Phase 11)

After Phase 1 diagnostics:

1. **CASE A** — preprocessing still has collateral risk (large regex lexicons) but is measurable.
2. **CASE B** — representation is constrained: Fish accepts **orthographic Devanagari only** for Nepali (no phonemes, no language code). We have built an intermediate representation around that constraint.
3. **CASE C** — reference/clone quality matters (1-sample clones are weak).
4. **CASE D** — **LIKELY TRUE in part:** `s2.1-pro-free` Nepali linguistic coverage is **unverifiable** and there is **no language channel**. Text prep cannot guarantee Gemini-class pronunciation if the acoustic model does not know Nepali well.
5. **CASE E** — overall = **combination (A+B+C+D)**.

**Do not keep adding word patches forever.** Next levers that actually matter:

1. Better **reference audio** (multi-sample Kathmandu Devanagari, 15–30 s, clean).
2. **Gemini as reference** for quality (already in app native mode).
3. **Prove or disprove CASE D** with `scripts/compare-gemini-fish.ts` (same text, listen).
4. Only then: **Fish cloud FT if it exists**, or **modular alternative engine**, or **local FT as separate module**.

## Commands

```bash
npm run dev
npm run benchmark                          # Phase 2 — 100+ sentences generate
npx tsx scripts/compare-gemini-fish.ts     # Phase 10 — side-by-side
npx tsx scripts/dataset-validate.ts ./ds   # Phase 6 — before any train
npm run test:pronunciation
npm run lint
```

## Adding pronunciation data (no source edits)

```bash
# via UI: Pronunciation panel
# via API:
curl -X POST http://localhost:3000/api/pronunciation \
  -H "Content-Type: application/json" \
  -d '{"from":"भैंसी","to":"भैँसी"}'
```

Stored in `pronunciation.json` (user) + `nepali_pronunciation.json` (project dictionary).
