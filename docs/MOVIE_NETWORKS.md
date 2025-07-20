# 🎬 Movie Network Visualization

## Overview

The Movie Network Generator creates interactive visualizations of movie relationships using the Trakt API. It builds networks by starting with a seed movie and exploring related movies up to 3 degrees of separation.

## Features

### 🔗 Network Generation
- **Multi-level exploration**: 3 degrees of separation from seed movie
- **Smart traversal**: Avoids duplicate movies and infinite loops
- **Configurable limits**: Max 5 movies per level for focused networks
- **Real-time progress**: Live console output during generation

### 🎨 Interactive Visualization
- **D3.js powered**: Smooth, responsive force-directed graphs
- **Color coding**: Different colors for each depth level
- **Zoom & pan**: Full navigation controls
- **Drag nodes**: Interactive node positioning
- **Tooltips**: Detailed movie information on hover
- **Toggle labels**: Show/hide movie titles

### 📊 Network Analytics
- **Connection metrics**: Total movies and relationships
- **Depth analysis**: Movies organized by degrees of separation
- **Network density**: Average connections per movie
- **Interactive stats**: Real-time network information

## Usage

### Single Network Generation

```bash
# Generate network for a specific movie
npm run generate-network "The Dark Knight" dark_knight_network.html

# Or use the script directly
node scripts/movie_network_generator.js "Inception" inception_network.html
```

### Batch Network Generation

```bash
# Generate networks for popular movies
npm run generate-networks

# Creates movie_networks/ directory with:
# - Individual network HTML files
# - Gallery index page
# - Summary statistics
```

### API Integration

```javascript
const MovieNetworkGenerator = require('./scripts/movie_network_generator');

const generator = new MovieNetworkGenerator();
const result = await generator.generateNetworkGraph('The Matrix', 'matrix.html');

console.log(`Generated network: ${result.networkSize} movies, ${result.totalConnections} connections`);
```

## Configuration

### Network Parameters

```javascript
class MovieNetworkGenerator {
    constructor() {
        this.maxDepth = 3;              // Maximum exploration depth
        this.maxMoviesPerLevel = 5;     // Movies to explore per level
        this.baseUrl = '/api';  // API endpoint
    }
}
```

### Visualization Settings

```javascript
// D3.js force simulation parameters
const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30));
```

## Network Structure

### Node Properties
- **ID**: Unique identifier
- **Title**: Movie title
- **Year**: Release year
- **Depth**: Degrees from seed movie (0-3)
- **Group**: Color coding group
- **Trakt ID**: API reference

### Link Properties
- **Source**: Origin node ID
- **Target**: Destination node ID
- **Value**: Connection strength (always 1)

## Color Scheme

| Depth | Color | Description |
|-------|-------|-------------|
| 0 | 🔴 Red (#e94560) | Seed movie |
| 1 | 🟡 Yellow (#f6e05e) | Direct connections |
| 2 | 🟢 Green (#10b981) | Second degree |
| 3 | 🔵 Blue (#3b82f6) | Third degree |

## Performance Metrics

### Typical Network Sizes
- **Small networks**: 10-15 movies, 50-75 connections
- **Medium networks**: 15-25 movies, 75-125 connections
- **Large networks**: 25+ movies, 125+ connections

### Generation Times
- **API calls**: ~100ms per movie (with 100ms delay)
- **Network building**: 5-30 seconds depending on size
- **Visualization**: Instant rendering with D3.js

## Interactive Controls

### Mouse Controls
- **Click & Drag**: Move nodes around
- **Mouse Wheel**: Zoom in/out
- **Hover**: Show movie details tooltip
- **Click Node**: Log movie information (extensible)

### Button Controls
- **🔄 Restart**: Reset force simulation
- **🎯 Center**: Center and reset zoom
- **🏷️ Toggle Labels**: Show/hide movie titles

## File Structure

```
scripts/
├── movie_network_generator.js    # Core network generator
├── generate_movie_networks.js    # Batch generator
└── ...

movie_networks/                   # Generated networks
├── index.html                   # Gallery page
├── batman_network.html          # Individual networks
├── inception_network.html
└── ...

docs/
└── MOVIE_NETWORKS.md            # This documentation
```

## Example Networks

### The Dark Knight Network
- **Size**: 15 movies, 75 connections
- **Key connections**: Batman series, superhero movies, crime thrillers
- **Notable nodes**: Batman Begins, Joker, The Avengers

### Inception Network
- **Size**: 21 movies, 105 connections
- **Key connections**: Mind-bending films, sci-fi thrillers, Christopher Nolan
- **Notable nodes**: The Matrix, Interstellar, Memento, Shutter Island

### The Matrix Network
- **Size**: 18 movies, 90 connections
- **Key connections**: Cyberpunk, reality-bending, action sci-fi
- **Notable nodes**: Blade Runner, Total Recall, Dark City

## API Dependencies

### Required Endpoints
- `GET /api/search/movies/fast?query={title}` - Movie search
- `GET /api/movies/{id}/related/fast` - Related movies
- `GET /api/health` - Server status

### Rate Limiting
- Built-in 100ms delay between API calls
- Respectful to Trakt API limits
- Configurable timeout protection

## Troubleshooting

### Common Issues

1. **Server not running**
   ```bash
   npm start  # Start the backend server first
   ```

2. **Movie not found**
   - Check spelling and try alternative titles
   - Some movies may not be in Trakt database

3. **Network too small**
   - Increase `maxMoviesPerLevel` for larger networks
   - Some movies have fewer connections

4. **Visualization not loading**
   - Ensure modern browser with JavaScript enabled
   - Check browser console for errors

### Debug Mode

```javascript
// Enable verbose logging
const generator = new MovieNetworkGenerator();
generator.debug = true;  // Add this property for detailed logs
```

## Future Enhancements

### Planned Features
- **Genre filtering**: Networks by movie genres
- **Actor networks**: Connections via shared actors
- **Director networks**: Movies by same directors
- **Timeline view**: Networks with temporal layout
- **Export options**: JSON, CSV, GraphML formats

### Advanced Analytics
- **Centrality measures**: Identify key movies in networks
- **Community detection**: Find movie clusters
- **Path analysis**: Shortest paths between movies
- **Network comparison**: Compare different movie networks

## Contributing

To add new features or improve the network generator:

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/network-enhancement`
3. **Add your changes** to `scripts/movie_network_generator.js`
4. **Test thoroughly** with various movies
5. **Update documentation** in this file
6. **Submit pull request**

## License

MIT License - feel free to use and modify for your projects!