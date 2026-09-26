# Nepali Reference Recording Script (Kathmandu)

**Goal:** 10–15 minutes of clean, natural मानक नेपाली (Kathmandu) for Fish Audio multi-sample clone.  
**Use with:** Voice Cloner UI or `POST /api/voices/clone`, then `npx tsx scripts/dataset-validate.ts` if you keep a folder dataset.  
**Never** claim quality without listening to a probe generation after upload.

---

## Setup (must)

| Item | Requirement |
|---|---|
| Room | Curtains/carpet/quiet office; no AC/fan/TV/traffic |
| Mic | USB mic, headset, or phone on stable surface |
| Distance | ~one hand-width from mouth |
| Format | WAV preferred (16-bit, ≥16 kHz; 44.1 kHz ideal); MP3 OK for clone upload |
| Clip length | **15–30 s each**, 2–3 clips minimum (up to 20) |
| Total | Aim **30–90 s** total clean speech (better: 3–6 clips) |
| Speaker | **You only** — one voice, steady volume, natural emotion |
| Transcript | **Exact words in Devanagari** for every clip (copy-paste below) |
| Style | Conversational Kathmandu — not newsreader, not shouting |

**After each clip:** write the **exact** line you spoke into the transcript box. If you ad-lib, change the transcript to match.

---

## How to read

- Speak **as you would to a friend in Kathmandu** — not formal broadcast.
- Half-second pause between sentences.
- Clear aspirates (ख छ थ फ भ) without overacting.
- Chandrabindu ऐ / nasal ँ ं light — not swallowed, not French-nasal.
- Steady pace ~ normal conversation (not rushed).

---

## Clip A — Everyday conversation (anchor)

Read naturally:

> नमस्ते! म आज बिहान चिँडो खाएर घरबाट निस्किएँ। बाटोमा साथीभाइ भेटे, एकैचोटी हाँस्यौं। तपाईंको दिन कस्तो चलिरहेको छ? म त ठिकै छु, तर आज अलि व्यस्त छु। साँझमा चिया पिउने होइन? ल त, फेरि भेटौँला।

*Filename suggestion:* `01-kathmandu-everyday.wav`  
*Transcript box:* paste the same Devanagari paragraph exactly.

---

## Clip B — Difficult consonants (aspirates + retroflex)

Read carefully but naturally:

> खराब मौसममा छाना झिक्यो, फेरि पनि हामी छिट्टै तयार भयौं। ठूलो ठाउँमा डर लाग्यो तर ढाकाइयो। थकान छ, तर छोड्न मिल्दैन। फूल फुट्यो, भन्दै गर्दै अघि बढौँ। टाढाको टोलमा ठमेल ठूलो छ।

*Filename:* `02-aspirate-retroflex.wav`

---

## Clip C — Nasals (ँ / ं) + rural everyday

> हाम्रो गाउँमा धेरै गाई र भैंसी छन्। भैंसी नदीको किनारमा घाँस चरिरहेको छ। गाउँका मानिसहरू बिहानै खेत जान्छन्। आँखा झिलिमिली गर्यो, तर मुस्कुराएँ। गाउँ र घाँस राम्रो छ, मन पर्यो यो ठाउँ।

*Filename:* `03-nasal-rural.wav`

---

## Clip D — Conjuncts (ज्ञ क्ष त्र श्र)

> ज्ञान नै शक्ति हो। शिक्षा र पर्यावरण महत्त्वपूर्ण छ। क्षमा गर्नुहोला, त्रिशूल र श्रद्धा बारे कुरा गर्यौं। सृजनात्मक काम सधैं मन पर्छ। विद्यार्थीहरू परीक्षाको तयारी गरिरहेका छन्।

*Filename:* `04-conjuncts.wav`

---

## Clip E — Questions + everyday Kathmandu

> तपाईंको नाम के हो? कहाँबाट आउनुभयो? आज भोजनमा के बनाउने? के छ साथी! ल चिया पिउने हो? कसरी जाने त? किन यति ढिलो भयो? होइन, म त अब सुत्न लागेँ।

*Filename:* `05-questions.wav`

---

## Clip F — Numbers, dates, names (spoken form)

> दुई हजार छब्बीस साल असार महिनामा हामी काठमाडौं आएका थियौं। तेह्र मिति, एघार बजे भेट भयो। पचास प्रतिशत रकम तिरिसकेको छ। नाम हो नवीन, थर श्रेष्ठ। एक, दुई, तीन, चार, पाँच — गनिराख।

*Filename:* `06-numbers-dates.wav`

---

## Clip G — Long paragraph (stability / accent lock)

> आज भोरदेखि बादल छाएको छ, तर बरुको सम्भावना कम छ। हामी बिहानै तयार भएर बजार गयौं, तराइको बजारमा भीड धेरै थियो। फर्कँदा बाटोमा पुरानो साथी भेट्यो, एकै घण्टा कुराकानी गर्यौं। घर फर्केपछि चिया बनाएँ र केही बेर पनि पढ्न बसें। यसरी नै सामान्य दिन बित्छ, ठूलो केही हुँदैन, तर मन तृप्त हुन्छ।

*Filename:* `07-long-paragraph.wav`

---

## Clip H — Mixed loanwords spoken the Kathmandu way

(Write transcripts in Devanagari as below — no Latin in transcript box.)

> हाम्रो सफ्ट वेयर टिम आज अफिसमा भेट भयो। ल्यापटप खोलेर प्रजेक्ट देखायौं। इन्टरनेट अलि ढिलो भएकाले भिडियो हेर्न सकिएन। इमेल आएको छ, बिहानै जवाफ दिनुपर्छ। मोबाइलमा एप डाउनलोड गरे, तर लगइन गर्न केही समस्या भयो।

*Filename:* `08-loanwords-devanagari.wav`

---

## Optional Clip I — Emotional range (same speaker, one take)

> (Calm) आराम गर्नुहोला, सबै ठिकै छ।  
> (Slightly bright) वाह, यो त एकदमै राम्रो भयो!  
> (Serious) यो कुरा गम्भीर छ, ध्यान दिनुपर्छ।

*Filename:* `09-emotion-range.wav`  
Keep emotion **subtle** — clones amplify extremes poorly.

---

## Checklist before upload

- [ ] Only my voice, no music/TV/others  
- [ ] No clipping (not too loud), not whisper-quiet  
- [ ] Each clip 15–30 s (or one sentence set as above)  
- [ ] Transcript = **exact** words spoken, Devanagari only  
- [ ] Filenames match clip letter (A–I)  
- [ ] After clone: generate 3 probe sentences (easy + aspirate + nasal) and **listen**  
- [ ] If probe sounds off-accent: add more Clip A/C style natural speech, re-clone (never auto-train beyond clone API)

---

## Dataset folder layout (optional, for validator)

```
reference-dataset/
  metadata.jsonl
  wav/01-kathmandu-everyday.wav
  wav/02-aspirate-retroflex.wav
  ...
```

`metadata.jsonl` line example:

```json
{"audio":"wav/01-kathmandu-everyday.wav","text":"नमस्ते! म आज बिहान...","category":"A-everyday","duration":22}
```

Validate:

```bash
npx tsx scripts/dataset-validate.ts ./reference-dataset
```

---

## Category codes (A–J) for metadata

| Code | Focus |
|---|---|
| A | Everyday Kathmandu conversation |
| B | Aspirates (ख छ थ फ भ) |
| C | Retroflex (ट ठ ड ढ ण) |
| D | Nasals (ँ ं) |
| E | Conjuncts (ज्ञ क्ष त्र श्र) |
| F | Questions / intonation |
| G | Numbers, dates, proper names |
| H | Long continuous paragraph |
| I | Loanwords in Devanagari |
| J | Subtle emotion / pace range |

**Do not** record non-Nepali content, music, or Latin-only transcripts.
