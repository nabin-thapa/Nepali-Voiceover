export type ToneCategory = 'auto' | 'informational' | 'storytelling' | 'conversational';

export interface VoiceArtist {
  id: string;
  name: string;
  nepaliName: string;
  gender: 'Female' | 'Male';
  character: string;
  bestFor: string;
  sampleQuote: string;
  isClone?: boolean;
}

export interface PronunciationFix {
  from: string;
  to: string;
}

export type LanguageHint = 'auto' | 'nepali' | 'english';
export type PronunciationMode = 'natural' | 'precise';

export interface PipelineStage {
  name: string;
  text: string;
}

export interface PronunciationDebug {
  original: string;
  normalized: string;
  pronunciationTransformed: string;
  fishInput: string;
  stages: PipelineStage[];
  engine?: string;
  referenceId?: string;
  dictionaryHits?: PronunciationFix[];
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
  appliedFixes?: PronunciationFix[];
  engine?: string;   // 'fish' | 'gemini'
  mode?: string;     // 'unlimited' | 'native'
  language?: LanguageHint;
  pronunciation?: PronunciationMode;
  debug?: PronunciationDebug;
  analysis?: {
    features?: {
      conjuncts?: string[];
      nasal?: boolean;
      aspirated?: string[];
      retroflex?: string[];
      longVowels?: string[];
      loanwordLatin?: string[];
      dandaEnds?: number;
      questionEnds?: number;
      exclamEnds?: number;
    };
    riskyWords?: string[];
    estimatedSyllables?: number;
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

export interface ClonedVoice {
  id: string;
  title: string;
  description: string;
  sampleCount: number;
  state: string;
  createdAt: string;
  hasTranscript?: boolean;
  language?: string;
}

export interface VoiceSample {
  id: string;
  name: string;
  dataUrl: string;
  text: string;
  durationSec: number;
}
