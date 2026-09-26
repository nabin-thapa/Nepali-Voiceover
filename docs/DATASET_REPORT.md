# Dataset Report

Generated: (initial — no dataset folder validated yet)
Evidence: **NOT YET TESTED** — machine report appears here after the first `npm run dataset:validate -- ./<folder>` run.

## How to generate

```bash
npm run dataset:validate -- ./my-dataset
# writes:
#   my-dataset/DATASET_REPORT.json
#   docs/DATASET_REPORT.md   (this file is overwritten with the real summary)
```

## Expected layout

```
my-dataset/
  metadata.jsonl
  wav/001.wav
```

metadata line example:

```json
{"audio":"wav/001.wav","text":"नेपाली वाक्य...","duration":3.2,"category":"A-everyday","speaker":"spk01"}
```

## Gates

| Gate | Meaning |
|---|---|
| `trainable` | errors = 0 and ≥ 10 OK samples |
| `cloneReady` | errors = 0 and ≥ 2 OK samples |

**Never auto-train.** See `docs/NEPALI_TTS_TRAINING_PLAN.md`.

## Related

- `docs/NEPALI_DATASET_PLAN.md`
- `docs/NEPALI_RECORDING_STANDARD.md`
- `docs/NEPALI_REFERENCE_RECORDING_SCRIPT.md`
- `scripts/dataset-validate.ts`
