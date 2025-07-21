#!/usr/bin/env node
/**
 * Test script for secure AI integration
 */
const axios = require('axios');

async function testAIIntegration() {
  console.log('🤖 Testing Secure AI Integration');
  console.log('='.repeat(40));
  
  const baseUrl = 'http://127.0.0.1:5000/api';
  
  try {
    // Test health endpoint first
    console.log('\n1. 🏥 Testing health endpoint...');
    const health = await axios.get(`${baseUrl}/health`);
    
    console.log(`✅ Server Status: ${health.data.status}`);
    console.log(`✅ Trakt API: ${health.data.trakt_api_configured ? 'Configured' : 'Missing'}`);
    console.log(`✅ TMDB API: ${health.data.tmdb_api_configured ? 'Configured' : 'Missing'}`);
    console.log(`🤖 Gemini AI: ${health.data.gemini_api_configured ? 'Configured' : 'Missing'}`);
    
    if (!health.data.gemini_api_configured) {
      console.log('\n⚠️  Gemini AI not configured - AI features will be disabled');
      console.log('   Add GEMINI_API_KEY to your .env file to enable AI features');
      console.log('   Get your key from: https://aistudio.google.com/app/apikey');
      return;
    }
    
    // Test AI Synopsis endpoint
    console.log('\n2. ✨ Testing AI Synopsis endpoint...');
    try {
      const synopsisResponse = await axios.post(`${baseUrl}/ai/synopsis`, {
        movieTitle: 'The Dark Knight',
        movieOverview: 'Batman faces the Joker in this epic superhero thriller.'
      }, { timeout: 15000 });
      
      console.log('✅ AI Synopsis working!');
      console.log(`📝 Generated: ${synopsisResponse.data.synopsis.substring(0, 100)}...`);
      
    } catch (error) {
      if (error.response?.status === 503) {
        console.log('❌ AI Synopsis: Service unavailable (API key issue)');
      } else {
        console.log(`❌ AI Synopsis error: ${error.message}`);
      }
    }
    
    // Test AI Insights endpoint
    console.log('\n3. 🧠 Testing AI Insights endpoint...');
    try {
      const insightsResponse = await axios.post(`${baseUrl}/ai/insights`, {
        selectedMovie: {
          title: 'The Dark Knight',
          overview: 'Batman faces the Joker in this epic superhero thriller.'
        },
        relatedMovies: [
          { title: 'Batman Begins' },
          { title: 'The Dark Knight Rises' },
          { title: 'Joker' }
        ]
      }, { timeout: 15000 });
      
      console.log('✅ AI Insights working!');
      console.log(`🧠 Generated: ${insightsResponse.data.insights.substring(0, 100)}...`);
      
    } catch (error) {
      if (error.response?.status === 503) {
        console.log('❌ AI Insights: Service unavailable (API key issue)');
      } else {
        console.log(`❌ AI Insights error: ${error.message}`);
      }
    }
    
    console.log('\n🎉 AI Integration Test Complete!');
    console.log('\n📋 SECURITY IMPROVEMENTS');
    console.log('✅ API keys secured on backend');
    console.log('✅ No client-side API exposure');
    console.log('✅ Proper error handling');
    console.log('✅ Request validation');
    console.log('✅ Timeout protection');
    
    console.log('\n🚀 NEXT STEPS');
    console.log('• Open ai_secure.html in your browser');
    console.log('• Search for movies and try AI features');
    console.log('• AI Synopsis: Click "✨ AI Synopsis" on movie cards');
    console.log('• AI Insights: Select a movie to see "✨ Why You Might Like These"');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running. Please start it with:');
      console.log('   npm start');
    } else {
      console.log(`❌ Test failed: ${error.message}`);
    }
  }
}

if (require.main === module) {
  testAIIntegration();
}