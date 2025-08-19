/**
 * Microsoft Edge TTS Service
 * Uses child process to run Edge TTS synthesis in isolation
 * Provides high-quality neural voice synthesis
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const crypto = require('crypto');

class EdgeTTSService {
  constructor() {
    this.isInitialized = true;
    this.defaultVoice = 'en-US-AriaNeural';
    logger.info('Edge TTS Service initialized');
  }

  /**
   * Synthesize text to speech - returns a signal to use browser TTS instead
   * @param {string} text - Text to synthesize
   * @param {string} voice - Voice to use
   * @returns {Promise<Buffer>} - Audio buffer or browser TTS signal
   */
  async synthesizeText(text, voice = 'en-US-AriaNeural') {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for synthesis');
    }

    // Since Edge TTS is having authentication issues, we'll signal the client
    // to use browser-based Web Speech API instead
    logger.info(`🎵 Edge TTS unavailable (403 error), signaling browser TTS fallback for: "${text.substring(0, 50)}..."`);
    
    // Return a special signal that tells the client to use browser TTS
    const browserTTSSignal = JSON.stringify({
      useBrowserTTS: true,
      text: text,
      movieTitle: "Movie Overview", // Add this for compatibility
      voice: this.mapVoiceToBrowser(voice)
    });
    
    return Buffer.from(browserTTSSignal, 'utf8');
  }

  /**
   * Map Edge TTS voice names to browser-compatible voice names
   */
  mapVoiceToBrowser(edgeVoice) {
    const voiceMap = {
      'en-US-AriaNeural': 'Microsoft Aria Online (Natural) - English (United States)',
      'en-US-GuyNeural': 'Microsoft Guy Online (Natural) - English (United States)',
      'en-GB-SoniaNeural': 'Microsoft Sonia Online (Natural) - English (United Kingdom)',
      'en-AU-NatashaNeural': 'Microsoft Natasha Online (Natural) - English (Australia)'
    };
    
    return voiceMap[edgeVoice] || 'default';
  }

  /**
   * Create the Edge TTS runner script if it doesn't exist
   */
  async ensureScriptExists() {
    const scriptPath = path.join(process.cwd(), 'scripts/tts/runEdgeTTS.mjs');
    
    const scriptContent = `
import { EdgeTTS } from "@andresaya/edge-tts";
import fs from 'fs';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  let text = '';
  let voice = 'en-US-AriaNeural';
  let outputFile = 'edge_tts_output';

  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--text') text = args[i + 1];
    if (args[i] === '--voice') voice = args[i + 1];
    if (args[i] === '--output') outputFile = args[i + 1];
  }

  if (!text) {
    console.error('No text provided');
    process.exit(1);
  }

  try {
    const tts = new EdgeTTS({
      trustedClientToken: "6A5AA1D4EAFF4E9FB37E23D68491D6F4",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.51",
        "Sec-MS-GEC": "1.0",
        "Sec-MS-GEC-Version": "1.0"
      },
    });
    
    const readableStream = await tts.synthesize(text, voice);
    const outputFileMp3 = outputFile + '.mp3';
    const fileStream = fs.createWriteStream(outputFileMp3);
    
    readableStream.pipe(fileStream);
    
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    console.log('TTS synthesis to file stream finished.');
    process.exit(0);
  } catch (error) {
    console.error('Edge TTS synthesis failed:', error.message);
    process.exit(1);
  }
}

main();
`;
    // Ensure directory exists
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, scriptContent);
    logger.info('Created/Updated Edge TTS runner script with new auth headers');
  }
}

module.exports = new EdgeTTSService();