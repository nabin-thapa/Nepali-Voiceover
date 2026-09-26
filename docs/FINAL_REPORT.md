# FINAL REPORT — Nepali pronunciation / Fish Speech voice clone

Date: 2026-09-23  
Project: `nepali-voiceover-studio` (existing app — **not rebuilt**, UI kept, cloning intact)

---

## 1. Root cause of the pronunciation problem

**CASE E (combination), with a strong CASE D component.**

| Layer | Role |
|---|---|
| **A. Preprocessing** | Measurable; large lexicon surface; now staged + analyzed. Not the sole cause. |
| **B. Representation** | Fish accepts **only orthographic Devanagari text** for Nepali — no language code, no Nepali phonemes, no usable ARPAbet dict. Intermediate representation is constrained by that. |
| **C. Reference / clone** | 1-sample clones (herum, NABIN) are weak; Thapa has 3 samples. Conditioning affects accent stability. |
| **D. Fish model Nepali knowledge** | **`s2.1-pro-free` is cloud-opaque.** Tokenizer + acoustic model for Nepali are unobservable. There is **no language channel**. Text prep cannot force correct pronunciation if the model’s Nepali path is weak. **This is a real limit — say so clearly.** |
| **E. Combined** | What we control = text string + reference_id + sampling. Everything phonetic after that is Fish’s black box. |

**Honest statement:**  
Continuing to only add word patches will **not** reach Gemini-class naturalness. The current Fish checkpoint’s Nepali linguistic capability is **unverified and likely insufficient** for your quality bar without either (a) better reference data + proven text path, (b) Fish language fine-tuning if the cloud offers it, or (c) an alternative engine that supports Nepali + your speaker.

Full stage map: `docs/PHASE1_DIAGNOSTIC.md`.

---

## 2. Fish Speech version

| Field | Value |
|---|---|
| Integration | **Fish Audio cloud HTTP API** (not local fish-speech Python) |
| Endpoint | `POST https://api.fish.audio/v1/tts` |
| Model header | **`s2.1-pro-free`** |
| Clone endpoint | `POST https://api.fish.audio/model` (`train_mode=fast`) |
| Local fish-speech package | **None** (0 `.py` files) |

---

## 3. Model / checkpoint

- Synthesis: **`s2.1-pro-free`** (header only — no local weights).
- Clones in `voices.json`: Thapa `bee6e30d…` (3 samples), herum `955356a4…` (1), NABIN `0b6911a3…` (1).
- Gemini reference (native mode / quality bar): `gemini-2.5-flash-preview-tts` + `languageCode: ne-NP` (stock voices only — **not** your clone).

---

## 4. Current tokenizer behavior

**Not observable.**

- No local tokenizer; Fish returns audio bytes only.
- No token IDs, no phoneme log, no response metadata.
- Comment in code: Fish phoneme tags support **EN / ZH / JA only** — not Nepali.
- Therefore diagnosis of segmentation errors is **only** possible via input-rewrite A/B (benchmark + listen), not via logs.

---

## 5. Current Nepali support limitations (Fish)

1. **No `language` / `ne-NP` field** in TTS payload.
2. **No Nepali phoneme/IPA channel.**
3. **`pronunciation_dictionary` deliberately unused** (ARPAbet → garbles Devanagari).
4. **`normalize` is EN/ZH-oriented** — disabled for Devanagari.
5. **Bracket cues are spoken aloud** — never injected.
6. Language anchoring only at **clone time** (tags + transcripts), not at synthesis.
7. **Director LLM rewrite currently 429-blocked** (all Gemini text models) → local prep is the live pronunciation authority.

---

## 6. Changes made (this phase — no rebuild)

| Change | File(s) |
|---|---|
| Phase 1 diagnostic report | `docs/PHASE1_DIAGNOSTIC.md` |
| Intermediate Fish representation + linguistic analysis + conversational prosody | `nepaliPronounce.ts` |
| Wired into `prepareSpeechTextDebug` (stages: fishRepresentation, conversationalProsody) | `server.ts` |
| Analysis in generate response (`analysis.features`, `riskyWords`, syllables) | `server.ts` |
| User dictionary **UI** (WORD → pronunciation, no source edits) | `src/App.tsx` |
| Modular `TTS_ENGINE` config | `config/tts-engines.json` + `server.ts` |
| 110-sentence benchmark corpus | `benchmark/nepali-benchmark-100.json` |
| Benchmark runner | `scripts/benchmark-run.ts` → `npm run benchmark` |
| Gemini vs Fish comparison workflow | `scripts/compare-gemini-fish.ts` → `npm run compare:reference` |
| Dataset validation (no auto-train) | `scripts/dataset-validate.ts` |
| Fine-tune plan + limit doc | `docs/PHASE5_FINETUNE_PLAN.json`, `docs/PHASE5_AND_11_LIMIT.md` |
| package scripts | `benchmark`, `compare:reference` |

**Not removed:** cloning, existing UI, Fish path, Gemini native path.

---

## 7. New pronunciation architecture

```
Nepali text
  → Unicode normalization          (nepaliNormalize.normalizeNepaliUnicode)
  → Linguistic normalization       (nepaliPronounce.linguisticNormalize)
  → Server prep                    (tags, digits, lexicon, Kathmandu rules)
  → Dictionary (user + project)    (runNepaliNormalize + applyContextDictionary)
  → Word segmentation + analysis   (segmentNepali / analyzeNepaliPronunciation)
  → Fish-compatible representation (ORTHGRAPHIC Devanagari ONLY — buildFishRepresentation)
  → Conversational prosody         (conversationalProsody — not newsreader)
  → scrubFishSpokenText
  → Fish API text field
  → speaker conditioning (reference_id)
  → acoustic model (opaque) → vocoder → audio
```

**Never used:** English phonology rules for Nepali, Latin-as-phonemes, invented IPA for Fish.

Debug stages live example:  
`original → stripTags → serverPrep → unicodeNormalize → latinBrands → dictionary → prosody → fishRepresentation → conversationalProsody → fishInput`

---

## 8. Whether fine-tuning is recommended

| Path | Recommendation |
|---|---|
| **Fish cloud language FT** | **Investigate dashboard/docs** — not proven available from this repo. If unavailable, cannot fix CASE D on Fish alone. |
| **Local fish-speech FT** | Only as a **separate subsystem** (none installed today). Prefer **LoRA first**, keep target-speaker audio in mix. **Do not auto-train.** |
| **Alternative engine** | Optional via `TTS_ENGINE` — only if hardware/license fit. |
| **Immediate high-ROI (no FT)** | Better multi-sample Kathmandu clone + user dictionary + working Gemini reference for quality A/B. |

**Verdict:** Fine-tuning **may be necessary** to close the gap to Gemini-class Nepali on *your* voice, but only after confirming which path is compatible. Plan only: `docs/PHASE5_*`.

---

## 9. Required Nepali dataset size (for FT, if pursued)

| Goal | Rough size |
|---|---|
| Single-speaker joint language+speaker | **~5–20 hours** clean Nepali |
| Multi-speaker language robustness | **50+ hours** |
| Clone-only (current zero-shot) | Minutes–samples (already used; **not** deep language FT) |
| Format | 16-bit PCM WAV; ≥16 kHz (22.05 kHz common); UTF-8 Devanagari transcripts |
| Segments | ~0.5–15 s, one speaker, no music/overlap |
| Validate first | `npx tsx scripts/dataset-validate.ts ./my-dataset` → `DATASET_REPORT.json` |

---

## 10. Required hardware (for local FT if pursued)

| Method | Typical |
|---|---|
| LoRA | Often **12–24 GB VRAM** class (verify fish-speech docs) |
| Full FT | Higher — **24–80 GB** class depending on model |
| Inference (app today) | **None local** — cloud API only |

---

## 11. Whether speaker identity is preserved

| Path | Identity |
|---|---|
| Text-only prep + same `reference_id` | **Yes** — speaker conditioning unchanged |
| Language FT on a *different* speaker without your audio in mix | **Risk of identity loss** — must A/B (Phase 7 protocol in finetune plan) |
| Alternative engine without clone support | Identity lost by definition |

**Today’s changes do not alter speaker embeddings** — only text + analysis + prosody punctuation.

---

## 12. Benchmark results

### Corpus
- **110 sentences** in `benchmark/nepali-benchmark-100.json`  
  (conversational, Kathmandu, rural, animal, everyday, difficult consonants ङ/ञ/ण/न/श/ष/स, ब/भ, द/ध, ड/ढ, ट/ठ, ज/झ, nasals ँ/ं, ज्ञ/क्ष/त्र/श्र, long/short, questions, exclamations, numbers, dates, names, mixed EN)

### Generation (NOT pronunciation score)
| Run | Result |
|---|---|
| `npm run test:pronunciation` | **36/36 PASS** |
| `npm run test:audio` | **26/26 PASS** |
| Sample benchmark (28 items, Fish clone Thapa) | **28/28 generated OK** → `benchmark/out-sample/RESULTS.json` |
| Comparison pairs (10) | **10/10 audio saved** → `benchmark/comparisons/` |
| `npm run lint` | **OK** |

### Critical caveat on comparison
In this session **Gemini TTS reference fell back to Fish** (`engine=fish` for both sides) because of **Gemini free-tier 429 quota**.  
So `benchmark/comparisons/*/reference.*` is **not yet a true Gemini reference** until quota resets.

**Re-run when Gemini quota is available:**
```bash
npm run compare:reference
```
Then listen: `benchmark/comparisons/<id>/reference.wav` vs `test.wav`.

**We do NOT claim “pronunciation fixed.”** Generation success ≠ correct Kathmandu pronunciation. Human (or ASR) scoring is required — checklist is in each `meta.json`.

### BEFORE → AFTER (what actually changed in the text path)

| | BEFORE (prior session baseline) | AFTER (this phase) |
|---|---|---|
| Pipeline | Dictionary + Kathmandu rules only | + linguistic normalize + context dict + **analysis** + **conversational prosody** + Fish representation stages |
| User edits | API only, no UI | **UI panel “My Pronunciation”** |
| Debug | Basic stages | + `fishRepresentation`, `conversationalProsody`, full `dictionaryHits`, `analysis` |
| Benchmark | 33 unit + 25 audio | **+110 corpus, runner, Gemini/Fish compare, dataset validator** |
| Engine | Hard-coded Fish | **`TTS_ENGINE` modular config** (Fish default; alternative stub) |
| Example fishInput (ktm) | `म आज काठमाडौं जाँदैछु।` (भैंसी→भैँसी only on rural sentence) | Same orthography + prosody pass; analysis flags risky/conjunct/nasal |

Listen before/after is **your** job on `benchmark/out-sample` vs older takes + `benchmark/comparisons` after Gemini quota returns.

---

## 13. Remaining pronunciation problems

1. **Fish `s2.1-pro-free` Nepali coverage unknown** — likely ceiling for clone path (CASE D).
2. **No language code to Fish** — inference only from text + reference.
3. **Gemini director rewrite offline (429)** — local prep carries all quality load.
4. **Gemini reference comparison incomplete** until TTS quota resets (both sides were Fish).
5. **1-sample clones** still weak vs 15–30 s multi-sample Kathmandu recordings.
6. **No automatic pronunciation scorer** — human listen required.
7. **Large legacy lexicon** still has aggressive single-token rules (collateral risk MED).

---

## 14. Exact commands to run

```bash
# Dev server
npm run dev

# Health
# http://localhost:3000/api/health

# Text unit tests
npm run test:pronunciation

# E2E audio smoke (25 sentences)
npm run test:audio

# Full 110-sentence benchmark (Fish)
npm run benchmark
# Sample 30:
# BENCH_CORPUS=benchmark\sample30.json BENCH_OUT=benchmark\out-sample BENCH_VOICE=<cloneId> npm run benchmark

# Gemini vs Fish side-by-side (needs Gemini quota for true reference)
npm run compare:reference

# Dataset gate before any training (never auto-trains)
npx tsx scripts/dataset-validate.ts ./my-dataset

# Typecheck
npm run lint
```

UI: Language Auto/नेपाली/English · Pronunciation Natural/Precise · Debug OFF/ON · **My Pronunciation** dictionary.

---

## 15. Exact procedure to add Nepali pronunciation data (no source edits)

### Option A — UI
1. Right sidebar → **My Pronunciation** → **Edit**
2. `WORD` = written form, second box = spoken form  
3. **+ Add override** → saved to `pronunciation.json`

### Option B — API
```bash
curl -X POST http://localhost:3000/api/pronunciation \
  -H "Content-Type: application/json" \
  -d '{"from":"भैंसी","to":"भैँसी"}'
```
List: `GET /api/pronunciation`  
Delete: `DELETE /api/pronunciation` with `{"from":"..."}`

### Option C — Project dictionary
Edit `nepali_pronunciation.json` → `entries` map (orthographic Devanagari only).  
Then: `npm run test:pronunciation`

**Rules:**  
- Values = **how a Kathmandu native would type/say it in Devanagari**, not IPA, not English letters.  
- User entries apply **first**.  
- Do not invent phoneme tokens for Fish.

---

## Priority reminder (Phase 13)

1. Correct Nepali pronunciation  
2. Natural Nepali speech  
3. Natural prosody  
4. Strong speaker similarity  
5. Clean audio  
6. Stable generation  

A clone that mispronounces Nepali is **not** acceptable — prioritize (1)–(3) over “sounds like me” alone.

---

## Bottom line

Your system is **engineered as far as text-side control allows** on Fish cloud.  
The remaining gap to Gemini-like Nepali is **largely inside the opaque Fish model (CASE D)** plus reference-quality and quota-blocked LLM rewrite.  

**Next real levers (in order):**  
1. Multi-sample Kathmandu clone re-record (15–30 s × N, exact transcripts)  
2. Re-run `compare:reference` when Gemini TTS quota works — **listen**  
3. Confirm Fish cloud fine-tune existence  
4. Only then: local FT (separate module) or `TTS_ENGINE=ALTERNATIVE`  

**Do not keep patching individual words and declaring success.**
