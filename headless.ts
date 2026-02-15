
/**
 * HEADLESS BROADCASTER (v0.7.0)
 */
// Fix: Import process to ensure Node.js types are correctly recognized by the compiler
import process from 'process';
import { fetchAINews, generatePodcastScript, generateSegmentAudio } from './services/gemini.js';
import { generateRSSFeed } from './utils/rss.js';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

const IS_TEST = process.env.IS_TEST === 'true';

async function run() {
  console.log('--- AI DAILY PULSE: CLOUD BROADCAST v0.7.0 ---');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  const id = Date.now().toString();
  const filename = `AI-Pulse-${id}.mp3`;
  const pcmFile = `temp-${id}.pcm`;

  try {
    if (IS_TEST) {
      console.log('DIAGNOSTIC MODE TRIGGERED...');
      execSync(`ffmpeg -f lavfi -i "sine=frequency=440:duration=1" -acodec libmp3lame -ab 128k ${filename}`);
    } else {
      console.log('Step 1: 7-Pillar Intelligence Gathering...');
      const report = await fetchAINews();
      console.log('Intelligence gathered successfully.');
      
      console.log('Step 2: Scripting 15-Minute Newscast (Byte-sized)...');
      const script = await generatePodcastScript(report.newsText);
      console.log(`Script generated. Length: ${script.length} chars.`);
      
      console.log('Step 3: Multi-Speaker Production Sequence...');
      const segments = script.split('[TRANSITION]').filter(s => s.trim().length > 5);
      console.log(`Identified ${segments.length} segments for production.`);
      
      for (let i = 0; i < segments.length; i++) {
        console.log(`-> Producing Segment ${i+1}/${segments.length}...`);
        const chunks = await generateSegmentAudio(segments[i]);
        console.log(`   Segment ${i+1} audio chunks received: ${chunks.length}`);
        for (const chunk of chunks) {
          fs.appendFileSync(pcmFile, Buffer.from(chunk, 'base64'));
        }
      }
      
      console.log('Step 4: Audio Mastering & LAME Encoding...');
      if (fs.existsSync(pcmFile)) {
        execSync(`ffmpeg -f s16le -ar 24000 -ac 1 -i ${pcmFile} -acodec libmp3lame -ab 128k ${filename}`);
        fs.unlinkSync(pcmFile);
        console.log(`Mastering complete: ${filename}`);
      } else {
        throw new Error("PCM production file was not generated.");
      }
    }

    const repoPath = process.env.GITHUB_REPOSITORY || 'sunisankara/ai-pulse-podcast';
    const [owner, repoName] = repoPath.split('/');
    const baseUrl = `https://${owner}.github.io/${repoName}`;

    console.log('Step 5: Syndication Feed Update...');
    const rssContent = generateRSSFeed([], baseUrl); 
    fs.writeFileSync('feed.xml', rssContent);
    
    console.log('--- BROADCAST SUCCESSFUL ---');
  } catch (error: any) {
    console.error('--- CRITICAL ENGINE FAILURE ---');
    console.error(error.message);
    process.exit(1);
  }
}
run();
