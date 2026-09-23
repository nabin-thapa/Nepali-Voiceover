import { ScriptSample, VoiceArtist } from '../types';

export const VOICE_ARTISTS: VoiceArtist[] = [
  { id: 'Kore',   nepaliName: 'सुमिना', name: 'Kore',   gender: 'Female', character: 'मानक काठमाडौँ, स्पष्ट र आत्मीय',         bestFor: 'सूचनामूलक, प्रविधि, शिक्षा',         sampleQuote: 'नमस्ते, म सुमिना। स्पष्ट र मानक नेपाली उच्चारण मेरो विशेषता हो।' },
  { id: 'Puck',   nepaliName: 'सन्तोष', name: 'Puck',   gender: 'Male',   character: 'ऊर्जाशील, रमाइलो र युवा',              bestFor: 'सोशल मिडिया, भ्लग, रिल्स',             sampleQuote: 'के छ साथी! ऊर्जाशील र रमाइलो कुराकानी मेरो शैली हो।' },
  { id: 'Charon', nepaliName: 'प्रकाश', name: 'Charon', gender: 'Male',   character: 'गहिरो, गम्भीर र प्रभावशाली',           bestFor: 'समाचार, डकुमेन्ट्री, औपचारिक',          sampleQuote: 'नमस्कार। इतिहास र प्रेरणाका कथाहरू मेरो स्वरमा जीवन्त बन्दछन्।' },
  { id: 'Aoede',  nepaliName: 'अनिता',  name: 'Aoede',  gender: 'Female', character: 'भावुक, अभिव्यक्तिपूर्ण र कथामूलक',      bestFor: 'कथा, कविता, भावनात्मक',                sampleQuote: 'नमस्ते! कथा, कविता र भावनात्मक अभिव्यक्ति मेरो माध्यम हो।' },
  { id: 'Fenrir', nepaliName: 'राजेश',  name: 'Fenrir', gender: 'Male',   character: 'उत्साही, प्राकृतिक र बोलचालको',         bestFor: 'विज्ञापन, प्रचार, आकर्षक',               sampleQuote: 'नमस्ते साथीहरू! उत्साही र प्राकृतिक बोलचालमा म विशेष हुँ।' },
];

export const SCRIPT_SAMPLES: ScriptSample[] = [
  {
    id: 'tech-ai',
    title: 'AI & Future Technology',
    nepaliTitle: 'प्रविधि र कृत्रिम बौद्धिकता',
    tone: 'informational',
    category: 'Informational / Tech / AI',
    recommendedVoice: 'Kore',
    text: 'कृत्रिम बौद्धिकता अर्थात् एआईले आजको मानव जीवन र कार्यशैलीलाई द्रुत गतिमा रूपान्तरण गरिरहेको छ। स्वास्थ्य, शिक्षा र उद्योग क्षेत्रमा यसको प्रयोगले नयाँ अवसरहरू सिर्जना गर्दै उत्पादकत्वमा ऐतिहासिक वृद्धि ल्याएको छ।',
    description: 'स्पष्ट, आत्मविश्वासी र व्यावसायिक प्रविधि वाचन शैली।',
  },
  {
    id: 'storytelling-himalaya',
    title: 'Himalayan Morning & Resilience',
    nepaliTitle: 'हिमालको बिहानी र आशा',
    tone: 'storytelling',
    category: 'Storytelling / Motivation',
    recommendedVoice: 'Aoede',
    text: 'हिमालको सेतो काखमा जब बिहानीको पहिलो किरण पर्छ, तब प्रकृतिले नयाँ जीवनको मुस्कान छर्दछ। हरेक कठिन यात्राको अन्त्यमा एउटा स्वर्णिम शिखर प्रतिक्षारत हुन्छ।',
    description: 'न्यानो, भावुक र प्रेरणादायी आख्यान वाचन।',
  },
  {
    id: 'social-vlog',
    title: 'Social Media & Creator Intro',
    nepaliTitle: 'सामाजिक सञ्जाल र भ्लग',
    tone: 'conversational',
    category: 'Conversational / Social Media',
    recommendedVoice: 'Puck',
    text: 'नमस्ते साथीहरू! आजको यस नयाँ भिडियोमा यहाँहरू सबैलाई हार्दिक स्वागत छ। यदि तपाईंहरू पहिलो पटक हाम्रो च्यानलमा आउनुभएको हो भने, कृपया लाइक र सब्स्क्राइब गर्न नबिर्सिनुहोला।',
    description: 'उर्जावान, मैत्रीपूर्ण र स्वाभाविक बोलचालको नेपाली शैली।',
  },
  {
    id: 'romanized-sample',
    title: 'Romanized Nepali Input Test',
    nepaliTitle: 'रोमन नेपाली परीक्षण',
    tone: 'auto',
    category: 'Auto-Conversion Test',
    recommendedVoice: 'Fenrir',
    text: 'Namaskar sathi haru! Aaja hami Nepali voiceover artist ra text-to-speech technology ko barema kura garnechhau. Yo prabidhi le romanized Nepali lai pani swabhavik Devanagari script ma rupantaran garchha.',
    description: 'रोमन लिपिलाई स्वतः शुद्ध देवनागरीमा रूपान्तरण।',
  },
];
