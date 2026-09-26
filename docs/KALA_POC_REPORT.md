# Kala Local TTS PoC Report

Date: 2026-09-24  
Status: **Installation SUCCESS · Local inference SUCCESS · 30/30 real WAV files on disk**  
Evidence labels: **VERIFIED** (file + RIFF/WAVE parsed) · **CLAIMED** (vendor) · **NOT YET TESTED** (human listening)

Related: `docs/TTS_MODEL_SELECTION.md`, `docs/NEPALI_TTS_MODEL_DECISION.md`, `docs/NEPALI_HUMAN_EVALUATION.md`.

**Explicit non-claims:** No quality ranking vs Fish/Gemini. No training. No MOS/CER scores. Audio is **VERIFIED generated locally** only because real playable WAV bytes exist on disk — not because an API returned 200.

---

## 1. Installation requirements

| Requirement | Value | Evidence |
|---|---|---|
| Python | **≥ 3.10** | VERIFIED (PyPI `Requires: Python >=3.10`) |
| Found on this machine | **Python 3.10.11** (`…\Python310\python.exe`) | VERIFIED |
| Package | **`kala-tts` 0.1.4** | VERIFIED (pip) |
| Dependencies pulled | `onnxruntime>=1.17`, `numpy>=1.24`, `huggingface_hub>=0.23` (+ transitive) | VERIFIED (pip log) |
| GPU | **Not required** (CPU ONNX) | VERIFIED (package design) / CLAIMED 50× RT |
| Extra system changes | None beyond pip user packages + HF model cache | VERIFIED |

---

## 2. Exact model / repository used

| Field | Value | Evidence |
|---|---|---|
| Package | `kala-tts` (import `kala_tts`) | VERIFIED PyPI |
| Model repo | **`huggingface.co/ampixa/real-nepali-v0.2-kala`** | VERIFIED (auto-download on first `synthesize`) |
| Artifact | `real_nepali_v02_kala.fp32.onnx` | VERIFIED (HF tree + local cache) |
| ONNX size | **77,746,361 bytes (~74.1 MiB / ~78 MB)** | VERIFIED local file |
| Snapshot | `90a66e8…` | VERIFIED cache path |
| Architecture | VITS ONNX FP32 (Piper-compatible) | VERIFIED model card |
| Speakers | `kala`, `barsha`, `slr143_F`, `slr43_0546`, `slr43_2099` | VERIFIED `kala_tts.list_speakers()` |
| Default speaker | **`kala`** | VERIFIED model card recommendation |
| Newer experimental | `ampixa/kalaTTS` (v0.4 punctuation) — **not used** (card says review before production) | VERIFIED card caveat |

**Not outdated/unavailable.** Official path still matches docs: `pip install kala-tts` + first-call HF download.

---

## 3. License

| Layer | License | Evidence |
|---|---|---|
| Python package code | **MIT** | VERIFIED PyPI |
| Model weights | **CC-BY-SA-4.0** | VERIFIED HF model card |
| Training data / G2P seed notes | CC-BY-SA-4.0 (weights/data); G2P seed CC-BY-4.0 (prior research) | VERIFIED / prior research |
| Commercial | Allowed with **share-alike** on weight derivatives; keep attribution | ASSUMED from license text — legal review still advised |

---

## 4. Hardware requirements

| Item | Official / observed | Evidence |
|---|---|---|
| GPU | None | VERIFIED design |
| CPU (observed host) | **AMD Ryzen 5 5500U** (laptop) | VERIFIED Win32_Processor |
| RAM (observed) | **~5.9 GB total physical** (below our Tier 1 target of 16 GB) | VERIFIED Win32_ComputerSystem |
| Disk | Package <1 MB wheel + onnxruntime ~14 MB + **~78 MB ONNX** cache | VERIFIED |
| Vendor RTF claim | ~0.020 (50× RT) | **CLAIMED** (Ampixa) — not independently measured as pure RTF here |

---

## 5. Installation steps (executed)

```powershell
# 1) Package (done)
python -m pip install kala-tts
# → kala-tts-0.1.4, onnxruntime-1.23.2 installed on Python 3.10.11

# 2) First synthesis pulls model once (~78 MB) into HF cache
python -c "import kala_tts; kala_tts.synthesize('नमस्ते', speaker='kala')"

# 3) Wire (done in app)
#    src/engines/kalaEngine.ts replaces stub for id "kala" only
#    FishEngine + GeminiEngine untouched

# 4) Experiment
npm run benchmark:kala
```

**Download size before first run:** ~78 MB ONNX (small; already completed). No large multi-GB weights were required.

---

## 6. Inference method

| Path | How |
|---|---|
| Library API | `kala_tts.synthesize(text, speaker="kala") -> bytes` (16-bit PCM mono **22050 Hz** WAV) |
| File API | `kala_tts.synthesize_to_file(...)` |
| CLI | `kala-tts "नमस्कार" --speaker kala -o out.wav` |
| App adapter | `KalaEngine.synthesize` spawns `python -c` with UTF-8 stdin/stdout (Windows-safe) |
| App parse | Node RIFF/WAVE header parse → sampleRate, duration; **evidence=VERIFIED** only if playable WAV |
| Research API | `POST /api/research/synthesize` `{ text, engineId: "kala" }` → `audio/wav` |
| Batch experiment | `npm run benchmark:kala` → 30 items → `benchmark/out-nepali/kala/` |

Default representation: engine accepts raw/normalized Devanagari (own G2P inside package). Pipeline does **not** force IPA.

---

## 7. Thirty-sentence test results

**Test set (exactly 30):**

| Group | Count | Source | IDs |
|---|---|---|---|
| Normal Nepali | 10 | corpus cat A | A-01…A-10 |
| Difficult pronunciation | 10 | `pronunciation_cases.json` top difficulty=5 | PC-004,005,006,008,015,018,023,024,036,050 |
| Numbers / time | 5 | corpus cat G | G-01…G-05 |
| Nepali–English mixed | 5 | corpus cat S | S-01…S-05 |

**Aggregate (`benchmark/out-nepali/kala/_summary.json`):**

| Metric | Value |
|---|---|
| Installation | **SUCCESS** |
| Local inference | **SUCCESS** |
| Planned | 30 |
| **WAV generated** | **30** |
| Failed | **0** |
| RIFF/WAVE verified on disk | **30 / 30** |
| By group | normal 10, pronunciation 10, number_date 5, mixed 5 |
| Total generation wall time | **176,503 ms (~176.5 s)** |
| Mean per-utterance latency | **5,880 ms** (includes Python spawn + ONNX session load each call) |
| Min / median / max latency | **3,748 / ~5,976 / 8,365 ms** |
| Total audio duration | **68.396 s** |
| Sample rate | **22050 Hz** (all) |
| Channels / format | mono / 16-bit PCM WAV |
| Output root | `benchmark/out-nepali/kala/` |
| Training | **false** (none) |

Per-item JSON: `benchmark/out-nepali/kala/<id>.json` with engine, sentence ID, text, generationTimeMs, success, outputPath, sampleRate, durationSec, localAudio, playableWav, evidence.

**Evidence rule applied:** `evidence: "VERIFIED"` only when Python wrote non-empty WAV bytes **and** Node parsed RIFF/WAVE **and** duration > 10 ms **and** file exists on disk. HTTP 200 alone is never enough.

---

## 8. Failed cases

| Item | Result |
|---|---|
| Benchmark 30 items | **0 failures** |
| First API smoke via PowerShell `ConvertTo-Json` without UTF-8 body | Client produced **mangled/empty text** → 0.07 s / 3,116-byte near-silence — **not an engine defect**; fixed by sending raw UTF-8 JSON bytes (`charset=utf-8`) → full ~2.1–2.4 s WAVs |
| Fish `/api/tts/generate` | Still **HTTP 200** (main app flow intact) |
| indic_parler / chatterbox / alternative | Still stubs (unchanged) |

---

## 9. Generation speed

| Measure | Value | Notes |
|---|---|---|
| Mean wall latency (benchmark) | **5.88 s / sentence** | Process-per-call: Python start + model load + synth |
| Warm pure synth (smoke, model already cached) | **~0.36 s** for ~2.58 s audio | CLAIMED from local smoke timing — RTF ≪ 1 |
| 30-item total | **176.5 s** | Suitable for PoC; not a production latency figure |
| Speedup path (future) | Persistent Python worker or reuse ONNX session | Not implemented in this step |

Vendor **50× RT** remains **CLAIMED**; our end-to-end adapter latency is dominated by process overhead, not model RTF.

---

## 10. Audio format

| Property | Value |
|---|---|
| Container | WAV (RIFF/WAVE) |
| Encoding | PCM signed 16-bit |
| Sample rate | **22050 Hz** |
| Channels | **1 (mono)** |
| Total bytes (30 files) | **3,017,584** |
| Individual range | ~72 KB – 152 KB (length-dependent) |
| Playability | Headers valid; **human playback not yet scored** |

---

## 11. CPU / GPU usage

| Item | Observation |
|---|---|
| Device | **CPU only** (ONNX Runtime CPU EP) |
| GPU used | **No** |
| Host CPU | AMD Ryzen 5 5500U |
| Host RAM | ~5.9 GB (tight vs Tier 1 guidance of 16 GB; still completed) |
| Detailed %CPU / per-process counters | **NOT LOGGED** (UNKNOWN / NOT VERIFIED for this run) |

---

## 12. Known limitations

1. **No zero-shot clone** — fixed 5 speaker names only.  
2. **Quality not human-tested** — no rows in `docs/ENGINE_COMPARISON.md` yet.  
3. **CC-BY-SA-4.0 weights** — share-alike obligations if we redistribute derivatives.  
4. **Not compared to Fish/Gemini** by any metric that implies “better/worse.”  
5. **Per-call Python spawn** → multi-second adapter latency (model RTF is much better).  
6. **Latin code-switch** (cat S) uses Kala’s letter/lexicon rules — intelligibility unknown until listening.  
7. **v0.4 / kalaTTS punctuation model** intentionally not switched to (experimental).  
8. **RAM pressure** on this 5.9 GB machine may affect concurrent jobs.  
9. Research endpoint depends on `runNepaliNormalize` (Fish/Gemini-oriented light cleanup) — text passed through is near-raw Devanagari; Kala has its own G2P.

---

## 13. What still needs human listening evaluation

Per `docs/NEPALI_HUMAN_EVALUATION.md` and `docs/ENGINE_COMPARISON.md`:

1. Open WAVs in `benchmark/out-nepali/kala/` with headphones.  
2. Score **pronunciation** on all 10 PC-* items (difficulty 5) — aspirates, conjuncts, retroflex.  
3. Score **naturalness / rhythm** on A-01…A-10.  
4. Check **time expressions** G-01…G-05 and **English tokens** S-01…S-05.  
5. Side-by-side same IDs with Fish (and Gemini when quota) — **after** listening only.  
6. Fill `ENGINE_COMPARISON.md` with **VERIFIED (listened)** — leave quality columns empty until then.  
7. **Do not** paste Ampixa MOS/NepTTS-Bench numbers as if we measured them.

---

## 14. Command added

```json
"benchmark:kala": "tsx scripts/benchmark-kala.ts"
```

```powershell
npm run benchmark:kala
# optional: npm run benchmark:kala -- --speaker=barsha
```

Outputs: `benchmark/out-nepali/kala/*.wav`, `*.json`, `_results.json`, `_summary.json`.

---

## 15. Concise end report

| Field | Result |
|---|---|
| **Installation** | **SUCCESS** (`kala-tts` 0.1.4, Python 3.10.11, ONNX ~78 MB cached) |
| **Local inference** | **SUCCESS** (30/30 RIFF-valid WAVs, 22050 Hz mono) |
| **WAV files generated** | **30** (+ research API UTF-8 path re-verified) |
| **Total generation time** | **176,503 ms** for 30 sentences (mean 5,880 ms; warm pure synth ~0.36 s) |
| **Fish / Gemini** | Untouched; Fish main `POST /api/tts/generate` still **HTTP 200** |
| **Training** | **None** |
| **Exact next recommended experiment** | **Human listening session** on the 30 WAVs (`docs/NEPALI_HUMAN_EVALUATION.md`) → fill `ENGINE_COMPARISON.md` rows for kala vs fish; then optional `npm run benchmark:compare -- --engines=fish,kala --use=cases --limit=50` for same-ID Fish baselines. Do **not** train or download Indic Parler until after listening gate. |

### Reproduce

```powershell
npm run system:check
npm run benchmark:kala
npm run lint
```

Server: http://localhost:3000 — research endpoints unchanged:  
`GET /api/research/engines` · `GET /api/research/corpus` · `GET /api/research/pronunciation-cases` · `POST /api/research/synthesize`.
