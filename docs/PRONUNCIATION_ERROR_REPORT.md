# Pronunciation Error Report (human listen template)

**Rule:** Generation success ≠ correct pronunciation. Fill this only after **listening**.  
One row per problem word/phrase (or mark whole sentence `correct`).

---

## Meta

| Field | Value |
|---|---|
| Date | |
| Listener | |
| Sentence ID | e.g. `ktm-02` |
| Engine | `fish` \| `gemini` \| `alternative` |
| Voice / clone id | |
| Fish input (debug.fishInput) | |
| Audio path | `benchmark/comparison/fish/<id>/…` |

---

## Error rows

| # | Span (heard word) | Expected (Kathmandu) | Error type | Likely cause | Severity 1–5 | Notes |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

### Error type (pick one)

| Code | Meaning |
|---|---|
| `correct` | Sounds right |
| `wrong-vowel` | Wrong vowel quality/length (e.g. ए vs ऐ) |
| `wrong-consonant` | Wrong consonant (e.g. श vs ष, ट vs त) |
| `wrong-syllable` | Syllable split/join wrong |
| `wrong-boundary` | Word/phrase boundary wrong (merged/split) |
| `wrong-stress` | Stress on wrong syllable |
| `wrong-pause` | Missing/extra pause at punctuation |
| `missing` | Word/syllable dropped |
| `added` | Extra sound/word inserted |
| `other` | Describe in notes |

### Likely cause (pick one)

| Code | Meaning |
|---|---|
| `A-preprocess` | Our Devanagari rewrite/lexicon caused it |
| `B-representation` | Format/orthography not what model expects |
| `C-reference` | Clone/reference conditioning weak or off-accent |
| `D-fish-model` | Opaque Fish s2.1-pro-free Nepali path (no text fix will help) |
| `E-prosody` | Speed/chunk/prosody knobs |
| `unknown` | Cannot attribute yet |

**Severity:** 1 = barely noticeable · 3 = clear mispronunciation · 5 = unintelligible / wrong language feel

---

## Sentence verdict

- [ ] **Accept** — ship-quality for this sentence  
- [ ] **Retry** — change text prep / sampling / reference and re-generate  
- [ ] **Block** — needs better reference audio or different engine (CASE D)

---

## Aggregate (after many sentences)

| Metric | Count |
|---|---|
| Sentences accept | |
| Top error types | |
| Top cause (A–D) | |
| Share of `D-fish-model` | % |

If **`D-fish-model` dominates**, text patching will not close the gap — see `docs/DECISION_REPORT.md`.

---

## Machine-friendly JSON schema (optional)

```json
{
  "id": "ktm-02",
  "engine": "fish",
  "voice": "bee6e30d95e3443b83b9890deec5dc80",
  "verdict": "retry",
  "errors": [
    {
      "span": "भैंसी",
      "expected": "भैँसी",
      "type": "wrong-vowel",
      "cause": "A-preprocess",
      "severity": 3,
      "notes": "anusvara/chandrabindu not nasalized"
    }
  ]
}
```

Save under: `benchmark/comparison/fish/<id>/errors.json` (or gemini/).
