#!/usr/bin/env node
/**
 * Batch Movie Network Generator
 * Generate multiple movie networks for popular movies
 */

const MovieNetworkGenerator = require('./movie_network_generator');
const fs = require('fs');
const path = require('path');

const popularMovies = [
    'The Dark Knight',
    'Inception',
    'The Matrix',
    'Pulp Fiction',
    'The Godfather',
    'Star Wars',
    'Avatar',
    'Titanic',
    'The Avengers',
    'Interstellar'
];

async function generateMultipleNetworks() {
    console.log('🎬 Batch Movie Network Generator');
    console.log('='.repeat(50));
    
    const generator = new MovieNetworkGenerator();
    const results = [];
    
    // Create networks directory
    const networksDir = 'movie_networks';
    if (!fs.existsSync(networksDir)) {
        fs.mkdirSync(networksDir);
    }
    
    for (let i = 0; i < popularMovies.length; i++) {
        const movie = popularMovies[i];
        const filename = `${movie.toLowerCase().replace(/[^a-z0-9]/g, '_')}_network.html`;
        const filepath = path.join(networksDir, filename);
        
        console.log(`\n📽️  [${i + 1}/${popularMovies.length}] Generating network for: ${movie}`);
        console.log('-'.repeat(30));
        
        try {
            // Reset generator for each movie
            generator.movieNetwork.clear();
            generator.visitedMovies.clear();
            
            const result = await generator.generateNetworkGraph(movie, filepath);
            results.push({
                movie,
                ...result,
                success: true
            });
            
            console.log(`✅ Success: ${result.networkSize} movies, ${result.totalConnections} connections`);
            
        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
            results.push({
                movie,
                success: false,
                error: error.message
            });
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Generate index page
    generateIndexPage(results, networksDir);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 BATCH GENERATION COMPLETE');
    console.log('='.repeat(50));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    if (successful.length > 0) {
        console.log('\n🎯 Generated Networks:');
        successful.forEach(result => {
            console.log(`   • ${result.movie}: ${result.networkSize} movies`);
        });
    }
    
    if (failed.length > 0) {
        console.log('\n❌ Failed Networks:');
        failed.forEach(result => {
            console.log(`   • ${result.movie}: ${result.error}`);
        });
    }
    
    console.log(`\n🌐 Open index: file://${path.resolve(networksDir, 'index.html')}`);
}

function generateIndexPage(results, networksDir) {
    const successful = results.filter(r => r.success);
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Movie Network Gallery</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            color: white;
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
        }

        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #e94560, #f6e05e);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }

        .network-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            padding: 25px;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            cursor: pointer;
        }

        .network-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .network-card h3 {
            margin: 0 0 15px 0;
            font-size: 1.5rem;
            color: #f6e05e;
        }

        .stats {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            font-size: 0.9rem;
            color: #b0b0b0;
        }

        .stat-item {
            text-align: center;
        }

        .stat-number {
            display: block;
            font-size: 1.5rem;
            font-weight: bold;
            color: #10b981;
        }

        .view-btn {
            background: linear-gradient(45deg, #e94560, #f6e05e);
            border: none;
            color: white;
            padding: 12px 24px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: bold;
            width: 100%;
            transition: transform 0.2s;
        }

        .view-btn:hover {
            transform: scale(1.05);
        }

        .summary {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
        }

        .summary h2 {
            color: #f6e05e;
            margin-bottom: 20px;
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .summary-stat {
            background: rgba(255, 255, 255, 0.05);
            padding: 15px;
            border-radius: 10px;
        }

        .summary-stat .number {
            font-size: 2rem;
            font-weight: bold;
            color: #10b981;
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Movie Network Gallery</h1>
            <p>Interactive visualizations of movie relationship networks</p>
        </div>

        <div class="gallery">
            ${successful.map(result => `
                <div class="network-card" onclick="openNetwork('${result.outputFile}')">
                    <h3>${result.movie}</h3>
                    <div class="stats">
                        <div class="stat-item">
                            <span class="stat-number">${result.networkSize}</span>
                            <span>Movies</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${result.totalConnections}</span>
                            <span>Connections</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${Math.round(result.totalConnections / result.networkSize * 10) / 10}</span>
                            <span>Avg Links</span>
                        </div>
                    </div>
                    <button class="view-btn">🔍 Explore Network</button>
                </div>
            `).join('')}
        </div>

        <div class="summary">
            <h2>📊 Collection Summary</h2>
            <div class="summary-stats">
                <div class="summary-stat">
                    <span class="number">${successful.length}</span>
                    <span>Networks Generated</span>
                </div>
                <div class="summary-stat">
                    <span class="number">${successful.reduce((sum, r) => sum + r.networkSize, 0)}</span>
                    <span>Total Movies</span>
                </div>
                <div class="summary-stat">
                    <span class="number">${successful.reduce((sum, r) => sum + r.totalConnections, 0)}</span>
                    <span>Total Connections</span>
                </div>
                <div class="summary-stat">
                    <span class="number">${Math.round(successful.reduce((sum, r) => sum + r.networkSize, 0) / successful.length)}</span>
                    <span>Avg Network Size</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        function openNetwork(filename) {
            window.open(filename, '_blank');
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(networksDir, 'index.html'), html);
    console.log(`📄 Generated gallery index: ${path.join(networksDir, 'index.html')}`);
}

if (require.main === module) {
    generateMultipleNetworks().catch(console.error);
}

module.exports = { generateMultipleNetworks };