#!/usr/bin/env node
/**
 * Movie Network Demo Script
 * Quick demo of network generation capabilities
 */

const MovieNetworkGenerator = require('./movie_network_generator');

async function runDemo() {
    console.log('🎬 Movie Network Generator Demo');
    console.log('='.repeat(50));
    
    const generator = new MovieNetworkGenerator();
    
    // Demo movies with different characteristics
    const demoMovies = [
        { title: 'The Dark Knight', description: 'Superhero/Crime thriller' },
        { title: 'Inception', description: 'Mind-bending sci-fi' },
        { title: 'The Godfather', description: 'Classic crime drama' }
    ];
    
    console.log('🎯 Generating demo networks...\n');
    
    for (const movie of demoMovies) {
        console.log(`📽️  ${movie.title} (${movie.description})`);
        console.log('-'.repeat(30));
        
        try {
            // Reset for each movie
            generator.movieNetwork.clear();
            generator.visitedMovies.clear();
            
            const filename = `demo_${movie.title.toLowerCase().replace(/[^a-z]/g, '_')}.html`;
            const result = await generator.generateNetworkGraph(movie.title, filename);
            
            console.log(`✅ Generated: ${result.networkSize} movies, ${result.totalConnections} connections`);
            console.log(`📄 File: ${filename}\n`);
            
        } catch (error) {
            console.log(`❌ Failed: ${error.message}\n`);
        }
    }
    
    console.log('🎉 Demo complete! Open the generated HTML files to explore the networks.');
    console.log('\n💡 Tips:');
    console.log('   • Drag nodes to rearrange the network');
    console.log('   • Hover over nodes for movie details');
    console.log('   • Use zoom and pan to navigate');
    console.log('   • Click buttons to control the visualization');
}

if (require.main === module) {
    runDemo().catch(console.error);
}

module.exports = { runDemo };