# Nepali Recording Standard

Date: 2026-09-24
Status: **STANDARD — to be followed by human recorders (VERIFIED constraints; no recordings yet)**

Use with: `docs/NEPALI_REFERENCE_RECORDING_SCRIPT.md` (sentence lists), `docs/NEPALI_DATASET_PLAN.md` (layout), `npm run dataset:validate` (gate).

## Environment

| Item | Requirement |
|---|---|
| Room | Quiet; no fan/AC hum if possible; no street noise |
| Mic | External USB/phone lav preferred; phone mic acceptable if close |
| Distance | 10–20 cm from mouth |
| Gain | Peaks around −12 to −6 dBFS; **never clip** |
| Sample rate | 44.1 kHz or 48 kHz |
| Format | WAV PCM 16-bit mono (validator-friendly) |
| Processing | **No** reverb, EQ, denoise that artifacts, compression, or noise gates |

## Speaker

| Item | Requirement |
|---|---|
| Language | Nepali native or near-native; Kathmandu standard unless dialect study |
| Health | No cold/cough sessions; re-record if hoarse |
| Pace | Natural conversational → slightly slower for clarity |
| Emotion | Neutral unless category J/Y asks otherwise |
| Continuity | Same session/same room for a category batch |

## Take rules

1. **3 takes** per sentence minimum; keep the cleanest.
2. One sentence per file (easy validator mapping).
3. 0.5–1.0 s silence head/tail; no abrupt cut mid-word.
4. Retake if: clip, pop, page turn, siren, false start, wrong word.
5. File naming: `NNN.wav` zero-padded, matches metadata.jsonl `audio` field.
6. Text in metadata **exact Devanagari** of what was spoken (including punctuation style you chose — be consistent).

## Metadata

```json
{"audio":"wav/001.wav","text":"...","duration":4.1,"category":"A-everyday","speaker":"spk01","take":1,"recordedAt":"2026-09-24"}
```

`duration` optional (validator can recompute); `category` required A–J.

## Consistency checklist before handoff

- [ ] Same mic + distance for whole batch
- [ ] No clipping (validator `clipped=false`)
- [ ] Silence fraction OK
- [ ] Every wav referenced in metadata.jsonl
- [ ] No extra wavs without metadata
- [ ] Devanagari only in `text` (or documented loanword policy)
- [ ] `npm run dataset:validate -- ./batch` PASS

## Reference voice (clone path)

For Fish/Chatterbox **clone** references (not full training sets):

- 5–10 s clean prompt OR multi-ref set per existing `docs/NEPALI_REFERENCE_RECORDING_SCRIPT.md`
- Same voice identity across all refs
- Nepali phoneme-rich prompt preferred (includes ज्ञ, क्ष, ट/त, nasals)

## Never

- Do not scrape others' voices
- Do not use TTS output as training ground truth without labeling it synthetic
- Do not train on unvalidated folders
