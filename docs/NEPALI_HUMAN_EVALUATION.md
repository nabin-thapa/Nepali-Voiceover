# Nepali Human Listening Evaluation

Status: **EXPERIMENTAL (protocol ready; scores NOT YET TESTED — no audio listened to yet)**
Date: 2026-09-24
Corpus: `benchmark/nepali/corpus.json` (316 sentences, categories A–Z)
Pronunciation cases: `benchmark/nepali/pronunciation_cases.json` (50 cases, difficulty 1–5)

---

## Purpose

Judge **actual Nepali pronunciation quality** by human listening. Generation success, API latency, and file size are NOT quality scores. This protocol exists so no one can accidentally treat "it made a WAV" as "it speaks Nepali well."

---

## Evaluation scales (1–5)

### Pronunciation
| Score | Meaning |
|---|---|
| 1 | Severely wrong — words mispronounced, unintelligible Nepali, wrong phoneme class (e.g. ज्ञ as "ja-gya" split wrongly, ष as s) |
| 2 | Frequently wrong — many words off, native listener must re-listen often |
| 3 | Understandable — some words clearly wrong, most okay |
| 4 | Mostly correct — occasional slips, rarely needs re-listen |
| 5 | Native-like — no noticeable mispronunciation |

### Naturalness
| Score | Meaning |
|---|---|
| 1 | Robotic / concatenated feel |
| 2 | Mostly flat, synthetic |
| 3 | Acceptable TTS, some unnatural stretches |
| 4 | Quite natural, minor artifacts |
| 5 | Highly natural, hard to distinguish from careful human read |

### Prosody (pitch/expression)
1 = monotone → 5 = appropriately expressive for context

### Rhythm & timing
1 = rushed/choppy → 5 = well-paced, natural stress

### Pauses
1 = wrong or missing pauses → 5 = pauses match punctuation and breath groups

### Voice identity (clone engines only)
1 = different speaker → 5 = matches reference speaker identity
(For non-clone engines: write N/A — do not invent a score.)

### Emotion/style match (for category Y and caption-driven engines)
1 = wrong emotion → 5 = matches intended emotion

---

## Report row format

One row per (Sentence, Engine) pair:

| Field | Example |
|---|---|
| Sentence ID | K-002 |
| Engine | fish |
| Voice | Thapa-clone |
| Pronunciation | 3 |
| Naturalness | 4 |
| Prosody | 3 |
| Rhythm | 4 |
| Pauses | 3 |
| Voice Identity | 5 |
| Emotion | N/A |
| Overall Notes | "ज्ञ pronounced as separate ja+gya; rest clean." |

Store rows in `benchmark/comparison/evaluations.csv` (create header on first use):

```
sentence_id,engine,voice,pronunciation,naturalness,prosody,rhythm,pauses,voice_identity,emotion,notes,listener,date
```

---

## Procedure

1. **Blind where possible.** Rename files to neutral IDs for the listener when comparing engines (A/B). Keep the answer key in a separate file.
2. **Same sentence set.** Use at least the 50 pronunciation cases + a random sample of 30 from the main corpus per engine session.
3. **Headphones required.** Phone speakers hide mispronunciation.
4. **Nepali-native listener preferred.** Mark listener native/desi/foreign in CSV — scores are not comparable across listener groups without this column.
5. **One pass = one engine.** Do not A/B mid-sentence; listen to full file per engine first, then compare.
6. **Never average before reviewing outliers.** Any score of 1 must have a written note.
7. **Gemini reference** (when available): listen first to calibrate "5 = native-like."
8. **No fake scores.** If audio failed to generate, leave the row blank or mark `NO_AUDIO` — never score a file that does not exist.

---

## Minimum viable eval (first session)

| Step | Action |
|---|---|
| 1 | Generate 50 pronunciation cases on Engine A (Fish) |
| 2 | Listen, fill CSV (pronunciation + naturalness only first) |
| 3 | Generate same 50 on Engine B (Gemini when quota, else kala CPU) |
| 4 | Blind re-listen, fill CSV |
| 5 | Compute per-category means → paste into `docs/ENGINE_COMPARISON.md` with VERIFIED labels |

---

## What this is NOT

- Not an automatic MOS bot score
- Not a substitute for the A/B/C engine comparison (that uses the same scales but compares engines side-by-side)
- Not a claim that any engine "wins" until at least one full session is completed and recorded here
