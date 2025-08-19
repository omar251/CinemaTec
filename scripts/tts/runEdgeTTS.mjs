
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
