# Nepali TTS Architecture

Date: 2026-09-24
Status: **VERIFIED (structure + live research endpoints on 2026-09-24: GET engines/corpus OK, fish synthesize → audio/wav 200, stub → 503)**

## Principle

**Nepali Text → Normalizer → Pronunciation Representation → TTS Engine**

Each engine decides which representation it accepts. The pipeline never forces IPA into an unsupported engine.

```
                    ┌──────────────────────┐
  raw Devanagari ──►│ runNepaliNormalize   │
                    │ (nepaliNormalize.ts) │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ Pronunciation layer  │
                    │ nepaliPronounce.ts   │
                    │ (optional per engine)│
                    └──────────┬───────────┘
                               │
              representation chosen by ENGINE, not pipeline
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   TTSEngine: fish        TTSEngine: gemini      TTSEngine: *local*
   accepts: raw/          accepts: raw/          accepts: raw/normalized/
   normalized/            normalized             (Parler may want
   orthographic                                caption style hint)
```

## Engine selection

| Env / config | Engine id | Backend |
|---|---|---|
| `TTS_ENGINE=fish` (default) | `fish` | Fish cloud `s2.1-pro-free` |
| `TTS_ENGINE=gemini` | `gemini` | Gemini TTS `ne-NP` stock voices |
| `TTS_ENGINE=local_model` or `indic_parler` | `indic_parler` | Indic Parler-TTS (stub until wired) |
| `TTS_ENGINE=kala` | `kala` | **kala-tts real-nepali (WIRED local CPU — see `docs/KALA_POC_REPORT.md`)** |
| `TTS_ENGINE=chatterbox` | `chatterbox_nepali` | Chatterbox-Nepali FT (stub until wired) |
| `TTS_ENGINE=alternative` | `alternative` | Config-defined alternative |

Also: `config/tts-engines.json` remains the Phase 12 modular config for the existing generate path — research registry reads env first and does not break it.

## Code map

| Piece | Path | Role |
|---|---|---|
| TTSEngine interface | `src/engines/types.ts` | Contract: isAvailable / listVoices / synthesize |
| Fish adapter | `src/engines/fishEngine.ts` | Wraps existing Fish cloud call |
| Gemini adapter | `src/engines/geminiEngine.ts` | ne-NP reference; never clones identity |
| Local stubs | `src/engines/localStubEngine.ts` | Clearly marked; `isStub=true`, never fake WAV |
| Registry | `src/engines/registry.ts` | `TTS_ENGINE` resolution |
| Research API | `server.ts` `/api/research/*` | List engines, corpus, synthesize |
| Existing API | `server.ts` `/api/tts/generate` etc. | **Unchanged** |

## Research endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/research/engines` | Engine availability + selection |
| GET | `/api/research/corpus` | 316-sentence corpus + 50 cases |
| POST | `/api/research/synthesize` | Research-mode synthesis via TTSEngine |
| GET | `/api/research/pronunciation-cases` | Difficulty cases only |

## Rules

1. Existing `/api/tts/*` and `/api/voices/*` behavior is preserved.
2. Stubs return HTTP 503 with `unavailable` — never silent success.
3. Gemini 429/503 → mark unavailable, do not substitute fake audio.
4. Evidence labels on every synthesis result: `VERIFIED` | `EXPERIMENTAL` | `NOT_YET_TESTED`.
