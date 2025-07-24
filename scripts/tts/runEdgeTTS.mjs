/**
 * Edge TTS Runner Script
 * Standalone script for Microsoft Edge TTS synthesis
 * Used by the TTS service via child process
 */
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
    console.log(`Running Edge TTS with voice: ${voice}`);
    console.log(`Text: "${text.substring(0, 50)}..."`);
    console.log(`Output file: ${outputFile}`);
    
    // Create TTS instance
    const tts = new EdgeTTS();
    
    // Synthesize text
    await tts.synthesize(text, voice, {
      rate: "0%",
      volume: "0%",
      pitch: "0Hz"
    });
    
    console.log('Synthesis complete, exporting to file...');
    
    // Export to file
    await tts.toFile(outputFile);
    
    console.log('File export complete');
    process.exit(0);
  } catch (error) {
    console.error('Edge TTS failed:', error.message);
    process.exit(1);
  }
}

main();