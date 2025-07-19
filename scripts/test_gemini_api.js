#!/usr/bin/env node
/**
 * Simple test to verify Gemini API key and connection
 */
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiAPI() {
  console.log('🤖 Testing Gemini API Connection');
  console.log('='.repeat(40));
  
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.log('❌ GEMINI_API_KEY not found in environment variables');
    console.log('\n📋 Setup Instructions:');
    console.log('1. Get API key from: https://aistudio.google.com/app/apikey');
    console.log('2. Add to .env file: GEMINI_API_KEY=your_key_here');
    console.log('3. Restart the server');
    return;
  }
  
  if (GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.log('❌ Please replace the placeholder API key with your actual key');
    console.log('Get your key from: https://aistudio.google.com/app/apikey');
    return;
  }
  
  console.log('✅ API key found in environment');
  console.log(`🔑 Key: ${GEMINI_API_KEY.substring(0, 10)}...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4)}`);
  
  try {
    console.log('\n🔄 Initializing Gemini client...');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Try different models in order of preference
    const modelsToTry = [
      'gemini-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];
    
    let workingModel = null;
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`🧪 Testing model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent('Say "Hello, I am working!" in a friendly way.');
        const response = await result.response;
        const text = response.text();
        
        console.log(`✅ ${modelName} is working!`);
        console.log(`📝 Response: ${text}`);
        workingModel = modelName;
        break;
        
      } catch (error) {
        console.log(`❌ ${modelName} failed: ${error.message}`);
      }
    }
    
    if (workingModel) {
      console.log(`\n🎉 SUCCESS! Use model: ${workingModel}`);
      console.log('\n📋 Next Steps:');
      console.log('1. Update server.js to use the working model');
      console.log('2. Restart your server: npm start');
      console.log('3. Test AI features: npm run test-ai');
    } else {
      console.log('\n❌ No models are working. Check your API key and quota.');
    }
    
  } catch (error) {
    console.log(`\n❌ Gemini API test failed: ${error.message}`);
    
    if (error.message.includes('API_KEY_INVALID') || error.message.includes('invalid')) {
      console.log('\n🔧 Troubleshooting:');
      console.log('• Check if your API key is correct');
      console.log('• Ensure the API key has Gemini API access enabled');
      console.log('• Try generating a new API key');
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      console.log('\n🔧 Troubleshooting:');
      console.log('• You may have exceeded the free quota');
      console.log('• Wait for quota reset or upgrade to paid plan');
      console.log('• Check usage at: https://aistudio.google.com/');
    } else {
      console.log('\n🔧 Troubleshooting:');
      console.log('• Check internet connection');
      console.log('• Verify API key permissions');
      console.log('• Try again in a few minutes');
    }
  }
}

if (require.main === module) {
  testGeminiAPI();
}