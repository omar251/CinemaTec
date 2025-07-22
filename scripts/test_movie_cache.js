#!/usr/bin/env node
/**
 * Test script for movie data caching functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testMovieCache() {
  console.log('🎬 Testing Movie Data Cache System\n');

  try {
    // Test 1: Get cache statistics
    console.log('1. Getting cache statistics...');
    const statsResponse = await axios.get(`${BASE_URL}/cache/stats`);
    console.log('✅ Cache Stats:', JSON.stringify(statsResponse.data, null, 2));
    console.log();

    // Test 2: Search for a movie to trigger caching
    console.log('2. Searching for "The Matrix" to trigger caching...');
    const searchResponse = await axios.get(`${BASE_URL}/search/movies?query=The Matrix`);
    console.log(`✅ Found ${searchResponse.data.length} movies`);
    
    if (searchResponse.data.length > 0) {
      const firstMovie = searchResponse.data[0];
      console.log(`   First result: ${firstMovie.movie.title} (${firstMovie.movie.year})`);
      console.log();

      // Test 3: Get enhanced movie details (this should cache the movie)
      console.log('3. Getting enhanced movie details...');
      const movieResponse = await axios.get(`${BASE_URL}/movies/${firstMovie.movie.ids.trakt}/enhance`);
      console.log(`✅ Enhanced movie: ${movieResponse.data.movie.title}`);
      console.log(`   Poster URL: ${movieResponse.data.movie.poster_url || 'Not available'}`);
      console.log();

      // Test 4: Check if movie is now in persistent cache
      console.log('4. Checking if movie is in persistent cache...');
      try {
        const cacheResponse = await axios.get(`${BASE_URL}/cache/movies/${firstMovie.movie.ids.trakt}`);
        console.log(`✅ Movie found in persistent cache: ${cacheResponse.data.title}`);
        console.log(`   Cached at: ${cacheResponse.data.cachedAt}`);
        console.log(`   Last accessed: ${cacheResponse.data.lastAccessed}`);
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('❌ Movie not found in persistent cache yet');
        } else {
          throw error;
        }
      }
      console.log();
    }

    // Test 5: Search movies in cache
    console.log('5. Searching cached movies...');
    const cacheSearchResponse = await axios.get(`${BASE_URL}/cache/movies/search?q=matrix&limit=5`);
    console.log(`✅ Found ${cacheSearchResponse.data.results} cached movies matching "matrix"`);
    cacheSearchResponse.data.movies.forEach((movie, index) => {
      console.log(`   ${index + 1}. ${movie.title} (${movie.year}) - Rating: ${movie.rating || 'N/A'}`);
    });
    console.log();

    // Test 6: Force save cache
    console.log('6. Force saving cache...');
    const saveResponse = await axios.post(`${BASE_URL}/cache/movies/save`);
    console.log('✅ Cache saved successfully');
    console.log(`   Total movies in cache: ${saveResponse.data.stats.totalMovies}`);
    console.log(`   Cache file size: ${saveResponse.data.stats.estimatedSizeKB} KB`);
    console.log();

    // Test 7: Get updated cache statistics
    console.log('7. Getting updated cache statistics...');
    const finalStatsResponse = await axios.get(`${BASE_URL}/cache/stats`);
    console.log('✅ Final Cache Stats:');
    console.log(`   Movie Cache: ${finalStatsResponse.data.movieCache.totalMovies} movies`);
    console.log(`   Recently Accessed: ${finalStatsResponse.data.movieCache.recentlyAccessed}`);
    console.log(`   Cache Size: ${finalStatsResponse.data.movieCache.estimatedSizeKB} KB`);
    console.log(`   Memory Cache: ${finalStatsResponse.data.memoryCache.enhanced.active} enhanced entries`);
    console.log();

    console.log('🎉 All tests completed successfully!');
    console.log('\n📁 Movie data is now cached in: saved_networks/movie_cache/movies.json');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

async function checkServerHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server is running');
    return true;
  } catch (error) {
    console.error('❌ Server is not running. Please start the server first:');
    console.error('   npm start');
    return false;
  }
}

async function main() {
  console.log('🔍 Checking server status...');
  const serverRunning = await checkServerHealth();
  
  if (!serverRunning) {
    process.exit(1);
  }

  console.log();
  await testMovieCache();
}

if (require.main === module) {
  main();
}

module.exports = { testMovieCache, checkServerHealth };