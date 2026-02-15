
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

export const fetchAINews = async (categories: string[] = []): Promise<any> => {
  const prompt = `Act as a senior technical intelligence analyst for software architects and CTOs.
  Research exactly 7 breaking AI developments from the last 24-48 hours.
  
  PILLAR REQUIREMENTS (1 item per pillar):
  1. ADVANCED TECH: New SOTA benchmarks, model architectures, or weight releases.
  2. MARKET/M&A: Major acquisitions, board changes, or significant stock movement.
  3. USER TOOLS: Developer productivity, IDE extensions, CLI improvements.
  4. INFRA/SERVICES: Cloud provider updates (AWS/Azure/GCP/CoreWeave).
  5. VENTURE/STARTUPS: Funding rounds (Series A+), stealth exits, or massive seed rounds.
  6. LEGISLATURE/POLICY: US specific laws, copyright rulings, or senate hearings.
  7. ACADEMIA: Significant ArXiv papers or institutional breakthroughs.

  DATA REQUIREMENT: Every story MUST include at least one hard number ($, parameter count, percentage, or date).
  [METADATA] TOP_STORIES: Story 1, Story 2, Story 3, Story 4, Story 5, Story 6, Story 7`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { 
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 } // Flash handles this well without budget
    },
  });

  const text = response.text || "";
  const [report, metadata] = text.split('[METADATA]');
  const topStories = metadata?.match(/TOP_STORIES: (.*)/)?.[1]?.split(',') || ["Daily Intelligence Brief"];
  
  return {
    newsText: report.trim(),
    topStories: topStories.map(t => t.trim()).filter(t => t),
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
  };
};

export const generatePodcastScript = async (newsSummary: string) => {
  const prompt = `Write a high-density conversational NEWSCAST script for "AI Daily Pulse by Sundaram Labs".
  
  TARGET LENGTH: 15 minutes (~2,200 words).
  FORMAT: Byte-sized news segments. Rapid fire delivery.
  
  HOSTS:
  - Alex (FEMALE Technical Architect): Critical, implementation-focused, skeptical of hype.
  - Marcus (MALE Strategy Executive): Optimistic, ROI-focused, market-visionary.

  TONE: Professional, fast, data-driven. Not a documentary. A technical newscast.

  STRUCTURE:
  - Intro: "Top of the hour. AI Daily Pulse by Sundaram Labs. I'm Alex. And I'm Marcus. 7 pillars of intelligence in 15 minutes. Let's go."
  - For each of the 7 pillars:
    - Marcus delivers the 'Headline' with quantifiable data.
    - Alex interrupts with a 30-second 'Architect's Take' on why it matters technically.
    - Marcus counters with the 'Strategic ROI' take.
    - MANDATORY: Wrap each pillar with the tag [TRANSITION].
  - Outro: "This is a production of Sundaram Labs. Subscribe for your daily briefing. We'll be back tomorrow."

  NEWS DATA TO CONVERT:
  ${newsSummary}`;

  // Using Flash-preview for the script as well for higher reliability/speed in browser context
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { 
      maxOutputTokens: 8192
    }
  });

  return response.text || "";
};

export const generateSegmentAudio = async (text: string): Promise<string[]> => {
  const cleanText = text
    .replace(/Sundaram/gi, 'Suun-duh-ruhm')
    .replace(/Labs/gi, 'Labbz')
    .replace(/\[.*?\]/g, '') 
    .trim();

  if (!cleanText) return [];

  const chunks: string[] = [];
  let remaining = cleanText;
  const MAX_CHUNK = 800;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK) {
      chunks.push(remaining);
      break;
    }
    let endIdx = remaining.lastIndexOf('.', MAX_CHUNK);
    if (endIdx === -1) endIdx = MAX_CHUNK;
    chunks.push(remaining.substring(0, endIdx + 1).trim());
    remaining = remaining.substring(endIdx + 1).trim();
  }

  const results: string[] = [];
  for (const chunk of chunks) {
    const data = await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: chunk }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                { speaker: 'Alex', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                { speaker: 'Marcus', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
              ]
            }
          }
        }
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    });
    if (data) results.push(data);
    await new Promise(r => setTimeout(r, 800));
  }
  return results;
};
