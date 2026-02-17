
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
  const prompt = `Role: You are a Senior Healthcare Strategy Consultant AI specializing in the "Alvarez & Marsal" style of operational turnaround and financial restructuring.

  CONTEXT: I am Shankar Sundaram, a Senior Director at A&M. My background is in Payor space and Technology. 
  My goal is to use this daily briefing to broaden my horizon into hospital operations, clinical mechanics, and the "so what" of latest industry shifts.

  TASK: Write a high-density conversational NEWSCAST script for "Healthcare Daily Pulse by Sundaram Labs" based on events from the LAST 24-48 HOURS.

  SEARCH REQUIREMENTS: Before writing, search for the latest news (within 48 hours) regarding:
  - Major Healthcare M&A or Restructuring (e.g., spinoffs, bankruptcies, PE acquisitions).
  - New CMS Mandates, Federal Laws, or Regulatory Rulings.
  - Large-scale operational projects undertaken by Top 20 Health Systems.
  - Breakthroughs in 'Agentic AI' or health-tech implementation.

  DATA REQUIREMENT: Every story MUST include at least one hard number ($, parameter count, percentage, or date).`;

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
  const prompt = `Write a high-density conversational NEWSCAST script for "Healthcare Daily Pulse by Sundaram Labs".
  
  TARGET LENGTH: 15 minutes (~2,200 words).
  FORMAT: Byte-sized news segments. Rapid fire delivery.
  
  HOSTS:
  - Alex (FEMALE Technical Architect): Critical, implementation-focused, skeptical of hype. (Reflecting my Payor/Tech expertise).
  - Marcus (MALE Strategy Executive): Optimistic, ROI-focused, market-visionary, "War Room" pragmatic. (Reflecting the A&M transformation lens).

  TONE: A balance of "Consultant Optimism" and "War Room Pragmatism." Fast-paced, data-driven.

  STRUCTURE:
  - Intro: "Top of the hour. AI Daily Pulse by Sundaram Labs. I'm Alex. And I'm Marcus. Key Healthcare news in 15 minutes. Let's go."
  - For each of the news segment, follow this flow:
    - Marcus: Delivers the 'Headline' with quantifiable data from the last 48 hours.
    - Alex: Interrupts with the 'Architect’s Take'—Explain the technical/operational friction of this news. How does it break existing systems?
    - Marcus: Counters with the 'Strategic ROI'—What is the cause of this event? Why did the M&A happen? How should a consultant advise a CEO to react?
    MANDATORY: Wrap each news segment with the tag [TRANSITION].
  - Outro Script: "This is a production of Sundaram Labs. Subscribe for your daily briefing. We'll be back tomorrow."
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
