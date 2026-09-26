# Nepali TTS Model Decision

Date: 2026-09-24  
Scope: Which open-source foundation to TEST for our own native Nepali TTS — **not** a quality winner ranking.  
Companion: `docs/TTS_MODEL_SELECTION.md` (full comparison + evidence labels).

Evidence: **VERIFIED** / **CLAIMED** / **COMMUNITY REPORT** / **UNKNOWN**.  
No listening test has been run for new models. No training started. No weight downloads performed for this task.

---

## 1. Which models should we test first, and why?

### First tier (run local inference + human eval as soon as we wire engines)

| Priority | Model | Why technically first |
|---|---|---|
| 1 | **Indic Parler-TTS** (`ai4bharat/indic-parler-tts`) | Only strong candidate with **official Nepali**, **Apache-2.0**, **69 voices**, **emotion/caption control**, and **full Parler training code**. Strongest *train path* without non-commercial landmines. Gated HF download. |
| 2 | **Kala / real-nepali** (Ampixa VITS/ONNX) | Only serious **Nepali-only CPU** system with **own G2P** + open training recipe + NepTTS-Bench. Fast baseline, no GPU, **CC-BY-SA-4.0** weights OK for commercial with share-alike. |
| 3 | **Matcha-TTS Nepali** (`sandipghimire/matcha-tts-nepali`) | Real Nepali, **CC-BY-4.0**, ~21M params, 2 speakers, open recipe. Tiny smoke-train vehicle and quality floor for “our stack” style training. |
| 4 | **Chatterbox (MIT)** + community **chatterbox-nepali** FTs | Best path that includes **zero-shot clone + multi-speaker + MIT**. Nepali is **COMMUNITY REPORT**, not official — must A/B against Parler/Kala before choosing as product base. |

### Second tier (after first listening gate)

| Model | When / why |
|---|---|
| **IndicF5** | If we need ref-audio clone with permissive-looking license and accept building Nepali from 11 other Indic langs (license chain still needs review). |
| **CosyVoice2/3** | If clone + style + streaming matter more than official Nepali; Apache-2.0; **no Nepali** → high adaptation cost. |
| **XTTS-v2 Nepali (Oshara)** | Research-only comparison: strongest *existing* Nepali+clone checkpoint by author metrics — **CPML non-commercial** → never production foundation. |
| **Parler-TTS base multilingual** | Only if Indic Parler gated access fails; inferior (no official ne). |
| **MMS / Piper ne** | CPU regression baselines only; **CC-BY-NC** on MMS → research only. |

### Keep as product baseline engines (not train foundation)

- **Fish (`s2.1-pro-free` cloud)** and **Gemini** — stay wired as live baselines; **Fish research license / cloud** means Fish is **not** the model we train on top of.  
- Do not replace Fish or Gemini for this research phase.

---

## 2. Which models should we NOT select yet?

| Model | Why not yet |
|---|---|
| **F5-TTS official / sm079 romanized FT** | Weights **CC-BY-NC**; community Nepali FT is NC + romanized-heavy → poor fit for Devanagari product. |
| **StyleTTS2 as primary** | English-centric; needs language PL-BERT; **`ne` in multilingual PL-BERT UNKNOWN**; phoneme pipeline cost. |
| **Kokoro-82M** | **No Nepali**; no clone; not a documented Nepali train path. |
| **Orpheus, Sesame CSM, Dia/Bark** | No verified Nepali. |
| **Base XTTS-v2 / any CPML stack for commercial** | **Non-commercial** model + outputs. |
| **Fish Speech as training base** | Research license; no usable local S2.1 train stack for us; explicit `ne` on S2.1 language list **UNKNOWN**. |
| **SLR143-trained anything for commercial** | Dataset **CC-BY-NC-SA** — research/personal only. |
| **Any model ranked “best” by F0 / claim of “sounds like Gemini”** | Forbidden by project rules until we generate audio and run `NEPALI_HUMAN_EVALUATION.md`. |

---

## 3. What evidence are we missing?

| Missing item | Type | How to close |
|---|---|---|
| Our own listening of Parler/Kala/Matcha/Chatterbox-Nepali on the 316-sentence corpus | **NOT YET TESTED** | Wire `TTSEngine` stubs → real local backends; run `npm run benchmark:nepali` + human CSV |
| Indic Parler exact VRAM/latency on **our** machine | UNKNOWN | System check + first synthesize |
| Explicit `ne` line on Fish S2.1 official language table | UNKNOWN | Official docs review (already partially done — not found) |
| `ne` in Parler multilingual PL-BERT (if using base) | UNKNOWN | Config/tokenizer inspect |
| MMS TTS explicit Nepali folder (`npl`/`ne`) | PART | Official HF tree check |
| Community chatterbox-nepali objective quality vs Fish | COMMUNITY REPORT only | Human eval A/B |
| Long-form stability (all candidates) | UNKNOWN | Category Z paragraphs + hold-out |
| Rasa / Indic-Parler / Ampixa full commercial terms for *our* outputs | License review | Read dataset LICENSE files; keep `LICENSES.md` manifest |
| Matcha author Whisper CER reproducibility | CLAIMED | Optional re-score with our script later |
| Oshara XTTS SECS/naturalness | CLAIMED | Non-commercial reference run only |

---

## 4. What is the smallest experiment that can prove viability?

**Goal:** Prove “we can generate Nepali TTS locally with an open foundation and evaluate it on our own corpus” — not SOTA.

| Field | Value |
|---|---|
| **Name** | Experiment A (Fastest PoC) — from `TTS_MODEL_SELECTION.md` §5 |
| **Model** | **Kala / real-nepali** (zero GPU) *or* **Matcha-TTS Nepali** (tiny GPU) |
| **Audio** | 15–45 min, 1–2 speakers, quiet room, `dataset:validate` PASS |
| **Transcripts** | Exact Devanagari `metadata.jsonl` |
| **Train** | Use published recipe only; **manual start**; no auto-train |
| **Gate** | Generate ≥20 sentences from our corpus + 10 pronunciation cases; human score pronunciation/naturalness vs Fish (same sentences) |
| **Pass** | We can *hear* intelligible Nepali and log side-by-side in evaluation CSV — **no numeric win claim without listening** |
| **Fail** | Garbage intelligibility → fall back to Kala as baseline only; re-check G2P + data |

If only inference proof is needed (skip train): install/run Kala or Matcha checkpoint on 5 sentences — even smaller.

---

## 5. What dataset should we start recording first?

**Start: single speaker, read speech, short utterances.**

| Field | Choice |
|---|---|
| **Speakers** | **1** native Nepali (clear standard accent; we expand later) |
| **Style** | **Read** (not conversational) — matches recording script + validators |
| **Utterance length** | **3–15 s** clips (TTS fine-tune grain) |
| **Content** | Categories **A–J** from recording standard first (aspirates, retroflex, conjuncts, numerals, named entities), then expand toward full **A–Z** corpus coverage |
| **Hours** | Smoke **15–45 min** → PoC; then **2–5 h** for Experiment B; **10–20 h multi-spk** for Experiment C |
| **Format** | WAV 24-bit / 44.1 or 48 kHz (capture), resample for model; peak-safe, no clipping |
| **Sidecar** | `metadata.jsonl` + duration + speaker_id + license field per clip |
| **QC gate** | `npm run dataset:validate` PASS before any train |

**Public data to *mix later* (not first recording):** Common Voice Nepali **CC0** (commercial OK), Rasa **CC-BY-4.0** (attribution), SLR43 **CC-BY-SA** (SA caution), **avoid SLR143 NC and CPML** for commercial core.

---

## 6. What hardware should we target?

| Phase | Tier | Target |
|---|---|---|
| Wire engines, generate 316 sentences, Kala/Matcha inference, human eval | **Tier 1** | **8 GB VRAM** GPU (12 GB better); CPU-only OK for Kala; 16 GB RAM; ~200 GB SSD |
| Experiment B — fine-tune Indic Parler (~1B) or Chatterbox (~500M) on 2–5 h | **Tier 2** | **16–24 GB VRAM** (24 ideal); 32–64 GB RAM; ~1 TB NVMe |
| Experiment C — multi-speaker production FT, ablations, distillation | **Tier 3** | **24 GB+ VRAM**, 1–4 GPUs; 64–128 GB RAM; 2–4 TB NVMe + backup |

Training wall-clock: **UNKNOWN / NOT VERIFIED** until config + data + hardware fixed — do not invent.

---

## 7. Which model is the strongest *candidate to TEST* (not “will sound like X”)?

| Question | Answer |
|---|---|
| **Strongest official-Nepali open foundation to TEST first** | **Indic Parler-TTS** — technically the strongest candidate to TEST because it already ships Nepali, Apache-2.0, multi-voice, emotion prompts, and official training code. **Not** because we claim it will sound like Gemini or Fish. |
| **Strongest clone-capable open foundation to TEST** | **Chatterbox MIT (+ Nepali community FT)** — technically the strongest candidate to TEST because cloning + multi-speaker + MIT + trainable stack align with our product; Nepali quality is **COMMUNITY REPORT** only. |
| **Strongest Nepali-native lightweight control** | **Kala (Ampixa)** — technically the strongest candidate to TEST because G2P + VITS + recipe + CPU are already Nepali-shaped. |
| **Baseline engines we keep** | **Fish + Gemini** unchanged for comparison and app features. |
| **Explicit non-claim** | No candidate is declared better sounding. Comparison table has **no winner column** — buckets **A/B/C/D** only. |

---

## 8. Final recommendation (test order + why)

```
TEST ORDER (manual gates only):
  1. Wire local inference for Kala + Matcha (if HF available) → listen 20 sentences
  2. Request gated Indic Parler-TTS → local inference → listen same 20 + emotion cases
  3. Pull chatterbox-nepali community weights → clone test (ref audio) → listen
  4. Human evaluation vs Fish (and Gemini if quota OK) on pronunciation_cases + category samples
  5. ONLY after listening: pick ONE foundation for Experiment A/B training plan details
  6. NEVER auto-start training; NEVER download huge weights without explicit user go-ahead
```

| Bucket | Models |
|---|---|
| **A — strong** | Indic Parler-TTS; Chatterbox (+ne FT path); Kala/Ampixa |
| **B — possible** | Matcha-Nepali; IndicF5; CosyVoice; Parler base; XTTS-ne (research only); MMS/Piper baselines |
| **C — poor fit** | F5 official NC; StyleTTS2 primary; Kokoro; Orpheus/CSM; Fish-as-train-base; SLR143-for-commercial |
| **D — not enough evidence** | Fish S2.1 explicit `ne`; PL-BERT `ne`; MMS explicit ne line; all long-form stability; our listening results |

**Dataset start:** 1 speaker, read, 3–15 s, A–J coverage, 15–45 min smoke → validate → (optional) Kala/Matcha PoC train.  
**Hardware start:** Tier 1 now; Tier 2 before committing to Parler/Chatterbox FT.  
**Licenses:** prefer **Apache-2.0 / MIT / CC0 / CC-BY** cores; track **CC-BY-SA** (Kala, SLR43) share-alike; ban **CC-BY-NC, CPML, SLR143** from commercial training.

---

## 9. Your exact next personal action

```powershell
# From repo root — verify nothing broken, then open the two docs
npm run lint
notepad docs\TTS_MODEL_SELECTION.md
notepad docs\NEPALI_TTS_MODEL_DECISION.md
```

When ready to close the “missing evidence” gap (still no training), say which you want:

1. **Wire Kala local engine** (CPU, smallest path to first local Nepali WAV), or  
2. **Attempt gated Indic Parler download** (explicit approval required), or  
3. **Human eval session** against existing Fish samples only.

**Do not start any Experiment A/B/C until you explicitly approve training and weight downloads.**
