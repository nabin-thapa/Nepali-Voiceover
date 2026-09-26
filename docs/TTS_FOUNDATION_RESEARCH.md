# TTS Foundation Research — Private Nepali TTS

Date: 2026-09-24
Status labels used throughout: **VERIFIED** (checked against official model card/docs/source at research time) · **EXPERIMENTAL** (community/unofficial, exists but unproven here) · **ASSUMED** (reasonable inference, not confirmed) · **NOT YET TESTED** (no local audio generated/listened yet)

Research method: official Hugging Face model cards, official GitHub repos/READMEs, official docs. No benchmark numbers invented. No model claimed to support Nepali unless the official card lists Nepali.

---

## 1. Executive summary

| Rank | Candidate | Nepali | Clone | License (weights) | Local? | Role |
|---|---|---|---|---|---|---|
| 1 | **Indic Parler-TTS** (AI4Bharat) | **Official yes** | Prompt/caption multi-speaker (no zero-shot clone) | Apache-2.0 | GPU | **Strongest official-Nepali open foundation** |
| 2 | **Chatterbox-Nepali community fine-tunes** | Community fine-tune (`language_id=ne`) | **Yes zero-shot** | MIT (base) | GPU | **Strongest clone + Nepali path** |
| 3 | **XTTS-v2 Nepali (Oshara)** | Community fine-tune (`ne`) | **Yes zero-shot** | Coqui CPML (restrictive) | GPU | Evaluated Nepali clone checkpoint |
| 4 | **kala-tts / real-nepali (Ampixa)** | **Official Nepali-only** | No (fixed speakers) | MIT code / CC-BY-SA-4.0 weights | **CPU** | **Best CPU Nepali baseline + G2P** |
| 5 | **Matcha-TTS Nepali** | Official fine-tune on Rasa Nepali | No (2 speakers) | CC-BY-4.0 | CPU/GPU | Small research baseline |
| 6 | **Fish Audio s2.1-pro-free** (current) | **NOT in language list** | Yes (cloud clone) | Cloud-only, opaque | Cloud | **CURRENT BASELINE** |
| 7 | Gemini TTS `ne-NP` (current) | **Official yes** | No (stock voices) | Cloud, quota-limited | Cloud | **Quality reference only** |
| — | F5-TTS / IndicF5 / CosyVoice / StyleTTS2 / Piper / Meta MMS | No official Nepali | Varies | Varies | Varies | Not primary candidates (see §4) |

**Headline finding (VERIFIED):** Fish Speech's published language lists (fish-speech-1.5 card: en, zh, ja, de, fr, es, ko, ar, ru, nl, it, pl, pt) **do not include Nepali**. This independently supports the existing project's CASE D hypothesis: the current engine has no documented Nepali language support. Fish remains the working baseline (clones + unlimited cloud), but it should not be assumed to be the final engine.

**Strongest realistic foundation for a private Nepali engine:** start A/B listening between (a) current Fish clone path, (b) Gemini `ne-NP` reference, (c) Indic Parler-TTS Nepali (official), (d) a Chatterbox-Nepali fine-tune (clone-capable). Then fine-tune the best local-capable base on our own licensed Nepali dataset.

---

## 2. Candidate-by-candidate comparison

### 2.1 Indic Parler-TTS — AI4Bharat  **[TOP OFFICIAL NEPALI CANDIDATE]**

| Field | Value | Status |
|---|---|---|
| Source | `huggingface.co/ai4bharat/indic-parler-tts` | VERIFIED |
| Nepali support | **Official** — Nepali listed among 21 officially supported languages; Nepali recommended voice **"Amrita"**; emotion prompts officially supported for Nepali | VERIFIED |
| Architecture | Parler-TTS Mini multilingual extension; text + **caption** input (style described in natural language) | VERIFIED |
| Params | ~938M | VERIFIED (HF card) |
| Training data | 1,806 h multilingual Indic + English (GLOBE-annotated) | VERIFIED |
| Voice cloning | **No zero-shot cloning.** Speaker choice via 69 built-in voices + caption prompting | VERIFIED |
| Style control | Caption-driven (quality, pitch, pace, emotion) — real style channel | VERIFIED |
| Fine-tuning | Parler-TTS architecture trainable; official card does not document LoRA recipe | ASSUMED (trainable in principle) |
| Inference HW | GPU recommended (~1B params) | ASSUMED |
| VRAM | Not stated on card — expect several GB bf16 | NOT YET TESTED |
| License | **Apache-2.0** | VERIFIED |
| Weights | Available, **gated** (access request required) | VERIFIED |
| Training code | Parler-TTS open (HuggingFace/parler-tts); AI4Bharat recipe not fully published | PARTIAL |
| Nepali native-speaker eval (NSS) | Card reports Nepali NSS ≈ 64.05±8.33 (native) / 80.02±5.75 (proximal) — MOS-like internal framework, not directly comparable to external MOS | VERIFIED (as reported by authors) |
| Community activity | High downloads (~772k/30d at research time) | VERIFIED |
| Long-form stability | Not verified by us | NOT YET TESTED |
| Commercial use | Apache-2.0 permits commercial use (verify dataset terms separately) | VERIFIED for code/weights license |

**Verdict:** The only large, official, Apache-2.0 model with **documented native Nepali support, emotion support for Nepali, and a real style-control channel**. Weakness: no zero-shot voice cloning of *your* voice — speaker identity comes from built-in voices + captions. **First local engine to A/B against Fish/Gemini.**

### 2.2 Chatterbox multilingual + community Nepali fine-tunes  **[TOP CLONE + NEPALI CANDIDATE]**

| Field | Value | Status |
|---|---|---|
| Base | Resemble AI Chatterbox Multilingual (~500M–0.5B Llama-class T3 + S3Gen vocoder) | VERIFIED |
| Official languages | 22–23 listed (ar, zh, en, fr, de, it, ja, es, fi, he, hi, ko, ms, nl, no, pl, pt, ru, sv, sw, tr, el, da…) — **Nepali NOT in the official list** | VERIFIED |
| Nepali | **Community fine-tunes add `language_id="ne"`** — multiple independent repos | VERIFIED (existence) / EXPERIMENTAL (quality) |
| Known Nepali repos | `officialuser/chatterbox-nepali` (MIT, epoch-20 ckpt), `Firojpaudel/chatterbox_nepali` (MIT, 50-epoch + merged soup), `Imbatmann/chatterbox-nepali-tts` (MIT), `TelvoxAI/chatterbox-nepali-tts` | VERIFIED existence |
| Voice cloning | **Yes** — zero-shot from 5–10 s reference audio (`audio_prompt_path`) | VERIFIED |
| Emotion control | `exaggeration` parameter (0–1) on base model | VERIFIED |
| Devanagari issues | Community forks report hallucination/repetition fixes needed for Devanagari (EOS/alignment filters) | VERIFIED (fork READMEs) |
| Fine-tuning | Full FT used by community (~8k clips for one fork); LoRA feasible on T3 backbone (ASSUMED) | EXPERIMENTAL |
| Inference HW | GPU (500M class); Colab T4 free tier used by community | VERIFIED (community) |
| VRAM | ~4–8 GB class expected at inference | ASSUMED |
| License | Base **MIT**; community Nepali weights also released MIT | VERIFIED |
| Training code | Full Chatterbox repo open (resemble-ai/chatterbox) | VERIFIED |
| Quality | Not listened by us | NOT YET TESTED |

**Verdict:** The best match for the dual requirement **(official-quality clone path + Nepali fine-tune + permissive license + trainable**. Risks: community checkpoints vary in quality; Devanagari hallucination bugs are real; Nepali quality unverified by listening. **Second local engine to A/B — with your reference audio.**

### 2.3 XTTS-v2 Nepali (Oshara) 

| Field | Value | Status |
|---|---|---|
| Source | `huggingface.co/Oshara/xtts-v2-nepali` | VERIFIED |
| Base | Coqui XTTS-v2 (17 official languages incl. Hindi; **no official Nepali**) | VERIFIED |
| Nepali | Community full GPT fine-tune registering `ne` over Devanagari tokenizer; 4,140 single-speaker clips | VERIFIED |
| Cloning | **Yes** zero-shot (XTTS hallmark), cross-lingual | VERIFIED |
| Reported eval (by authors, on NepTTS-Bench) | Whisper RT CER 0.380 (2nd best there), MMS CER 0.199, SCOREQ 4.21, SECS 0.923, F0 std 3.58 st (flatter than natural ~4.95) | VERIFIED as author-reported; NOT independently reproduced |
| License | **Coqui Public Model License (CPML)** — restrictive (non-commercial restrictions historically) | VERIFIED |
| Commercial future | CPML is a problem for later commercial deployment | VERIFIED concern |

**Verdict:** Strong reported Nepali intelligibility + cloning, but **license blocks commercial path**. Keep as research comparison only, not as commercial foundation.

### 2.4 kala-tts / real-nepali (Ampixa Labs)  **[TOP CPU BASELINE + G2P]**

| Field | Value | Status |
|---|---|---|
| Source | `pip install kala-tts`; `huggingface.co/ampixa/real-nepali-v0.2-kala` | VERIFIED |
| Nepali | **Nepali-only**, purpose-built | VERIFIED |
| G2P | Own **real_nepali** Devanagari G2P (no eSpeak); claims correct palatal च/छ vs eSpeak's alveolar; 48k lexicon; grounded in Khatiwada 2009 / Pokharel 1989 / Regmi 2025 | VERIFIED (project docs) |
| Architecture | VITS (ONNX Piper-style), ~78 MB fp32 | VERIFIED |
| Speakers | kala, barsha, slr143_F, slr43_* (5–6) | VERIFIED |
| Cloning | **No** | VERIFIED |
| CPU perf | ~50× real-time claimed | VERIFIED (claimed) |
| License | MIT (code) / **CC-BY-SA-4.0** (weights) | VERIFIED |
| Punctuation v0.4 | Experimental punctuation-token model, 11.6 h training mix | VERIFIED existence |
| Related | Ampixa also runs **NepTTS-Bench** (365-sentence Nepali TTS benchmark with MOS platform) | VERIFIED |

**Verdict:** Not a clone engine, but the **best free CPU Nepali pronunciation baseline** and a serious G2P resource. Ideal Engine C in A/B/C tests: same sentence → Fish vs Indic Parler vs kala (CPU). Also a source of phonetic truth for our pronunciation layer.

### 2.5 Matcha-TTS Nepali (sandipghimire)

| Field | Value | Status |
|---|---|---|
| Source | `huggingface.co/sandipghimire/matcha-tts-nepali` | VERIFIED |
| Nepali | Fine-tuned on AI4Bharat **Rasa** Nepali; Nepali G2P (Ampixa frontend) | VERIFIED |
| Params | ~20.9M acoustic + universal HiFi-GAN vocoder | VERIFIED |
| Speakers | 2 (female/male) | VERIFIED |
| License | **CC-BY-4.0** | VERIFIED |
| Cloning | No | VERIFIED |
| Size | Repo ~6.7 GB (ckpt + vocoder + data) | VERIFIED |

**Verdict:** Tiny, trainable, permissive research baseline. Useful for quick fine-tune experiments (small VRAM). Quality ceiling lower than Parler/Chatterbox.

### 2.6 Fish Speech (current baseline)

| Field | Value | Status |
|---|---|---|
| Integration | Cloud API `POST /api.fish.audio/v1/tts`, model header `s2.1-pro-free` | VERIFIED (existing audit) |
| Nepali in open fish-speech-1.5 card | **Not listed** (en, zh, ja, de, fr, es, ko, ar, ru, nl, it, pl, pt) | VERIFIED |
| Language channel at synthesis | **None** (no `language` field) | VERIFIED |
| Clone | Cloud zero-shot, up to 20 refs, `train_mode=fast` only | VERIFIED |
| Local weights for s2.1-pro-free | Not available to us; older fish-speech-1.5 weights CC-BY-NC-SA-4.0 | VERIFIED (1.5 card) |
| Commercial | Cloud ToS governs; local 1.5 weights non-commercial | VERIFIED |
| Nepali quality | Opaque; CASE D risk (existing docs) | ASSUMED weak-unverified |

**Verdict:** Keep working. Unlimited free drafts + your clones. **Not automatically the final engine** — no documented Nepali support and no inspectable tokenizer.

### 2.7 Gemini TTS `ne-NP` (current reference)

| Field | Value | Status |
|---|---|---|
| Nepali | **Official `languageCode: ne-NP`** | VERIFIED |
| Cloning | No (stock voices: Kore, Puck, …) | VERIFIED |
| Quota | Free tier ~10/day soft, 429/503 common | VERIFIED (observed) |
| Role | **Quality bar / reference only** — never copy voice identity | Project rule |

**Verdict:** Remains the **quality north star** for listening tests. Unavailable → mark unavailable; never fake it (existing compare script already flags fallbacks).

### 2.8 Models investigated and NOT selected as primary

| Model | Why not primary | Status |
|---|---|---|
| **F5-TTS** | Code MIT but **weights CC-BY-NC** (non-commercial); English/Chinese focus; no Nepali | VERIFIED |
| **IndicF5** (AI4Bharat) | MIT, 11 Indic languages — **Nepali not among them** | VERIFIED |
| **CosyVoice / CosyVoice 3** | Apache-2.0, strong cloning, **no official Nepali** | VERIFIED |
| **StyleTTS2** | English-centric; multilingual path is research-issue level, no Nepali | VERIFIED |
| **Coqui XTTS v2 (base)** | 17 langs, no official Nepali; Nepali only via community FT + CPML license | VERIFIED |
| **Meta MMS TTS** | Coverage of `ne` not confirmed on official card at research time; no clone | ASSUMED/NOT VERIFIED — do not claim |
| **Piper** | CPU voices exist community-side; quality variable; no clone | VERIFIED general |
| **Kokoro-82M** | 8 language codes v1.0, **no Nepali**, no clone | VERIFIED |
| **Qwen3-TTS** | 11 languages, Apache-2.0, cloning — **Nepali not confirmed in official list** | NOT VERIFIED for ne |
| **Suno/Azure/Edge cloud ne voices** | Out of scope for private local foundation (cloud keys, ToS) | N/A |

---

## 3. Scoring (0–2 per criterion, max 20) — research phase only

Criteria: Nepali support · pronunciation ceiling · voice cloning · fine-tune path · license/commercial · local privacy · hardware fit for us · integration effort into this app · long-form stability (prospective) · style control.

| Candidate | Nepali | Pron. | Clone | FT | License | Local | HW | Integr. | Long-form | Style | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Indic Parler-TTS | 2 | 2 | 0 | 2 | 2 | 2 | 1 | 1 | 1 | 2 | **15** |
| Chatterbox-Nepali FT | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 2 | **16** |
| XTTS-v2 Nepali | 2 | 2 | 2 | 2 | 0 | 2 | 1 | 1 | 1 | 1 | **14** |
| kala-tts (CPU) | 2 | 1 | 0 | 1 | 2 | 2 | 2 | 2 | 0 | 0 | **12** |
| Matcha-TTS Nepali | 2 | 1 | 0 | 2 | 2 | 2 | 2 | 1 | 0 | 0 | **12** |
| Fish s2.1-pro-free (current) | 0 | 1 | 2 | 0 | 1 | 0 | 2 | 2 | 1 | 1 | **10** |
| Gemini ne-NP (reference) | 2 | 2 | 0 | 0 | 1 | 0 | 2 | 2 | 2 | 2 | **13** |

*Scores are internal research judgments (ASSUMED weights), not measured MOS. All "Pron." and "Long-form" entries are NOT YET TESTED by listening in this repo.*

---

## 4. Recommended A/B/C engine set (this phase)

| Slot | Engine | Why |
|---|---|---|
| **A** | Fish clone (`s2.1-pro-free` + Thapa/Kore) | Current baseline, unlimited |
| **B** | Gemini `ne-NP` (when quota) OR Indic Parler-TTS (local) | Native-quality bar / official Nepali |
| **C** | kala-tts (CPU) OR Chatterbox-Nepali (GPU) | Nepali-specialist baseline / clone-capable local |

Same text · same target speaker where supported · same output format (WAV) · same speed target → `benchmark/comparison/<engine>/<sentence-id>.wav` + metadata.

---

## 5. What we will NOT do

- Claim any model is Nepali-capable without the official card listing it (or clearly marking community FT as EXPERIMENTAL).
- Auto-download multi-GB weights without an explicit user command.
- Fake Gemini audio when quota fails.
- Treat Fish as the permanent final engine by default.
- Use F5/XTTS-CPML weights for a future commercial product without license review.

---

## 6. Evidence index (sources consulted)

1. `huggingface.co/ai4bharat/indic-parler-tts` — official model card (Nepali, voices, NSS, Apache-2.0).
2. `huggingfish.audio` OpenAPI + `docs.fish.audio` — existing `docs/FISH_API_AUDIT.md`.
3. `huggingface.co/fishaudio/fish-speech-1.5` — language list without Nepali; CC-BY-NC-SA-4.0.
4. `github.com/resemble-ai/chatterbox` — official multilingual language list (no ne).
5. `github.com/officialuser/chatterbox-nepali`, `Firojpaudel/chatterbox_nepali`, `Imbatmann/chatterbox-nepali-tts` — community ne fine-tunes (MIT).
6. `huggingface.co/Oshara/xtts-v2-nepali` — Nepali XTTS FT + author metrics; CPML license.
7. `pypi.org/project/kala-tts`, `huggingface.co/ampixa/real-nepali-v0.2-kala`, `tts.ampixa.com` — Kala + NepTTS-Bench.
8. `huggingface.co/sandipghimire/matcha-tts-nepali` — Matcha Nepali card.
9. `github.com/SWivid/F5-TTS` — MIT code / CC-BY-NC weights note.
10. `huggingface.co/ai4bharat/IndicF5` — 11 languages, no Nepali.

---

## 7. Next verification steps (listening required)

1. Request gated access: `ai4bharat/indic-parler-tts`.
2. `pip install kala-tts` → generate 20 corpus sentences on CPU → listen.
3. Run `npm run benchmark:nepali` (Fish) vs Indic Parler vs kala on the same 30-file subset.
4. Only after listening: decide whether Chatterbox-Nepali FT is worth GPU setup.
5. Record findings in `docs/ENGINE_COMPARISON.md` with VERIFIED/NOT YET TESTED labels.
