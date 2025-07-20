#!/usr/bin/env node
/**
 * Performance comparison script for Node.js backend
 */
const axios = require('axios');

async function testEndpoint(url, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`URL: ${url}`);
  
  const startTime = Date.now();
  try {
    const response = await axios.get(url, { timeout: 30000 });
    const endTime = Date.now();
    
    if (response.status === 200) {
      const data = response.data;
      const duration = (endTime - startTime) / 1000;
      console.log(`✅ Success: ${duration}s`);
      console.log(`📊 Results: ${Array.isArray(data) ? data.length : 1} items`);
      return duration;
    } else {
      console.log(`❌ Error: ${response.status}`);
      return null;
    }
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log(`⏰ Timeout after 30 seconds`);
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
    return null;
  }
}

async function main() {
  console.log('🚀 Node.js Backend Performance Test');
  console.log('=' * 60);
  
  const baseUrl = '/api';
  const testQuery = 'batman';
  
  // Test search endpoints
  console.log('\n📋 SEARCH PERFORMANCE');
  console.log('-'.repeat(30));
  
  const originalTime = await testEndpoint(
    `${baseUrl}/search/movies?query=${testQuery}`,
    'Enhanced Search (with stats, ratings, posters)'
  );
  
  const fastTime = await testEndpoint(
    `${baseUrl}/search/movies/fast?query=${testQuery}`,
    'Fast Search (basic data only)'
  );
  
  // Test related movies (need a movie ID first)
  console.log('\n📋 RELATED MOVIES PERFORMANCE');
  console.log('-'.repeat(30));
  
  try {
    const response = await axios.get(`${baseUrl}/search/movies/fast?query=${testQuery}`);
    if (response.status === 200 && response.data.length > 0) {
      const movieId = response.data[0].movie.ids.trakt;
      console.log(`Using movie ID: ${movieId}`);
      
      const relatedTime = await testEndpoint(
        `${baseUrl}/movies/${movieId}/related`,
        'Related Movies (with enhancement)'
      );
      
      const relatedFastTime = await testEndpoint(
        `${baseUrl}/movies/${movieId}/related/fast`,
        'Related Movies (basic data only)'
      );
      
      // Performance summary
      console.log('\n📊 PERFORMANCE SUMMARY');
      console.log('='.repeat(40));
      
      if (originalTime && fastTime) {
        const improvement = ((originalTime - fastTime) / originalTime) * 100;
        console.log(`Search Speed Improvement: ${improvement.toFixed(1)}%`);
        console.log(`Enhanced: ${originalTime.toFixed(2)}s → Fast: ${fastTime.toFixed(2)}s`);
      }
      
      if (relatedTime && relatedFastTime) {
        const improvement = ((relatedTime - relatedFastTime) / relatedTime) * 100;
        console.log(`Related Movies Speed Improvement: ${improvement.toFixed(1)}%`);
        console.log(`Enhanced: ${relatedTime.toFixed(2)}s → Fast: ${relatedFastTime.toFixed(2)}s`);
      }
    }
  } catch (error) {
    console.log(`❌ Could not test related movies: ${error.message}`);
  }
  
  console.log('\n💡 NODE.JS ADVANTAGES');
  console.log('-'.repeat(20));
  console.log('• Native async/await - no thread pool needed');
  console.log('• Better concurrent request handling');
  console.log('• Simpler error handling with Promise.allSettled');
  console.log('• More efficient memory usage');
  console.log('• Faster startup time');
}

if (require.main === module) {
  main().catch(console.error);
}