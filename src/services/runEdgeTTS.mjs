
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
