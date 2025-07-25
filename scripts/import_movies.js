#!/usr/bin/env node

/**
 * Movie Import Script
 * Standalone script to import movies from movies.json into the database
 */

require('dotenv').config();
const movieImportService = require('../src/services/movieImportService');
const logger = require('../src/utils/logger');

async function main() {
    try {
        console.log('🎬 CinemaTec Movie Import Tool');
        console.log('================================');
        
        // Get current stats
        console.log('\n📊 Checking current status...');
        const stats = await movieImportService.getImportStats();
        console.log(`📁 Movies in JSON file: ${stats.jsonMovieCount}`);
        console.log(`💾 Movies in database: ${stats.dbMovieCount}`);
        console.log(`📅 JSON file last modified: ${stats.lastModified}`);
        
        // Ask for confirmation if there are already movies in the database
        if (stats.dbMovieCount > 0) {
            console.log('\n⚠️  Warning: Database already contains movies.');
            console.log('   This import will update existing movies and add new ones.');
        }
        
        // Start import
        console.log('\n🚀 Starting import process...');
        const result = await movieImportService.importMoviesFromJson();
        
        // Display results
        console.log('\n🎉 Import completed!');
        console.log('===================');
        console.log(`✅ Successfully imported: ${result.successCount} movies`);
        console.log(`❌ Failed to import: ${result.errorCount} movies`);
        console.log(`📊 Total movies processed: ${result.totalMovies}`);
        
        if (result.errors.length > 0) {
            console.log('\n❌ Import Errors:');
            result.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        console.log('\n✨ Import process finished successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('\n💥 Import failed:', error.message);
        logger.error('Import script error:', error);
        process.exit(1);
    }
}

// Handle script arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log('🎬 CinemaTec Movie Import Tool');
    console.log('Usage: node scripts/import_movies.js');
    console.log('');
    console.log('This script imports movie data from saved_networks/movie_cache/movies.json');
    console.log('into the PostgreSQL database.');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h    Show this help message');
    process.exit(0);
}

// Run the import
main();