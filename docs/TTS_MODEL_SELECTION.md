# TTS Model Selection — Technical Comparison

Date: 2026-09-24  
Purpose: Select an open-source **foundation** for training our own native Nepali TTS.  
Evidence labels: **VERIFIED** (official card/docs/license) · **CLAIMED** (author/vendor assertion, not independently reproduced) · **COMMUNITY REPORT** · **UNKNOWN / NOT VERIFIED**

**No winner ranking.** Buckets A–D only. Quality decisions require listening after local generation.

Related: `docs/TTS_FOUNDATION_RESEARCH.md`, `docs/NEPALI_TTS_MODEL_DECISION.md`, `docs/NEPALI_HUMAN_EVALUATION.md`.

---

## 1. Answers by candidate (20 questions)

Legend for Nepali columns: Y = yes · N = no · PART = partial/community · U = unknown.

### 1.1 Indic Parler-TTS (`ai4bharat/indic-parler-tts`)

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Supports Nepali? | **Y — official** | VERIFIED model card: 21 languages include Nepali |
| 2 | Nepali demonstrated/tested? | **Y — author NSS** Nepali 64.05±8.33 native / 80.02±5.75 proximal | CLAIMED (author eval, MOS-like; not our listening) |
| 3 | Fine-tunable? | **Y** | VERIFIED Parler-TTS `training/` guide; Indic extension of that stack |
| 4 | Train with our Nepali data? | **Y** | VERIFIED training code path (Parler) + official Nepali in base |
| 5 | Multiple speakers? | **Y** 69 built-in voices | VERIFIED card |
| 6 | Clone speaker? | **N** zero-shot clone | VERIFIED (caption/voice-prompt design, not reference-audio clone) |
| 7 | Preserve identity in Nepali? | **N/A for clone**; multi-voice via named speakers | VERIFIED design |
| 8 | Style/emotion control? | **Y** caption + emotion prompts; Nepali in emotion-supported list | VERIFIED card |
| 9 | Long-form? | **U** not officially stress-tested by us | UNKNOWN / NOT VERIFIED |
| 10 | GPU/VRAM realistic? | ~938M; community: 4GB often OOM, practical ≥8–12GB class | CLAIMED/community (HF discussion #25) |
| 11 | Local inference? | **Y** | VERIFIED HF + parler-tts |
| 12 | Licenses code/model/data? | Code/model **Apache-2.0**; Indic-Parler dataset license on card | VERIFIED |
| 13 | Commercial allowed? | **Y for weights** (Apache-2.0); re-check dataset terms for redistributed data | VERIFIED license |
| 14 | Actively maintained? | **Y** AI4Bharat + Parler org; high downloads | VERIFIED |
| 15 | Nepali adaptation difficulty? | **Low–medium** (already Nepali) | ASSUMED from official support |
| 16 | Requires phonemes? | **N** text (+ caption) | VERIFIED usage |
| 17 | Text directly? | **Y** Devanagari text | VERIFIED |
| 18 | Reference audio? | **N** | VERIFIED |
| 19 | Speaker embeddings? | **N** (voice name + description tokens) | VERIFIED architecture |
| 20 | Training docs? | **Y** full Parler training README | VERIFIED |

### 1.2 Parler-TTS (base: mini / multilingual)

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali? | **N** official (multilingual = 8 European) | VERIFIED card |
| 2 | Nepali tested? | N | VERIFIED |
| 3–4 | Fine-tune / own data? | **Y** flagship feature | VERIFIED GitHub training |
| 5 | Multi-speaker? | **Y** | VERIFIED |
| 6 | Clone? | **N** | VERIFIED |
| 7 | Identity in Nepali? | N/A until Nepali-trained | — |
| 8 | Style/emotion? | **Y** natural-language captions | VERIFIED |
| 9 | Long-form? | U | UNKNOWN |
| 10 | GPU? | mini ~0.9B; large ~2.2B | VERIFIED sizes |
| 11 | Local? | **Y** | VERIFIED |
| 12 | Licenses? | **Apache-2.0** models; open training | VERIFIED |
| 13 | Commercial? | **Y** | VERIFIED |
| 14 | Maintained? | Active org; base less recent than Indic fork | VERIFIED existence |
| 15 | Nepali adaptation? | **Medium–high** (need Nepali data + train) vs starting from Indic Parler | ASSUMED |
| 16–17 | Phonemes / text? | Text + caption | VERIFIED |
| 18–19 | Ref audio / embeddings? | N | VERIFIED |
| 20 | Training docs? | **Y best-in-class** | VERIFIED |

### 1.3 Kala / real-nepali (Ampixa)

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali? | **Y — Nepali-only** | VERIFIED HF + tts.ampixa.com |
| 2 | Demonstrated? | **Y** public samples, NepTTS-Bench ecosystem | VERIFIED existence / CLAIMED quality until we listen |
| 3 | Fine-tunable? | **Y** open training recipe `Ampixa/nepal-tts-training` | VERIFIED |
| 4 | Own dataset? | **Y** Piper/VITS recipe | VERIFIED |
| 5 | Multi-speaker? | **Y** 6 speaker IDs (v0.4 map) | VERIFIED model card |
| 6 | Clone? | **N** | VERIFIED |
| 7 | Identity in Nepali? | Fixed speakers only | VERIFIED |
| 8 | Style/emotion? | Limited; v0.4 punctuation tokens experimental | VERIFIED card caveat |
| 9 | Long-form? | U | UNKNOWN |
| 10 | GPU? | **CPU** ~50× RT claimed; ONNX ~78MB | CLAIMED (vendor) |
| 11 | Local? | **Y** `pip install kala-tts` | VERIFIED |
| 12 | Licenses? | Code MIT (package); weights **CC-BY-SA-4.0** (`ampixa/kalaTTS`, `real-nepali-v0.2-kala`); G2P seed CC-BY-4.0 | VERIFIED |
| 13 | Commercial? | **Y with SA** (share-alike on derivatives of weights) | VERIFIED license type |
| 14 | Maintained? | **Y** active Ampixa (2026) | VERIFIED |
| 15 | Nepali adaptation? | Already Nepali; improving quality is train work | ASSUMED |
| 16 | Requires phonemes? | **Y** own Devanagari G2P | VERIFIED |
| 17 | Text directly? | Via G2P frontend | VERIFIED |
| 18–19 | Ref audio / embeddings? | N | VERIFIED |
| 20 | Training docs? | **Y** open recipe | VERIFIED |

### 1.4 F5-TTS (official)

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali? | **N** official | VERIFIED README langs (en/zh focus) |
| 2 | Nepali tested? | Community FT only (romanized) | COMMUNITY REPORT: `sm079/f5-tts-nepali-romanized` CC-BY-NC-SA |
| 3–4 | Fine-tune? | **Y** | VERIFIED repo training |
| 5 | Multi-speaker? | Via multi-speaker training / clone | VERIFIED |
| 6 | Clone? | **Y** | VERIFIED |
| 7 | Identity + Nepali? | Only after Nepali FT (community incomplete) | COMMUNITY REPORT |
| 8 | Style? | Limited vs Parler captions | ASSUMED |
| 9 | Long-form? | U | UNKNOWN |
| 10 | GPU? | Typical ~8–16GB class for comfortable FT/inference | ASSUMED (not on official card) |
| 11 | Local? | **Y** | VERIFIED |
| 12 | Licenses? | Code **MIT**; **weights CC-BY-NC** (Emilia) | VERIFIED README |
| 13 | Commercial? | **N for official weights** | VERIFIED |
| 14 | Maintained? | **Y** active | VERIFIED |
| 15 | Nepali adaptation? | **High** (from non-Nepali base + NC weights) | ASSUMED |
| 16 | Phonemes? | **N** (chars/bytes) | VERIFIED design |
| 17 | Text? | Y | VERIFIED |
| 18 | Ref audio? | **Y** | VERIFIED |
| 19 | Speaker embeddings? | Implicit via ref | VERIFIED |
| 20 | Training docs? | **Y** | VERIFIED |

### 1.5 IndicF5 (`ai4bharat/IndicF5`)

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali? | **N** — 11 langs: as bn gu hi kn ml mr or pa ta te | VERIFIED card |
| 2 | Nepali tested? | N | VERIFIED |
| 3–4 | Fine-tune / own data? | **Y** F5-style | VERIFIED stack |
| 5 | Multi-speaker? | Training multi-speaker corpora; inference uses ref | VERIFIED usage pattern |
| 6 | Clone? | **Y** (ref audio + ref transcript) | VERIFIED usage |
| 7 | Identity in Nepali? | N/A until Nepali FT | — |
| 8 | Style? | Ref-driven prosody | VERIFIED |
| 9 | Long-form? | U | UNKNOWN |
| 10 | GPU? | 0.4B class | VERIFIED size |
| 11 | Local? | **Y** | VERIFIED |
| 12 | Licenses? | **MIT** on HF card; lineage/data concerns flagged by downstream (Emilia NC inheritance **disputed/assumed** for some F5 derivatives) | VERIFIED MIT label / UNKNOWN full data chain |
| 13 | Commercial? | **Likely Y for IndicF5 card**; verify data chain before product | ASSUMED pending legal review |
| 14 | Maintained? | **Y** AI4Bharat | VERIFIED |
| 15 | Nepali adaptation? | **Medium** (architecture ready, language missing) | ASSUMED |
| 16–17 | Phonemes/text? | Text-driven F5 | VERIFIED |
| 18 | Ref audio? | **Y** | VERIFIED |
| 19 | Embeddings? | Via ref conditioning | VERIFIED |
| 20 | Training docs? | **Y** GitHub | VERIFIED |

### 1.6 CosyVoice / CosyVoice2 / Fun-CosyVoice3

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali? | **N** official (zh en ja ko + dialects) | VERIFIED README |
| 2 | Nepali tested? | N official | VERIFIED |
| 3–4 | Fine-tune? | **Y** training scripts | VERIFIED repo |
| 5 | Multi-speaker? | **Y** | VERIFIED |
| 6 | Clone? | **Y** zero-shot | VERIFIED |
| 7 | Identity + Nepali? | Unverified | UNKNOWN |
| 8 | Style/emotion? | **Y** instruct | VERIFIED |
| 9 | Long-form? | Streaming supported | VERIFIED |
| 10 | GPU? | 0.5B class; practical ≥8GB | ASSUMED |
| 11 | Local? | **Y** | VERIFIED |
| 12 | Licenses? | **Apache-2.0** code | VERIFIED |
| 13 | Commercial? | **Y** code/weights per Apache (recheck each release) | VERIFIED |
| 14 | Maintained? | **Y** active through CosyVoice3 | VERIFIED |
| 15 | Nepali adaptation? | **High** (language absent) | ASSUMED |
| 16–17 | Phonemes/text? | Text (+ optionally frontend) | VERIFIED |
| 18–19 | Ref audio/embeddings? | **Y** | VERIFIED |
| 20 | Training docs? | **Y** | VERIFIED |

### 1.7 Fish Speech / Fish Audio S1 / S2 / S2.1

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali? | **U for S2.1 list** — S1 13 langs no ne; S2.1 claims 83 langs auto-detect, **ne not named** on cards reviewed | UNKNOWN for explicit ne; our project uses cloud `s2.1-pro-free` |
| 2 | Nepali tested? | Our cloud path exists; quality **NOT YET TESTED** by listening | local evidence |
| 3 | Fine-tune? | Cloud free tier `train_mode=fast` only; full local S2 training not available to us | VERIFIED (existing audit) |
| 4 | Own dataset train? | Not as free cloud; local fish-speech older weights not our path | VERIFIED constraints |
| 5 | Multi-speaker? | **Y** cloud | VERIFIED API |
| 6 | Clone? | **Y** cloud zero-shot | VERIFIED |
| 7 | Identity + Nepali? | Clone works; Nepali phonetics unverified | NOT YET TESTED |
| 8 | Style? | Inline NL tags (S2+) | VERIFIED docs |
| 9 | Long-form? | Chunked cloud synthesis | VERIFIED existing code |
| 10 | GPU? | Cloud N/A; local S2-Pro 4B not freely stack we run | — |
| 11 | Local? | **Partial** — we use cloud; research license on repo | VERIFIED |
| 12 | Licenses? | Code/weights **Fish Audio Research License**; commercial needs deal; S1-mini HF **CC-BY-NC-SA-4.0** | VERIFIED |
| 13 | Commercial? | **N without separate license** for research-licensed weights; free API has fair-use / >$1M ARR contact rules | VERIFIED |
| 14 | Maintained? | **Y** very active | VERIFIED |
| 15 | Nepali adaptation? | Opaque (closed training data) | UNKNOWN |
| 16 | Phonemes? | **N** | VERIFIED |
| 17 | Text? | Y | VERIFIED |
| 18 | Ref audio? | **Y** | VERIFIED |
| 19 | Embeddings? | **Y** multi-ref | VERIFIED |
| 20 | Training docs? | Not for commercial S2.1 local FT | UNKNOWN / restricted |

### 1.8 XTTS-v2 (Coqui) + Nepali community FT

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali official? | **N** (17 langs, Hindi yes, ne no) | VERIFIED card |
| 2 | Nepali demonstrated? | **Y community** `Oshara/xtts-v2-nepali` + paper-style blog | COMMUNITY / author CLAIMED metrics |
| 3 | Fine-tune? | **Y** official finetune docs | VERIFIED |
| 4 | Own Nepali data? | **Y** proven by Oshara (4,140 clips, ~10.5h) | COMMUNITY REPORT |
| 5 | Multi-speaker? | **Y** base multi + zero-shot | VERIFIED |
| 6 | Clone? | **Y** 6s ref | VERIFIED |
| 7 | Identity in Nepali? | **Y claimed** SECS 0.923 | CLAIMED (author) |
| 8 | Style? | Via ref / limited | VERIFIED |
| 9 | Long-form? | Known AR drift risk; Oshara recommends normalisation | COMMUNITY REPORT |
| 10 | GPU? | ~467M; FT practical ≥8–12GB | ASSUMED |
| 11 | Local? | **Y** | VERIFIED |
| 12 | Licenses? | **CPML — non-commercial** model+outputs | VERIFIED LICENSE.txt |
| 13 | Commercial? | **N** | VERIFIED |
| 14 | Maintained? | Coqui company gone; community forks live | VERIFIED |
| 15 | Nepali adaptation? | Done once by Oshara; we could re-FT | ASSUMED medium |
| 16 | Phonemes? | BPE text tokens (Devanagari over Hindi vocab) | VERIFIED Oshara approach |
| 17 | Text? | Y | VERIFIED |
| 18–19 | Ref audio/embeddings? | **Y** | VERIFIED |
| 20 | Training docs? | **Y** | VERIFIED |

### 1.9 StyleTTS2

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali? | **N** official (English LibriTTS/LJSpeech) | VERIFIED |
| 2 | Nepali tested? | N | VERIFIED |
| 3–4 | Fine-tune / new language? | **Y** but needs language PL-BERT; multilingual PL-BERT 14 langs — **ne not confirmed** | PART / UNKNOWN for ne in PL-BERT |
| 5 | Multi-speaker? | **Y** (VCTK-style) | VERIFIED |
| 6 | Clone? | Style/ref adaptation yes, weaker zero-shot than F5/XTTS | CLAIMED |
| 7 | Identity + Nepali? | Unknown | UNKNOWN |
| 8 | Style control? | **Y** style diffusion | VERIFIED paper |
| 9 | Long-form? | U | UNKNOWN |
| 10 | GPU? | Medium; training from scratch heavier | ASSUMED |
| 11 | Local? | **Y** | VERIFIED |
| 12 | Licenses? | Code **MIT**; checkpoint licenses vary | VERIFIED |
| 13 | Commercial? | **Y for MIT code**; data/weights case-by-case | VERIFIED |
| 14 | Maintained? | Slower; forks (EveryVoice) active | VERIFIED |
| 15 | Nepali adaptation? | **High** (PL-BERT + acoustic + G2P) | ASSUMED |
| 16 | Phonemes? | **Y required** | VERIFIED |
| 17 | Text? | Via phonemizer | VERIFIED |
| 18–19 | Ref/embeddings? | Style vector path | VERIFIED |
| 20 | Training docs? | **Y** | VERIFIED |

### 1.10 Chatterbox (Resemble) + Nepali community FTs

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali official? | **N** in 23-language list | VERIFIED official card |
| 2 | Nepali demonstrated? | **Y community** `officialuser/chatterbox-nepali` MIT, TelvoxAI, others | COMMUNITY REPORT |
| 3–4 | Fine-tune / own data? | **Y** (community Nepali train scripts) | COMMUNITY REPORT |
| 5 | Multi-speaker? | **Y** via data + zero-shot | VERIFIED |
| 6 | Clone? | **Y** 5–10s ref | VERIFIED |
| 7 | Identity in Nepali? | Claimed by community FTs; Oshara blog reports Chatterbox LoRA work | COMMUNITY REPORT |
| 8 | Style/emotion? | **Y** exaggeration param | VERIFIED |
| 9 | Long-form? | Community notes hallucination/repetition on Devanagari | COMMUNITY REPORT |
| 10 | GPU? | 500M; inference/fine-tune ~8GB+ comfortable | ASSUMED |
| 11 | Local? | **Y** | VERIFIED |
| 12 | Licenses? | Base **MIT**; community Nepali MIT claimed | VERIFIED |
| 13 | Commercial? | **Y likely** for MIT lineage (still review data) | ASSUMED |
| 14 | Maintained? | **Y** Resemble active (V3) | VERIFIED |
| 15 | Nepali adaptation? | **Medium** (done by community; quality varies) | COMMUNITY REPORT |
| 16 | Phonemes? | **N** text tokens + lang id | VERIFIED |
| 17 | Text? | Y + `language_id` | VERIFIED |
| 18–19 | Ref audio/embeddings? | **Y** | VERIFIED |
| 20 | Training docs? | Official partial; Nepali forks have train READMEs | PART |

### 1.11 Matcha-TTS Nepali (`sandipghimire/matcha-tts-nepali`)

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Nepali? | **Y** | VERIFIED card |
| 2 | Demonstrated? | Samples on HF; Whisper CER ~0.41–0.44 (author) | CLAIMED |
| 3–4 | Fine-tune / own data? | **Y** Matcha recipe | VERIFIED |
| 5 | Multi-speaker? | **Y** 2 speakers (F/M) | VERIFIED |
| 6 | Clone? | **N** | VERIFIED |
| 7 | Identity? | Fixed spk ids | VERIFIED |
| 8 | Style? | Speaking rate/temp only | VERIFIED |
| 9 | Long-form? | U | UNKNOWN |
| 10 | GPU? | ~20.9M + vocoder; **24GB used in training** (author); inference lighter | CLAIMED |
| 11 | Local? | **Y** | VERIFIED |
| 12 | Licenses? | Model **CC-BY-4.0**; Matcha code MIT; Rasa data **CC-BY-4.0** | VERIFIED |
| 13 | Commercial? | **Y with attribution** | VERIFIED |
| 14 | Maintained? | Small project; less active than Ampixa/AI4Bharat | VERIFIED existence |
| 15 | Nepali adaptation? | Already Nepali | ASSUMED |
| 16 | Phonemes? | **Y** 125 Nepali phones via Ampixa G2P | VERIFIED |
| 17 | Text? | Via G2P | VERIFIED |
| 18–19 | Ref/embeddings? | N | VERIFIED |
| 20 | Training docs? | **Y** recipe in repo | VERIFIED |

### 1.12 Others screened

| Model | Nepali | Clone | Commercial weights | Notes | Evidence |
|---|---|---|---|---|---|
| **Kokoro-82M** | **N** | N (official) | **Y Apache-2.0** | Excellent small en; no ne | VERIFIED |
| **MMS TTS (Meta)** | Coverage **likely includes ne** in 1107 langs; **explicit ne card line NOT VERIFIED here** | N practical | **N CC-BY-NC-4.0** | Massively multilingual VITS; quality variable | VERIFIED NC / ne PART |
| **Orpheus TTS** | **N** official (en + multilingual family incl. Hindi, **not ne**) | Partial via research | **Y Apache-2.0** | Strong en prosody | VERIFIED |
| **Sesame CSM-1b** | **N** English | Y | **Y Apache-2.0** | Conversational en | VERIFIED |
| **Dia / Bark** | Not Nepali-focused | Loose | Varies | Not primary | UNKNOWN for ne |
| **Piper ne_NP voices** | Community Piper ne voices exist | N | Depends on voice | CPU baseline only | COMMUNITY REPORT |
| **Oshara Chatterbox-Nepali** | Community | Y | Inherits MIT claim | Parallel to officialuser FT | COMMUNITY REPORT |

---

## 2. Technical comparison table

| Model | Nepali support | Nepali evidence | Voice cloning | Multi-speaker | Fine-tuning | Local inference | GPU requirement | Long-form | Style control | Commercial license | Maintenance | Technical difficulty | Evidence links |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Indic Parler-TTS** | Official Y | VERIFIED card + author NSS | N | Y (69 voices) | Y | Y | Medium–high (~8–12GB practical) | U | Y (caption+emotion) | **Y Apache-2.0** | Active | Medium (already ne) | [HF card](https://huggingface.co/ai4bharat/indic-parler-tts) |
| **Parler-TTS base** | N | VERIFIED | N | Y | Y (best docs) | Y | Medium | U | Y | **Y Apache-2.0** | Active org | High if ne from scratch | [GitHub training](https://github.com/huggingface/parler-tts) |
| **Kala / real-nepali** | Official ne-only | VERIFIED samples+recipe | N | Y (6) | Y | Y | **CPU** | U | Limited | **Y CC-BY-SA-4.0** | Active | Low (pipeline exists) | [HF](https://huggingface.co/ampixa/kalaTTS) [site](https://tts.ampixa.com/kala) |
| **Matcha-TTS Nepali** | Official ne | VERIFIED + author CER | N | Y (2) | Y | Y | Low (train used 24GB) | U | Minimal | **Y CC-BY-4.0** | Moderate | Medium | [HF](https://huggingface.co/sandipghimire/matcha-tts-nepali) |
| **Chatterbox base** | N official | VERIFIED 23 langs no ne | Y | Y | Y | Y | Medium | U (Devanagari risk) | Y exaggeration | **Y MIT** | Active V3 | Medium | [HF](https://huggingface.co/ResembleAI/chatterbox) |
| **Chatterbox-Nepali FT** | Community Y | COMMUNITY REPORT | Y | Y | Y | Y | Medium | Community bugs noted | Y | **Y MIT claimed** | Community | Medium–high | [HF officialuser](https://huggingface.co/officialuser/chatterbox-nepali) |
| **XTTS-v2 base** | N | VERIFIED no ne | Y | Y | Y | Y | Medium | AR drift risk | Weak | **N CPML NC** | Stale upstream | Medium | [HF](https://huggingface.co/coqui/XTTS-v2) |
| **XTTS-v2 Nepali FT** | Community Y | COMMUNITY/CLAIMED metrics | Y | Base Y / FT single-spk train | Y | Y | Medium | Normalisation needed | Weak | **N CPML NC** | Community | Medium | [Oshara](https://huggingface.co/Oshara/xtts-v2-nepali) |
| **F5-TTS** | N | VERIFIED; community romanized ne NC | Y | Y | Y | Y | Medium–high | U | Limited | **N weights CC-BY-NC** | Active | High for ne | [GitHub](https://github.com/SWivid/F5-TTS) |
| **IndicF5** | N (11 ind langs) | VERIFIED no ne | Y | Y | Y | Y | Low–medium (0.4B) | U | Ref-driven | **Y MIT** (verify data chain) | Active | Medium for ne | [HF](https://huggingface.co/ai4bharat/IndicF5) |
| **CosyVoice2/3** | N | VERIFIED | Y | Y | Y | Y | Medium | Streaming Y | Y instruct | **Y Apache-2.0** | Active | High for ne | [GitHub](https://github.com/FunAudioLLM/CosyVoice) |
| **Fish S2.1 / free API** | U explicit ne | Cloud path local; quality NOT YET TESTED | Y cloud | Y | Restricted | Cloud (partial) | Cloud | Y chunked | Y tags | **N w/o commercial license** | Very active | N/A as train base | [docs](https://docs.fish.audio/) [license](https://github.com/fishaudio/fish-speech) |
| **StyleTTS2** | N | VERIFIED | Partial | Y | Y + PL-BERT | Y | Medium | U | Y | **Y MIT code** | Slow/forks | High for ne | [GitHub](https://github.com/yl4579/StyleTTS2) |
| **Kokoro** | N | VERIFIED | N | Pack voices | Hard without arch release depth | Y | **CPU/GPU low** | U | N | **Y Apache-2.0** | Active | High for ne | [PyPI](https://pypi.org/project/kokoro) |
| **MMS TTS** | PART (1107 langs) | ne not line-verified | N | Per-lang | Possible VITS FT | Y | Low | U | N | **N CC-BY-NC** | Research release | Medium | [HF](https://huggingface.co/facebook/mms-tts) |

---

## 3. Buckets (not a ranking)

### A. Strong candidates (test these first)

| Model | Why technically strong for *our* goal |
|---|---|
| **Indic Parler-TTS** | Only large **Apache-2.0** model with **official Nepali + emotion prompts + full training code + multi-voice**. Best path to *train/adapt further* without NC/CPML. No zero-shot clone — clone must come later or from another stack. |
| **Chatterbox base (MIT) + Nepali FT path** | Best alignment with **clone + multi-speaker + MIT + trainable**. Nepali is **not official**; community FTs prove feasibility (COMMUNITY REPORT). Identity preservation path is real. |
| **Kala / Ampixa stack** | Only serious **open Nepali-native** CPU system + **own G2P + training recipe + NepTTS-Bench**. Ideal baseline, G2P truth source, and small-VITS FT sandbox. SA license OK if we accept share-alike on weight derivatives. |

### B. Possible candidates

| Model | Caveat |
|---|---|
| **Matcha-TTS Nepali** | Real Nepali, permissive CC-BY-4.0, tiny, trainable — quality ceiling and no clone. Good smoke-train vehicle. |
| **IndicF5** | Excellent clone architecture + MIT label, **no Nepali**; adaptation required; verify training-data license chain. |
| **CosyVoice2/3** | Apache + clone + style, **no Nepali**; heavier adaptation. |
| **Parler-TTS base** | Superb training docs, **no Nepali** — inferior to starting from Indic Parler for us. |
| **XTTS-v2 Nepali (Oshara)** | Strongest *existing* Nepali+clone checkpoint by author metrics — **CPML blocks commercial**; research comparison only. |
| **MMS / Piper ne** | Fallback CPU baselines; NC or thin quality; not product foundation. |

### C. Poor fit

| Model | Why |
|---|---|
| **F5-TTS official weights** | CC-BY-NC; no Nepali; romanized community FT NC. |
| **StyleTTS2 as primary** | Phoneme+PL-BERT path, no ne verified, English-centric weights. |
| **Kokoro** | No Nepali, no clone, no practical ne train path documented. |
| **Orpheus / CSM** | No Nepali. |
| **Fish as *training* foundation** | Research license, no usable local S2.1 train stack, Nepali unverified on language list. Keep as **baseline product engine**, not foundation to train. |
| **Base XTTS / any CPML product plan** | Non-commercial outputs/weights. |

### D. Not enough evidence

| Item | Missing |
|---|---|
| Fish S2.1 **explicit** Nepali language list | Official language table with `ne` |
| Multilingual PL-BERT **Nepali** | Whether `ne` is in the 14-language set |
| MMS **explicit** `npl`/`ne` TTS card line | Confirm ISO code folder for Nepali |
| Long-form stability all candidates | Our listening + paragraph benchmark |
| Indic Parler VRAM exact inference | Measured on our hardware |
| Community Chatterbox-Nepali objective quality | Human eval vs Fish/Gemini |
| Rasa / Indic-Parler full data legal for *our* commercial fine-tune outputs | License text review |

---

## 4. Most important question (path to *training our own* system)

**What model gives the most realistic path to training our own high-quality Nepali voice system?**

```
BASE QUALITY + NEPALI ADAPTABILITY + CLONING + TRAINABILITY + LOCAL + LICENSING
```

| Candidate | Base | Nepali adapt | Clone | Train docs | Local | License | Path realism |
|---|---|---|---|---|---|---|---|
| Indic Parler-TTS | High (official ne) | **Excellent** | No | Excellent | Yes | **Apache-2.0** | **Strongest train path without clone** |
| Chatterbox+ne FT | High (0.5B clone model) | Good (community proven) | **Yes** | Good/part | Yes | **MIT** | **Strongest train path *with* clone** |
| Kala | Medium (VITS) | Excellent (native ne) | No | Excellent | CPU | CC-BY-SA | Strongest *small* full-control path |
| Matcha ne | Medium | Excellent | No | Good | Yes | CC-BY-4.0 | Fastest trainable Nepali stack |
| XTTS ne | High (claimed) | Done | Yes | Good | Yes | **CPML NC** | Research only — **blocks commercial** |
| Fish S2.1 | Unknown ne / cloud | Opaque | Cloud yes | No | Cloud | Research license | **Not a train foundation** |

**Distinction (explicit):**  
- *Sounds best out of the box (untested claim risk):* Cloud Fish/Gemini/others — **we do not choose on this**.  
- *Most realistic path to train our own system:* **Indic Parler-TTS** (language+license+training) **and/or Chatterbox MIT** (clone+license+trainability), with **Kala/Matcha** as small-stack controls and **XTTS-CPML only as non-commercial reference**.

---

## 5. Experiment designs (DO NOT START)

### EXPERIMENT A — Fastest proof-of-concept

| Field | Value |
|---|---|
| **Model** | **Kala / real-nepali VITS** *or* **Matcha-TTS Nepali** |
| **Dataset size** | 15–45 min validated single-speaker (existing recording script categories A–J) |
| **Speakers** | 1 |
| **Audio** | 44.1/48 kHz WAV → model rate; quiet room; no clip; `dataset:validate` PASS |
| **Transcripts** | Exact Devanagari in metadata.jsonl |
| **GPU** | Optional — CPU OK for Kala-scale; Matcha smoke on single consumer GPU |
| **Method** | Continue-train / short FT with published recipe (Kala `nepal-tts-training` or Matcha recipe) |
| **Difficulty** | **Low** |
| **Evaluation** | `npm run benchmark:compare` subset + 50 pronunciation cases + human CSV (`NEPALI_HUMAN_EVALUATION.md`) |
| **Risks** | Quality plateau (VITS ceiling); SA/BY attribution obligations; not a clone system |

### EXPERIMENT B — Best-quality realistic experiment

| Field | Value |
|---|---|
| **Model** | **Indic Parler-TTS** (primary) — optionally A/B with **Chatterbox MIT** if clone required in same gate |
| **Dataset size** | **2–5 h** single speaker first (plan up to 5–20 h for serious quality — see dataset section) |
| **Speakers** | 1 for pilot; 2–4 later for multi-voice product |
| **Audio** | Same as A; prefer 24 kHz+; consistent mic/session; segment 3–15 s utterances for Parler training stability |
| **Transcripts** | Verbatim Devanagari; optional Data-Speech-style captions for Parler |
| **GPU** | **Tier 2** (see §7): ~16–24 GB class for comfortable FT of ~1B LM-style TTS |
| **Method** | Official Parler fine-tune recipe on Nepali subset (already in-language) → measure before/after on our 316+50 |
| **Difficulty** | **Medium** (data quality dominates) |
| **Evaluation** | Human pronunciation/naturalness vs Fish, Gemini (when up), Kala; no MOS claims without listening |
| **Risks** | Gated HF access; caption quality; no zero-shot clone (identity = trained speakers); long-form drift |

### EXPERIMENT C — Long-term production model

| Field | Value |
|---|---|
| **Model** | **Chatterbox-Multilingual MIT** continued-train **or** Indic Parler multi-speaker + separate clone module — decision after A/B listening |
| **Dataset size** | **10–20+ h** multi-speaker Nepali (self-recorded + clearly licensed public) |
| **Speakers** | **3–8** native Nepali (gender/age variety) for product voice pack |
| **Audio** | Studio-ish; same standard doc; speaker IDs mandatory |
| **Transcripts** | Verbatim + optional style tags/emotion labels where model supports |
| **GPU** | **Tier 2–3** (24 GB+; multi-GPU if scaling) |
| **Method** | Multi-speaker FT + optional LoRA for clone identity; distill/quantize for private deploy |
| **Difficulty** | **High** |
| **Evaluation** | Full 316 sentence set, identity tests with ref audio, long-form paragraphs (cat Z), regression vs Experiment B |
| **Risks** | Data rights for commercial; watermark (Chatterbox PerTh) implications; engineering load; forgetting |

---

## 6. Dataset recommendation (structure + public data)

### Target structure (why)

| Choice | Rationale |
|---|---|
| **Start single-speaker** | Isolates *language* quality from speaker variance; matches Oshara XTTS-Ne (~10.5 h) and Kala/Matcha recipes; fewer hours to first signal |
| **Short utterances 3–15 s** | Standard TTS FT grain; easier QC, alignment, and batching; matches our validator clip guidance |
| **Then multi-speaker 3–8** | Product needs multiple native voices; Parler/Chatterbox/VITS all multi-spk capable |
| **Mix ~70% read + ~30% longer/paragraph** | Short alone → brittle long-form; paragraph clips train prosody/holds |
| **Cover our A–Z / A–J categories** | Guarantees aspirates, retroflexes, conjuncts, nasal, numbers, emotion — not just easy sentences |
| **Conversational later** | Spontaneous speech helps agent use-cases but alignment/QC cost is higher — phase 2 |
| **No magic number** | Hours ≠ quality; **validated, consistent, correctly transcribed** minutes beat noisy hours |

**Practical staging:**  
1. Smoke 15–45 min → Experiment A  
2. 2–5 h clean single-spk → Experiment B  
3. 10–20 h multi-spk → Experiment C  

### Public datasets — legal usability

| Dataset | License | Research | Personal | Commercial | Notes |
|---|---|---|---|---|---|
| **Common Voice Nepali (ne-NP)** | **CC0-1.0** (listing) | Y | Y | **Y** | Read sentences; quality/noise variable; scripted speech |
| **OpenSLR SLR43** (Google Nepali TTS, female) | **CC-BY-SA 4.0** | Y | Y | **Y with share-alike** | Multi-spk TTS; SA may attach to derivatives — **legal review** if product sensitive |
| **OpenSLR SLR143** (male+female Nepali) | **CC-BY-NC-SA 4.0** | Y | Y | **N** | **Research/personal only** — do not plan commercial product on this |
| **AI4Bharat Rasa (Nepali)** | **CC-BY-4.0** (gated) | Y | Y | **Y with attribution** | Studio quality; Matcha used it; request access |
| **Indic-Parler / GLOBE-annotated** | Per Indic Parler card (Apache model; dataset separate) | Y | Y | Review dataset row-by-row | Prefer for Parler FT consistency |
| **Ampixa open voice corpus / recorder** | Project states open/permissive licenses | Y | Y | Verify per tagged release | Aligns with NepTTS-Bench |
| **Oshara / community Nepali clips** | Depends (often inherits CPML for XTTS outputs) | Y | Y | **Likely N if CPML** | Do not train commercial stack on NC/CPML audio |
| **SLR43 + CV + Rasa + self-record** | Mixed | — | — | Prefer **CC0 + CC-BY + self** for product core | Keep license manifest per file |

**Rule:** Research-only data (e.g. **SLR143 NC**, **CPML outputs**, **F5 Emilia-derived NC**) **cannot** silently become commercial training data. Maintain `LICENSES.md` manifest per source.

---

## 7. Hardware tiers (realistic, no invented train times)

| Tier | Role | GPU VRAM | RAM | Storage | Workload |
|---|---|---|---|---|---|
| **Tier 1 — minimum experimentation** | Inference Indic Parler/Kala/Matcha; smoke FT tiny VITS; human eval gen | **8 GB** (12 GB comfortable); CPU-only OK for Kala | 16 GB | 100–200 GB SSD | Experiment A; generate 316 benchmark; LoRA experiments at small batch if at all |
| **Tier 2 — serious fine-tuning** | Parler ~1B FT / Chatterbox 500M FT; multi-hour data | **16–24 GB** (24 GB ideal) | 32–64 GB | 0.5–1 TB NVMe + backup | Experiment B; multi-spk pilots; tensorboard/ckpt space |
| **Tier 3 — large training** | Multi-spk production FT, ablations, distillation | **24 GB+ ×1–4** (e.g. 2×24 or 4×24) | 64–128 GB | 2–4 TB NVMe + cold storage | Experiment C, full ablations, long-form hardening |

Exact wall-clock times: **UNKNOWN / NOT VERIFIED** until config + data + hardware fixed.

---

## 8. Sources examined (primary preference)

1. https://huggingface.co/ai4bharat/indic-parler-tts — official model card  
2. https://ai4bharat.iitm.ac.in/areas/model/TTS/Indic%20Parler%20TTS  
3. https://github.com/huggingface/parler-tts — training README  
4. https://huggingface.co/parler-tts/parler-tts-mini-multilingual-v1.1  
5. https://huggingface.co/ampixa/kalaTTS · https://huggingface.co/ampixa/real-nepali-v0.2-kala · https://tts.ampixa.com/kala  
6. https://github.com/Ampixa/nepal-tts-training (referenced)  
7. https://github.com/SWivid/F5-TTS — license section  
8. https://huggingface.co/ai4bharat/IndicF5  
9. https://github.com/FunAudioLLM/CosyVoice — languages + LICENSE  
10. https://github.com/fishaudio/fish-speech — Fish Audio Research License  
11. https://docs.fish.audio/developer-guide/models-pricing/models-overview  
12. https://fish.audio/s2 — commercial FAQ  
13. https://huggingface.co/fishaudio/s1-mini — language list + CC-BY-NC-SA  
14. https://huggingface.co/coqui/XTTS-v2 — languages + CPML  
15. https://github.com/yl4579/StyleTTS2  
16. https://huggingface.co/ResembleAI/chatterbox  
17. https://huggingface.co/officialuser/chatterbox-nepali  
18. https://github.com/officialuser/chatterbox-nepali  
19. https://huggingface.co/sandipghimire/matcha-tts-nepali  
20. https://huggingface.co/Oshara/xtts-v2-nepali + Oshara blog  
21. https://huggingface.co/facebook/mms-tts — CC-BY-NC  
22. https://github.com/facebookresearch/fairseq — examples/mms  
23. https://huggingface.co/hexgrad/Kokoro-82M (via PyPI kokoro)  
24. https://github.com/canopyai/Orpheus-TTS  
25. https://huggingface.co/sesame/csm-1b  
26. http://openslr.org/43 — SLR43 CC-BY-SA  
27. http://openslr.org/143 — SLR143 CC-BY-NC-SA  
28. https://commonvoice.mozilla.org datasets — Nepali CC0  
29. Prior local: `docs/FISH_API_AUDIT.md`, `docs/TTS_FOUNDATION_RESEARCH.md`, `docs/DECISION_REPORT.md`

---

## 9. Explicit non-claims

- No model is declared “best sounding.”  
- No NSS/CER/SCOREQ number is treated as our measurement.  
- No experiment in §5 has been started.  
- No automatic weight downloads performed in this task.
