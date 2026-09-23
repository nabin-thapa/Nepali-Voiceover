import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Gemini API Native TTS Voices — these are the ONLY voices used in this project
const GEMINI_VOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir"];

/**
 * Converts raw 16-bit linear PCM (L16, mono, 24kHz default) into a valid WAV file buffer.
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const header = Buffer.alloc(44);
  const bytesPerSample = 2; // 16-bit = 2 bytes
  const byteRate = sampleRate * numChannels * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = pcmBuffer.length;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20); // AudioFormat: 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // BitsPerSample: 16
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Check if text contains significant Latin/Roman alphabet letters (indicating Romanized Nepali).
 */
function isRomanizedText(text: string): boolean {
  const latinMatches = text.match(/[a-zA-Z]/g);
  const devanagariMatches = text.match(/[\u0900-\u097F]/g);

  const latinCount = latinMatches ? latinMatches.length : 0;
  const devanagariCount = devanagariMatches ? devanagariMatches.length : 0;

  return latinCount > 0 && latinCount >= devanagariCount * 0.4;
}

/**
 * Robust retry helper for Gemini API calls to handle temporary demand spikes.
 */
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 1500): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        err?.status === 503 ||
        err?.status === 429 ||
        err?.message?.includes("high demand") ||
        err?.message?.includes("UNAVAILABLE") ||
        err?.message?.includes("RESOURCE_EXHAUSTED") ||
        err?.message?.includes("fetch failed");

      if (!isRetryable || attempt === maxRetries - 1) {
        throw err;
      }
      console.warn(`Gemini API retry ${attempt + 1}/${maxRetries} after error: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * Generate audio using Gemini Native TTS API.
 * Returns a base64 WAV data URL.
 */
async function generateGeminiTTS(text: string, voiceName: string): Promise<string> {
  // Validate voice name
  const voice = GEMINI_VOICES.includes(voiceName) ? voiceName : "Kore";

  const ttsResponse = await callWithRetry(async () => {
    return await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    });
  });

  const audioData = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!audioData?.data) {
    throw new Error("No audio data returned from Gemini TTS API.");
  }

  const pcmBuffer = Buffer.from(audioData.data, "base64");
  const wavBuffer = pcmToWav(pcmBuffer);
  const base64Wav = wavBuffer.toString("base64");
  return `data:audio/wav;base64,${base64Wav}`;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Voice Preview endpoint — uses Gemini Native TTS API.
 */
app.post("/api/tts/preview", async (req, res) => {
  try {
    const { voiceName = "Kore", sampleText } = req.body;

    const VOICE_SAMPLES: Record<string, string> = {
      Kore:   "नमस्ते, म सुमिना। स्पष्ट र मानक नेपाली उच्चारण मेरो विशेषता हो।",
      Puck:   "के छ साथी! ऊर्जाशील र रमाइलो कुराकानी मेरो शैली हो।",
      Charon: "नमस्कार। इतिहास र प्रेरणाका कथाहरू मेरो स्वरमा जीवन्त बन्दछन्।",
      Aoede:  "नमस्ते! कथा, कविता र भावनात्मक अभिव्यक्ति मेरो माध्यम हो।",
      Fenrir: "नमस्ते साथीहरू! उत्साही र प्राकृतिक बोलचालमा म विशेष हुँ।",
    };

    const text = sampleText || VOICE_SAMPLES[voiceName] || "नमस्ते, यो एक परीक्षण आवाज हो।";
    const audioUrl = await generateGeminiTTS(text, voiceName);

    res.json({ success: true, audioUrl, voiceName, text });
  } catch (error: any) {
    console.error("Error generating voice preview:", error);
    res.status(500).json({ error: error.message || "Failed to generate preview." });
  }
});

/**
 * AI Script Generator endpoint
 */
app.post("/api/tts/generate-script", async (req, res) => {
  try {
    const { description, durationSeconds = 30, tone = "auto" } = req.body;
    
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return res.status(400).json({ error: "कृपया वर्णन प्रविष्ट गर्नुहोस् (Please provide a description)." });
    }

    const scriptPrompt = `You are an expert native Nepali Scriptwriter (काठमाडौँ/मानक नेपाली).
Write a Nepali voiceover script based on this description:
"${description}"

Constraints:
1. Target duration: ~${durationSeconds} seconds. Normal speaking rate is ~2.5 words per second. So aim for about ${Math.floor(durationSeconds * 2.5)} words.
2. Tone: ${tone !== "auto" ? tone : "engaging and natural"}.
3. Script must be entirely in Nepali Devanagari script (no English/Romanized text).
4. Provide ONLY the final spoken script text, no intro/outro conversational text, no stage directions, no quotes around it. Just the exact text to be read by the voiceover artist.`;

    const scriptResponse = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: scriptPrompt,
      });
    });

    const scriptText = scriptResponse.text?.trim() || "";
    res.json({ script: scriptText });
  } catch (error: any) {
    console.error("Error generating Nepali script:", error);
    res.status(500).json({ error: "Failed to generate script." });
  }
});

/**
 * Voiceover Studio generation endpoint — uses Gemini Native TTS API exclusively.
 */
app.post("/api/tts/generate", async (req, res) => {
  try {
    const {
      text,
      tone = "auto",
      voiceName = "Kore",
      speedWpm = 140,
    } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "कृपया पाठ प्रविष्ट गर्नुहोस् (Please provide text to speak)." });
    }

    const rawInput = text.trim();
    const hasRomanized = isRomanizedText(rawInput);

    let devanagariText = rawInput;
    let detectedTone = tone;
    let toneDescription = "";
    let directorNotes = "";

    // Step 1: Script & Vocal Director analysis
    if (hasRomanized || tone === "auto" || rawInput.includes(".")) {
      const directorPrompt = `You are an expert native Nepali Voiceover Artist and Text-to-Speech (TTS) Director (काठमाडौँ/मानक नेपाली).
Analyze the following text input:
"${rawInput}"

Task:
1. Script Handling: If Romanized Nepali (Nagari in Latin alphabet) is provided, silently convert it to natural, standard, authentic Devanagari script. If already in Devanagari, preserve the text exactly while ensuring standardized Nepali orthography and proper punctuation for speech rhythm (commas ',' for breath pauses, Nepali danda '।' or question mark '?' for sentence cadences).
2. Tone Adaptation: Categorize the tone as one of:
   - "informational" (Informational / Tech / AI: Clear, confident, engaging, and professional)
   - "storytelling" (Storytelling / Motivation: Warm, expressive, empathetic, and inspiring)
   - "conversational" (Conversational / Social Media: Energetic, friendly, and natural)
   ${tone !== "auto" ? `The user requested '${tone}', so prioritize and tailor for '${tone}'.` : ""}
3. Director Notes: Provide a 1-2 sentence director guide on vocal modulation, rhythm, and emotional emphasis.

Respond ONLY with valid JSON in this exact structure:
{
  "devanagariText": "Devanagari text here with proper punctuation",
  "detectedTone": "informational" | "storytelling" | "conversational",
  "toneDescription": "Brief description of the vocal delivery",
  "directorNotes": "Directing notes regarding cadence, pauses, and expression",
  "hasAspiratedOrRetroflex": true
}`;

      try {
        const analysisResponse = await callWithRetry(async () => {
          return await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: directorPrompt,
            config: {
              responseMimeType: "application/json",
            },
          });
        });

        const jsonText = analysisResponse.text || "{}";
        const parsed = JSON.parse(jsonText);
        if (parsed.devanagariText) {
          devanagariText = parsed.devanagariText.trim();
        }
        if (tone === "auto" && parsed.detectedTone) {
          detectedTone = parsed.detectedTone;
        }
        toneDescription = parsed.toneDescription || "";
        directorNotes = parsed.directorNotes || "";
      } catch (err: any) {
        console.warn("Script analysis step fallback:", err.message);
        devanagariText = rawInput.replace(/\./g, "।");
      }
    } else {
      devanagariText = devanagariText.replace(/\./g, "।");
    }

    if (detectedTone === "auto") {
      detectedTone = "conversational";
    }

    // Set voice instruction prefix for TTS
    let stylePrefix = "";
    if (detectedTone === "informational") {
      stylePrefix =
        "Say clearly, confidently, and professionally in standard Nepali (काठमाडौँ मानक उच्चारण) with engaging tech narration pacing and distinct articulation:";
      if (!toneDescription) {
        toneDescription = "जानकारीमूलक र व्यावसायिक (Clear, confident, engaging, and professional)";
      }
    } else if (detectedTone === "storytelling") {
      stylePrefix =
        "Say warmly, expressively, and inspiringly in native Nepali with empathetic human storytelling cadence and gentle breath pauses:";
      if (!toneDescription) {
        toneDescription = "कथा र प्रेरणादायी (Warm, expressive, empathetic, and inspiring)";
      }
    } else {
      stylePrefix =
        "Say energetically, friendly, and naturally in conversational Kathmandu Nepali as in an authentic modern broadcast:";
      if (!toneDescription) {
        toneDescription = "कुराकानी र सामाजिक सञ्जाल (Energetic, friendly, and natural)";
      }
    }

    // Step 2: Generate audio using Gemini Native TTS
    const ttsInput = `${stylePrefix} ${devanagariText}`;
    const audioDataUrl = await generateGeminiTTS(ttsInput, voiceName);

    // Approximate duration: ~150 WPM -> ~2.5 words per second
    const words = devanagariText.split(/\s+/).filter(Boolean).length;
    const durationSeconds = Number((words / 2.5).toFixed(2)) || 3;

    // Identify aspirated & retroflex consonants
    const aspiratedLetters = ["ख", "घ", "छ", "झ", "थ", "ध", "फ", "भ"];
    const retroflexLetters = ["ट", "ठ", "ड", "ढ", "ण"];

    const foundAspirated = Array.from(new Set(aspiratedLetters.filter((char) => devanagariText.includes(char))));
    const foundRetroflex = Array.from(new Set(retroflexLetters.filter((char) => devanagariText.includes(char))));
    const wordCount = devanagariText.split(/\s+/).filter(Boolean).length;

    res.json({
      success: true,
      audioUrl: audioDataUrl,
      devanagariText,
      originalText: rawInput,
      wasConvertedFromRomanized: hasRomanized,
      tone: detectedTone,
      toneDescription,
      voiceName,
      speedWpm,
      durationSeconds,
      wordCount,
      directorNotes:
        directorNotes ||
        "मानक काठमाडौँ उच्चारण, स्वभाविक लय र सुस्पष्ट ध्वनि सम्पादन।",
      phonetics: {
        aspirated: foundAspirated,
        retroflex: foundRetroflex,
      },
    });
  } catch (error: any) {
    console.error("Error generating Nepali TTS:", error);
    res.status(500).json({
      error: error.message || "Failed to generate audio. Please check your text and try again.",
    });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Server
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nepali Voiceover Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
