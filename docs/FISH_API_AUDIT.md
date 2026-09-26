# Fish Audio API Audit — payload vs official docs

Date: 2026-09-23  
Sources: `https://api.fish.audio/openapi.json`, `https://docs.fish.audio/llms.txt`, voice-cloning best practices, pronunciation-dictionaries guide.

---

## 1. Endpoints used by this app

| Use | Endpoint | Method | Status |
|---|---|---|---|
| Synthesis | `https://api.fish.audio/v1/tts` | POST | Active |
| Clone | `https://api.fish.audio/model` | POST | Active |
| List models | `GET /model` | — | Not used |
| Voice design | `/v1/voice-design` | — | Not used |
| ASR | `/v1/asr` | — | Not used (clone relies on `texts[]`) |

**Model header enum (OpenAPI):** `s1 | s2-pro | s2.1-pro | s2.1-pro-free | drama-3-preview`  
**This app:** `s2.1-pro-free` (documented free developer tier; same S2.1 family as paid `s2.1-pro`).

---

## 2. Current TTS payload (`server.ts` `generateFishTTS`) vs `TTSRequest`

| Field | Current value | OpenAPI | Verdict |
|---|---|---|---|
| `text` | prepared Devanagari | required string | **OK** |
| `reference_id` | 24-hex stock/clone id | string \| string[] \| null | **OK** (single speaker) |
| `format` | `"wav"` | `wav \| pcm \| mp3 \| opus` | **OK** |
| `sample_rate` | `44100` | int \| null (44100 default for most) | **OK** |
| `normalize` | `false` | bool, EN/ZH normalize | **OK** (correct for Devanagari) |
| `temperature` | 0.3 clone / 0.45 stock | 0–1, default 0.7 | **OK** (conservative) |
| `top_p` | 0.65 / 0.75 | 0–1, default 0.7 | **OK** |
| `repetition_penalty` | `1.2` | default 1.2 | **OK** (matches default) |
| `latency` | `"normal"` | `low \| normal \| balanced` | **OK** (quality-first) |
| `chunk_length` | `300` | 100–300, default 300 | **OK** (max context) |
| `features` | `["quality-guard"]` | string[] | **OK** (documented feature flag) |
| `prosody` | `{speed, volume, normalize_loudness}` | `ProsodyControl` | **OK** |
| `min_chunk_length` | not sent | default 50 | Optional — default applies |
| `condition_on_previous_chunks` | not sent | default true | Optional — default applies |
| `early_stop_threshold` | not sent | default 1 | Optional |
| `max_new_tokens` | not sent | default 1024 | Optional |
| `mp3_bitrate` / `opus_bitrate` | not sent | defaults | N/A for wav |
| `pronunciation_dictionary` | **deliberately omitted** | up to 3 dicts; **EN Arpabet / ZH pinyin / JA OpenJTalk only** | **Correct omission** — no Nepali phoneme inventory; ARPAbet would garble Devanagari |
| `references` | not sent | `ReferenceAudio[]` **requires MessagePack** | See §3 |
| `language` | **does not exist** | not in schema | **N/A** — no language channel on TTS |

**Content-Type used:** `application/json` — valid when `references` is absent.

**Headers:** `Authorization: Bearer …`, `Content-Type: application/json`, `model: s2.1-pro-free` — matches samples.

---

## 3. Multi-reference instant clone (`references`) — NEW optional path

From OpenAPI `TTSRequest.references`:

- Inline zero-shot refs: array of `{ audio: binary, text: exact transcript }`.
- **Requires `Content-Type: application/msgpack` (not JSON).**
- Recommend **10–30 s** clean speech; `text` must match audio exactly.
- Can combine with or without `reference_id` (docs: provide either `reference_id` **or** `references` for single speaker; multi-speaker uses 2D arrays + `<|speaker:N|>` tags).
- Multi-speaker dialogue tags are S2-family only — **not used** (single-voice VO app).

**Implementation (this repo):** optional mode, **default OFF**  
- Config: `config/tts-engines.json` → `fishMultiReference.enabled` (or env `FISH_MULTI_REF=1`).  
- When ON: load samples from `reference-audio/` (`*.wav|mp3` + matching `*.txt` transcript), encode payload as MessagePack, POST with `Content-Type: application/msgpack`.  
- When OFF: unchanged JSON + `reference_id` path (production default).

**Msgpack constraint:** nested binary cannot go through multipart; JSON cannot carry raw audio bytes for `references`.

---

## 4. Clone (`POST /model`) vs docs

| Field | Current | OpenAPI | Verdict |
|---|---|---|---|
| `type` | `tts` | const `tts` | **OK** |
| `title` | user | required string | **OK** |
| `train_mode` | `fast` | **const `"fast"` only** | **OK — only mode that exists** |
| `voices[]` | up to 20 blobs | 1–20 binary | **OK** |
| `texts[]` | Devanagari exact | optional; else ASR | **OK** (language anchor) |
| `tags` | nepali/ne/nepal/kathmandu/ne-NP | string[] | **OK** |
| `enhance_audio_quality` | bool | bool default true | **OK** |
| `visibility` | `private` | public/unlist/private | **OK** |
| `generate_sample` | `false` | bool | **OK** |
| `description` | set | optional | **OK** |
| Language fine-tune / LoRA / full train | **not in schema** | no endpoint | **Case C** — see finetune determination |

**Best practices (docs):** ≥10 s clips; quiet room; 2–3 clips of 15–20 s forming a paragraph; one speaker; steady volume; exact transcript. App already warns when sampleCount &lt; 2, longest &lt; 10 s, total &lt; 20 s.

---

## 5. Pronunciation dictionary (docs)

| Language | Value format |
|---|---|
| English | CMU Arpabet |
| Chinese | tone-number pinyin |
| Japanese | OpenJTalk-style romaji |

**Nepali: not supported.** Inline or managed dictionaries cannot encode Kathmandu phonology.  
App rule stands: **never send ARPAbet/IPA for Devanagari.** Orthographic respelling + `reference_id` only.

Limits (for reference): 3 dictionaries/request, 5000 rules each, key ≤256 chars, value ≤1024 chars; managed refs use `id`+`version`; silent skip if unresolvable.

---

## 6. Bracket / style control note

Earlier project assumption: free-form `[brackets]` are **spoken aloud** on Fish (observed preamble behavior) — **do not inject director cues into `text`.**  
Marketing docs also describe `[whispers]`-style control on S2 — **behavior on free tier + Devanagari is not verified.** Until A/B proves bracket cues are *not* spoken, keep `scrubFishSpokenText` stripping them. Style remains via `prosody` + sampling + reference voice.

---

## 7. Sample rates

OpenAPI: `sample_rate` null → format default **44100** (opus 48000).  
Code comment historically listed 8000/16000/24000/32000/44100 — **44100 is correct and documented.** Keep `44100` + `format: wav`.

---

## 8. Gaps / actions

| # | Gap | Action | Priority |
|---|---|---|---|
| 1 | No multi-ref zero-shot path | Optional `references` + msgpack, **default OFF** | Medium (verify before enable) |
| 2 | Optional chunk params not set | Leave defaults unless A/B needs them | Low |
| 3 | No language FT on API | Finetune determination = **Case C** | Document only |
| 4 | 1-sample clones weak | Re-record per `NEPALI_REFERENCE_RECORDING_SCRIPT.md` | **High** |
| 5 | Bracket style unverified on free tier | Keep stripping | Keep |
| 6 | Compare dirs mixed | Split `comparison/fish/` vs `comparison/gemini/` | Done in scripts |

**Audit conclusion:** Current JSON TTS payload is **schema-valid and conservative**. The only missing high-value cloud feature is optional multi-reference (msgpack), gated off until listen-verified. No Nepali phoneme/dictionary/FT channel exists on this API.
