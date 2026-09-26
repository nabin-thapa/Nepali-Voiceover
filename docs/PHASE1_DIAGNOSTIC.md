# Phase 1 — Diagnostic Report (BEFORE major changes)

Date: 2026-09-23  
Scope: Where do Nepali pronunciation errors originate?

---

## 0. Executive answer

| Question | Answer |
|---|---|
| Is this local fish-speech (Python)? | **NO.** Zero `.py` files. 100% cloud. |
| Is the tokenizer observable? | **NO.** Opaque inside Fish Audio cloud. |
| Is the acoustic model inspectable? | **NO.** Header `model: s2.1-pro-free` only. |
| Can we send Nepali phonemes / language code to Fish? | **NO.** Payload has no `language`, no usable `pronunciation_dictionary` for Nepali. |
| What is the only real pronunciation lever? | **The Devanagari text string itself** (preprocessing) + speaker `reference_id` + sampling/prosody knobs. |
| Primary root cause class | **CASE E** (combination): preprocessing (A) + **opaque Fish Nepali coverage (C/E/F HIGH)** + reference/clone conditioning (G/H MED). See Phase 11. |

**Test sentence pipeline (observable):**

```
Original:  म आज काठमाडौं जाँदैछु। हाम्रो गाउँमा धेरै भैंसी छन्।
→ Unicode NFC / zero-width clean          (unchanged)
→ strip tags / symbols / digits           (unchanged)
→ user pronunciation.json                 (no hit on this form)
→ PRONUNCIATION_LEXICON (367 rules)       (no hit)
→ KATHMANDU_PHONETIC_RULES (350 rules)    (no hit)
→ nepali_pronunciation.json dictionary    (भैंसी → भैँसी)  ← ONLY mutation
→ precise mode                            (skipped in natural)
→ prosody punctuation                     (unchanged)
→ scrubFishSpokenText                     (unchanged)
→ Fish API text field:
  "म आज काठमाडौं जाँदैछु। हाम्रो गाउँमा धेरै भैँसी छन्।"
→ [OPAQUE] Fish tokenizer + acoustic model + vocoder
→ audio bytes
```

Tokenizer representation: **NOT observable from this codebase.**  
Model input after Fish internal tokenization: **NOT observable.**  
Generated audio: returned as WAV/MP3 data URL only.

⇒ We cannot prove “wrong input representation” vs “Fish model lacks Nepali” from logs alone. We can only A/B the **input string** (Phase 2/14) and compare against Gemini as quality reference (Phase 10).

---

## 1. Confirmed architecture

| Component | Reality | Evidence |
|---|---|---|
| Fish TTS | **CLOUD** `POST https://api.fish.audio/v1/tts` | `server.ts:40`, fetch `1390-1399` |
| Fish model | HTTP header `model: "s2.1-pro-free"` | `server.ts:1396` |
| Fish clone | CLOUD `POST https://api.fish.audio/model` | `server.ts:2476-2482` |
| Gemini TTS | CLOUD, `languageCode: "ne-NP"` | `server.ts:36-37`, `1923` |
| Local fish-speech / Python | **NONE** | glob `**/*.py` → 0 |
| Local code | Text normalization only | `server.ts`, `nepaliNormalize.ts` |
| Tokenizer | **NONE local** | `nepaliNormalize.ts:4` |
| Deps | express, `@google/genai`, react/vite; no TTS runtime | `package.json` |

Stages **C, F, I** and phonetic part of **E** happen inside closed cloud stacks → **unobservable**.  
Inspectable: **A, B, D(local), G(partial), H(partial), J**.

---

## 2. Stage-by-stage A–J

| Stage | What code does | Risk | Evidence |
|---|---|---|---|
| **A. Input normalization** | Two chained pipelines; `prepareSpeechTextDebug` + `runNepaliNormalize`; can run 4–5× per request; large rule surface with risky single-token rules (`यस→हजुर`, `था→थियो`, etc.) | **MED** | `server.ts:1234-1286`, `326-709`, `717-1073` |
| **B. Unicode** | NFC, zero-width, danda, quotes; no blind chandrabindu rewrite | **LOW** | `nepaliNormalize.ts:64-80` |
| **C. Tokenizer** | **Cloud-opaque.** No local tokenizer. Conjunct/schwa errors unobservable. | **HIGH (opaque)** | `nepaliNormalize.ts:4`; no token IDs in API response |
| **D. Language ID** | Local `detectLanguage` (Devanagari count) only chooses which rewrites run. **Not sent to Fish.** Fish has no language field. Clone tags only at clone time. | **MED** | `nepaliNormalize.ts:47-54`; payload has no language; `server.ts:2464-2474` |
| **E. Fish language representation** | Payload: `text`, `reference_id`, format/sampling/prosody only. **No language, no Nepali phonemes, no ARPAbet dict** (deliberately omitted — garbles). Instructional `[...]` cues are spoken aloud. | **HIGH (by absence)** | `server.ts:1372-1388`, `1385-1387`, `97-109` |
| **F. Acoustic model** | `s2.1-pro-free` opaque; sampling knobs only | **HIGH (opaque)** | `server.ts:1396`, `1377-1384` |
| **G. Speaker conditioning** | `reference_id`; silent fallback to Kore if missing | **MED** | `server.ts:1507-1512`, `1374` |
| **H. Reference voice** | Clone: `train_mode=fast`, `enhance_audio_quality`, tags+texts; 2/3 clones are 1-sample | **MED-HIGH** | `server.ts:2453-2474`, `voices.json` |
| **I. Vocoder** | Opaque; pronunciation-neutral mostly | **LOW-MED** | returns final bytes `1408` |
| **J. Post-process** | Loudness normalize only; no phoneme edit | **LOW** | `prosody.normalize_loudness` |

**Heat map:** A MED · B LOW · **C HIGH** · D MED · **E HIGH** · **F HIGH** · G MED · H MED-HIGH · I LOW-MED · J LOW

---

## 3. Fish API payload (complete)

**Headers:** `Authorization: Bearer …`, `Content-Type: application/json`, `model: s2.1-pro-free`

**Body:**
| Field | Value |
|---|---|
| `text` | prepared Devanagari |
| `reference_id` | 24-hex stock/clone |
| `format` | `"wav"` |
| `sample_rate` | `44100` (allowed: 8000/16000/24000/32000/44100) |
| `normalize` | `false` (EN/ZH-only feature) |
| `temperature` | 0.45 stock / 0.3 clone |
| `top_p` | 0.75 / 0.65 |
| `repetition_penalty` | `1.2` |
| `latency` | `"normal"` |
| `chunk_length` | `300` |
| `features` | `["quality-guard"]` |
| `prosody.speed` | wpm/140 clamped 0.5–2 |
| `prosody.volume` | `0` |
| `prosody.normalize_loudness` | `true` |

**NOT sent:** `language`, `language_code`, `pronunciation_dictionary`, `phonemes`, `ipa`, `top_k`, `stream`, `seed`, emotion tags.

---

## 4. What Fish does NOT support for Nepali (from code + payload)

1. No `language` / `ne-NP` field (`server.ts:2179`)
2. No usable `pronunciation_dictionary` (ARPAbet ≠ Fish inventory → garbled) (`1385-1387`)
3. No Nepali phoneme/IPA tags (EN/ZH/JA only) (`nepaliNormalize.ts:5-6`)
4. No local tokenizer path (`nepaliNormalize.ts:4`)
5. No instructional control tokens — Fish **speaks** `[...]` aloud (`49-55`)
6. `normalize` useless for Devanagari (`1377`)
7. Language anchoring only at clone time (tags + texts), never at synthesis

⇒ **Entire pronunciation strategy = pre-respell Devanagari + hope opaque model reads it.**

---

## 5. Dictionary / lexicon plug-in points

| Source | Order | Notes |
|---|---|---|
| `pronunciation.json` (user, 12) | 1st | CRUD: `GET/POST/DELETE /api/pronunciation` |
| `PRONUNCIATION_LEXICON` (367) | 2nd | Can overwrite user results |
| `LATIN_TO_DEVANAGARI` + transliterate | 3rd/4th | |
| `KATHMANDU_PHONETIC_RULES` (350) | after lexicon | |
| `nepali_pronunciation.json` (285 keys, 55 real changes) | in `runNepaliNormalize` | |
| `PRECISE_RULES` (17) | only `pronunciation=precise` | |
| Fish-side dict | **DISABLED** | |
| Director LLM rewrite | before re-prep | **Currently 429 offline** — local prep is live authority |

---

## 6. Tokenizer observability (plain statement)

**The tokenizer is NOT observable.** No token/phoneme IDs, no response metadata. Any claim about how Fish segmented `जाँदैछु` / `भैंसी` / `गाउँमा` is unfalsifiable from this repo. Only input-rewrite → output-audio A/B (Phase 2/14) characterizes it indirectly. Same opacity for Gemini’s front-end.

---

## 7. Key file map

| File | Role |
|---|---|
| `server.ts` (2621 lines) | Full pipeline, Fish/Gemini/clone APIs |
| `nepaliNormalize.ts` | Unicode + dictionary + prosody layer |
| `nepali_pronunciation.json` | Orthographic dict (285) |
| `pronunciation.json` | User overrides |
| `voices.json` | 3 trained clones (Thapa 3-sample; herum/NABIN 1-sample) |
| `scripts/test-pronunciation.ts` | Text unit tests |
| `scripts/test-audio.ts` | E2E audio tests |
| `src/App.tsx` | UI controls (language/pronunciation/debug) |

---

## 8. Implication for later phases

- **Phase 3** representation must stay **orthographic Devanagari** (Fish-compatible); never invent IPA tokens.
- **Phase 4** intelligent rules must be **context-aware** and user-editable without source changes (API already exists; needs better UI + context guards).
- **Phase 5/6** fine-tuning: investigate Fish cloud custom-model path + open fish-speech FT separately; **do not auto-train**.
- **Phase 11** will honestly state CASE D contribution: Fish `s2.1-pro-free` Nepali coverage is **unverifiable and likely insufficient** for Gemini-class naturalness; text prep alone cannot fully close the gap.
- **Phase 12** modular `TTS_ENGINE` is required to test whether Fish is the limiter.
