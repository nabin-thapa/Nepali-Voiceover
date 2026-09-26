# Engine Comparison (listening log)

Date created: 2026-09-24
Status: **NOT YET TESTED — no human listening scores recorded. Research ranking only.**

Related: `docs/TTS_FOUNDATION_RESEARCH.md` (static research), `docs/NEPALI_HUMAN_EVALUATION.md` (protocol).

---

## How to fill this file

1. Run `npm run benchmark:compare -- --engines=fish,gemini --limit=50 --use=cases`
2. Listen with headphones per `docs/NEPALI_HUMAN_EVALUATION.md`
3. Write scores below — only after listening
4. Label rows **VERIFIED (listened)** or leave **NOT YET TESTED**

Do not paste model-card MOS/NSS numbers as if we measured them.

---

## Engine roster

| Engine id | Display name | Local | Nepali support | Clone | Evidence |
|---|---|---|---|---|---|
| fish | Fish Audio s2.1-pro-free | No (cloud) | unverified (not in official language list) | Yes | VERIFIED integration (live synthesize 2026-09-24) / NOT YET TESTED quality |
| gemini | Gemini TTS ne-NP | No (cloud) | verified official | No | VERIFIED language / NOT YET TESTED our scores |
| indic_parler | Indic Parler-TTS | Yes (GPU) | verified official | No | EXPERIMENTAL (gated, not downloaded) |
| kala | kala-tts real-nepali | Yes (CPU) | verified official | No | **VERIFIED local install + 30/30 WAV (2026-09-24)** / quality **NOT YET TESTED** — see `docs/KALA_POC_REPORT.md` |
| chatterbox_nepali | Chatterbox-Nepali FT | Yes (GPU) | experimental (community) | Yes | EXPERIMENTAL |
| alternative | Alternative | depends | unverified | depends | NOT YET TESTED |

---

## Scores (empty until listening)

| Sentence ID | Engine | Voice | Pronunciation | Naturalness | Prosody | Rhythm | Pauses | Voice Identity | Emotion | Notes | Listener | Date | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _no rows yet_ | | | | | | | | | | | | | NOT YET TESTED |

---

## Category means

_Aggregate only after ≥10 rows per engine exist._

| Engine | Pronunciation | Naturalness | Prosody | Rhythm | Pauses | n |
|---|---|---|---|---|---|---|
| fish | — | — | — | — | — | 0 |
| gemini | — | — | — | — | — | 0 |
| indic_parler | — | — | — | — | — | 0 |
| kala | — | — | — | — | — | 0 |

---

## Decision log

| Date | Decision | Basis |
|---|---|---|
| 2026-09-24 | Keep Fish as working baseline | Existing clone path + unlimited drafts (VERIFIED) |
| 2026-09-24 | Indic Parler-TTS = first local candidate to A/B | Official Nepali + Apache-2.0 (research) |
| 2026-09-24 | kala-tts = CPU baseline + G2P reference | Official Nepali-only (research) |
| _pending_ | _Winner after listening_ | _Must include human scores_ |
