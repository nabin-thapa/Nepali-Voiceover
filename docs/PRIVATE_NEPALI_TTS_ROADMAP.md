# Private Nepali TTS Roadmap

Date: 2026-09-24
Labels: **VERIFIED** · **EXPERIMENTAL** · **ASSUMED** · **NOT YET TESTED**

Goal: best **private/local** Nepali TTS research system on top of this app — no SaaS rebuild, no fake quality, no auto-training.

---

## Phase R0 — Research foundation ✅

| Deliverable | Path | Status |
|---|---|---|
| TTS foundation research | `docs/TTS_FOUNDATION_RESEARCH.md` | VERIFIED sources |
| Architecture | `docs/NEPALI_TTS_ARCHITECTURE.md` | VERIFIED structure |
| Engine adapters | `src/engines/*` | EXPERIMENTAL (stubs for local) |
| Research endpoints | `/api/research/*` | VERIFIED live-tested (fish synthesize 200; stub 503) |
| `system:check` | `npm run system:check` | ready |

## Phase R1 — Benchmark corpus ✅

| Deliverable | Path | Status |
|---|---|---|
| 316 sentences A–Z | `benchmark/nepali/corpus.json` | VERIFIED count |
| 50 pronunciation cases | `benchmark/nepali/pronunciation_cases.json` | VERIFIED count |
| Human eval protocol | `docs/NEPALI_HUMAN_EVALUATION.md` | PROTOCOL READY / scores NOT YET TESTED |
| `benchmark:nepali` | `npm run benchmark:nepali` | ready |
| `benchmark:compare` | `npm run benchmark:compare` | ready |

## Phase R2 — Human listening ⬜

- [ ] Listen Engine A (Fish) on 50 cases → CSV rows
- [ ] Listen Engine B (Gemini when quota / kala) → CSV rows
- [ ] Fill `docs/ENGINE_COMPARISON.md` with VERIFIED (listened) scores
- [ ] **Gate:** no engine declared "winner" without listening

## Phase R3 — Local engine A/B ⬜

- [ ] Request gated access `ai4bharat/indic-parler-tts`
- [x] `pip install kala-tts` → CPU generate 30 sentences → **WAV on disk** (`docs/KALA_POC_REPORT.md`)
- [x] Wire real backend for id `kala` only (Fish/Gemini/stub siblings unchanged)
- [ ] Human listen kala 30 WAVs → fill `ENGINE_COMPARISON.md`
- [ ] Re-run `benchmark:compare --engines=fish,kala` after listening
- [ ] Optional: GPU setup + Chatterbox-Nepali FT (only after listening justifies it)

## Phase R4 — Dataset pipeline ⬜

| Deliverable | Path | Status |
|---|---|---|
| Dataset plan | `docs/NEPALI_DATASET_PLAN.md` | written |
| Recording standard | `docs/NEPALI_RECORDING_STANDARD.md` | written |
| Recording script | `docs/NEPALI_REFERENCE_RECORDING_SCRIPT.md` (existing) | VERIFIED |
| Validator | `npm run dataset:validate` | VERIFIED existing |
| Dataset report | `docs/DATASET_REPORT.md` | generated from validator |

## Phase R5 — Small training experiment plan ⬜

| Deliverable | Path | Status |
|---|---|---|
| Training plan Experiments 1–6 | `docs/NEPALI_TTS_TRAINING_PLAN.md` | PLAN ONLY — **no auto-start** |

Gate before any train: dataset-report PASS + human eval baseline + explicit user command.

## Phase R6 — Decision ⬜

- [ ] Compare private fine-tune vs best public Nepali model vs Fish
- [ ] Update ENGINE_COMPARISON with listening-backed decision
- [ ] Commercial license review (avoid CC-BY-NC / CPML for product)

---

## Hard rules (carry forward)

1. Do not delete Fish integration or working `/api/tts/*` flows.
2. Do not fake benchmark results or claim quality without listening.
3. Do not auto-start training.
4. Do not scrape voices.
5. Do not add payments/accounts/SaaS.
6. Gemini quota fail → mark unavailable, never fake.
7. Every new claim gets an evidence label.
