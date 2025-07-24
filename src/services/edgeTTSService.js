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
   * Synthesize text to speech using Edge TTS via a child process
   * @param {string} text - Text to synthesize
   * @param {string} voice - Voice to use
   * @returns {Promise<Buffer>} - Audio buffer
   */
  async synthesizeText(text, voice = 'en-US-AriaNeural') {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for synthesis');
    }

    // Create a unique output filename
    const hash = crypto.createHash('md5').update(text + voice).digest('hex');
    const outputFile = path.join(process.cwd(), `edge_tts_${hash}`);
    const scriptPath = path.join(process.cwd(), 'scripts/tts/runEdgeTTS.mjs');
    
    // Create the script if it doesn't exist
    await this.ensureScriptExists();

    return new Promise((resolve, reject) => {
      // Run the Edge TTS script as a child process
      logger.info(`Running Edge TTS for text: "${text.substring(0, 50)}..." with voice: ${voice}`);
      logger.info(`Script path: ${scriptPath}`);
      logger.info(`Output file: ${outputFile}`);
      
      // Check if script exists
      if (!fs.existsSync(scriptPath)) {
        logger.error(`Edge TTS script not found at: ${scriptPath}`);
        return reject(new Error(`Edge TTS script not found at: ${scriptPath}`));
      }
      
      const child = spawn('node', [
        scriptPath,
        '--text', text,
        '--voice', voice,
        '--output', outputFile
      ]);

      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        logger.info(`Edge TTS stdout: ${data.toString().trim()}`);
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.error(`Edge TTS stderr: ${data.toString().trim()}`);
      });

      child.on('close', async (code) => {
        if (code !== 0) {
          logger.error(`Edge TTS process failed with code ${code}: ${stderr}`);
          return reject(new Error(`Edge TTS failed: ${stderr}`));
        }

        // Check for the output file
        const possibleFiles = [
          `${outputFile}.mp3`,
          `${outputFile}.wav`,
          outputFile
        ];

        for (const file of possibleFiles) {
          if (fs.existsSync(file)) {
            try {
              const audioBuffer = fs.readFileSync(file);
              fs.unlinkSync(file); // Clean up
              logger.info(`Edge TTS successful: ${file}, size: ${audioBuffer.length}`);
              return resolve(audioBuffer);
            } catch (error) {
              logger.error(`Error reading audio file: ${error.message}`);
              return reject(error);
            }
          }
        }

        reject(new Error('Edge TTS did not generate an audio file'));
      });
    });
  }

  /**
   * Create the Edge TTS runner script if it doesn't exist
   */
  async ensureScriptExists() {
    const scriptPath = path.join(process.cwd(), 'scripts/tts/runEdgeTTS.mjs');
    
    if (fs.existsSync(scriptPath)) {
      return;
    }

    const scriptContent = `
import { EdgeTTS } from "@andresaya/edge-tts";
import fs from 'fs';

async function main() {
  // Parse arguments
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
    // Create TTS instance
    const tts = new EdgeTTS();
    
    // Synthesize text
    await tts.synthesize(text, voice, {
      rate: "0%",
      volume: "0%",
      pitch: "0Hz"
    });
    
    // Export to file
    await tts.toFile(outputFile);
    process.exit(0);
  } catch (error) {
    console.error('Edge TTS failed:', error.message);
    process.exit(1);
  }
}

main();
`;

    fs.writeFileSync(scriptPath, scriptContent);
    logger.info('Created Edge TTS runner script');
  }
}

module.exports = new EdgeTTSService();