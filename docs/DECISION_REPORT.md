# Decision Report — Nepali naturalness on Fish clone

Date: 2026-09-23  
Scope: best realistic route to **natural Kathmandu Nepali** in **your cloned voice**, keeping Fish + UI + clone path.

---

## Executive decision

| Bucket | Item | When / how |
|---|---|---|
| **FREE (do now)** | Multi-sample Kathmandu re-record (script A–I) + re-clone Thapa-style with exact Devanagari transcripts | `docs/NEPALI_REFERENCE_RECORDING_SCRIPT.md` → Voice Cloner → listen probes |
| **FREE** | Keep orthographic prep + user dictionary + conversational prosody (already shipped) | default pipeline |
| **FREE** | Human error reports on comparison audio | `docs/PRONUNCIATION_ERROR_REPORT.md` |
| **FREE** | Re-run Gemini vs Fish when TTS quota allows → `comparison/fish/` + `comparison/gemini/` | `npm run compare:reference` |
| **FREE** | Optional multi-reference (`references` + msgpack) **OFF until A/B listen** | `config/tts-engines.json` → `fishMultiReference` |
| **CLOUD-POSSIBLE** | Fish multi-sample clone (≤20 voices, `train_mode=fast`) — **already used**; upgrade quality with better clips | `POST /model` |
| **CLOUD-POSSIBLE** | Zero-shot multi-ref per request (MessagePack) if listen-verified better than `reference_id` alone | gated feature |
| **CLOUD-POSSIBLE** | Quality-guard + conservative sampling + 44.1 kHz wav (already) | payload |
| **REQUIRES-FINETUNE** | Deep language adaptation **on Fish cloud** | **Not available** on public API (`train_mode` = `fast` only) — **Case C** |
| **REQUIRES-FINETUNE** | Local fish-speech LoRA/full FT on Nepali + your speaker | separate subsystem; 5–20 h single-speaker start; **no auto-train** |
| **REQUIRES-LOCAL** | Inspectable tokenizer / true Nepali phoneme control | only if running local fish-speech-class stack |
| **REQUIRES-LOCAL** | Offline ASR pronunciation scorer loop | local Whisper-class + human audit (optional) |
| **NOT-POSSIBLE** | Nepali phoneme / IPA channel on Fish TTS API | no field in OpenAPI |
| **NOT-POSSIBLE** | Nepali entries in Fish `pronunciation_dictionary` | EN/ZH/JA Arpabet/pinyin/OpenJTalk only |
| **NOT-POSSIBLE** | `language: ne-NP` on `/v1/tts` | field does not exist |
| **NOT-POSSIBLE** | Guarantee Gemini-class naturalness from text patches alone on opaque `s2.1-pro-free` | **CASE D** — model path unverifiable |
| **NOT-POSSIBLE** | Auto language fine-tune via this app’s clone endpoint | `train_mode` const `fast` |

---

## Finetune determination (A / B / C / D)

| Case | Question | Verdict |
|---|---|---|
| **A** | Can we fine-tune **this** Fish cloud model for Nepali language with a public API? | **NO** — `POST /model` only accepts `train_mode: "fast"` (instant clone). No LoRA/full/language-FT endpoint in OpenAPI. |
| **B** | Is a **better multi-sample clone** (still zero-shot/fast) available? | **YES** — up to 20 samples + exact texts; this is **speaker conditioning**, not deep language FT. **Highest free ROI.** |
| **C** | Does the **current product path** support cloud language fine-tuning? | **NO — Case C confirmed** for language adaptation. Only fast clone exists. |
| **D** | Is the **base model** the limiter for Nepali quality? | **LIKELY YES (Case D)** — no language channel, no Nepali dictionary, opaque s2.1-pro-free; must A/B vs Gemini to measure gap. |

**Primary conclusion: Case C (no cloud language FT) + strong Case D risk.**  
**Action ladder:** better reference (B) → listen A/B (measure D) → if D dominates, local FT or alternative engine.

---

## Alternative engines (scored 10 criteria) — `config/tts-engines.json`

Criteria (0–2 each, max 20): Nepali support · voice clone · quality · cost · latency · privacy · hardware fit · license · integration effort · keeps current UI.

| Engine | Nepali | Clone | Score | Role |
|---|---|---|---|---|
| **Fish s2.1-pro-free** (current) | opaque / weak-unverified | yes | **~12** | **Default** — unlimited draft + your clone |
| **Gemini ne-NP TTS** | **native strong** | no (stock only) | **~14** as **reference** / limited by 10/day + 429 | Quality bar only — **not** clone replacement |
| Azure neural (ne voices) | yes (limited) | limited custom | ~11 | Cloud alternative if key + identity OK |
| Meta MMS / Indic local | verify `ne` | no / weak | ~8–10 | Local quality uncertain; GPU |
| Piper | community verify | no | ~6 | CPU cheap; Nepali voice quality unknown |
| Coqui XTTS v2 | weak official ne | yes | ~7 | Clone yes, Nepali weak |
| Local fish-speech + LoRA | trainable | yes | **~15 if data+GPU** | Only path for **deep FT + your voice** (REQUIRES-FINETUNE/LOCAL) |

**Selection:** stay `FISH_SPEECH` until listen-tests show Case D ceiling; then either local FT or `ALTERNATIVE` adapter — **do not auto-download large models.**

---

## Comparison paths (Task 7)

```
benchmark/comparison/fish/<id>/audio.wav     # Fish clone
benchmark/comparison/gemini/<id>/audio.wav   # Gemini ne-NP reference (when quota)
benchmark/comparison/<id>/errors.json        # optional human error rows
benchmark/comparison/SUMMARY.json
```

Legacy `benchmark/comparisons/` remains for old runs.

---

## Priority order (do not skip listen)

1. Record Clip A–H → multi-sample clone → **listen** 3 probes  
2. `npm run compare:reference` when Gemini works → fill error report  
3. Measure share of cause **D**  
4. Only if D high: local FT plan (`docs/PHASE5_FINETUNE_PLAN.json`) or alternative  
5. Never word-patch forever; never claim success without audio  

---

## Explicit non-goals

- No rebuild of UI/engine  
- No non-Nepali content  
- No invented IPA for Fish  
- No auto-training  
- No copying Gemini voice into the clone  
