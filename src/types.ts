export type ToneCategory = 'auto' | 'informational' | 'storytelling' | 'conversational';

export interface VoiceArtist {
  id: string;
  name: string;
  nepaliName: string;
  gender: 'Female' | 'Male';
  character: string;
  bestFor: string;
  sampleQuote: string;
}

export interface GenerationResult {
  id: string;
  audioUrl: string;
  devanagariText: string;
  originalText: string;
  wasConvertedFromRomanized: boolean;
  tone: string;
  toneDescription: string;
  voiceName: string;
  speedWpm: number;
  durationSeconds: number;
  wordCount: number;
  directorNotes: string;
  phonetics: {
    aspirated: string[];
    retroflex: string[];
  };
  createdAt: string;
}

export interface ScriptSample {
  id: string;
  title: string;
  nepaliTitle: string;
  tone: ToneCategory;
  category: string;
  recommendedVoice: string;
  text: string;
  description: string;
}
