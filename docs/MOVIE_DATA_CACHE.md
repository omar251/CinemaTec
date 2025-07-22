# Movie Data Cache System

## Overview

The Movie Data Cache System provides persistent JSON-based caching of movie data to improve performance and reduce API calls. This system works alongside the existing memory cache to provide a two-tier caching strategy.

## Features

- **Persistent Storage**: Movie data is stored in JSON format on disk
- **Automatic Caching**: Movies are automatically cached when enhanced
- **Search Functionality**: Search through cached movies by title
- **Cache Management**: APIs to manage, clean up, and monitor cache
- **Performance Optimization**: Reduces API calls and improves response times

## Architecture

### Two-Tier Caching Strategy

1. **Memory Cache** (Fast, Temporary)
   - In-memory storage for immediate access
   - Cleared on server restart
   - 5-30 minute TTL

2. **Persistent Cache** (Slower, Permanent)
   - JSON file storage on disk
   - Survives server restarts
   - 30-day default retention

### File Structure

```
saved_networks/
├── movie_cache/
│   └── movies.json          # Persistent movie data cache
└── network_files...         # Network JSON files (unchanged)
```

## Movie Data Structure

Each cached movie contains:

```json
{
  "title": "Movie Title",
  "year": 2023,
  "ids": {
    "trakt": 12345,
    "imdb": "tt1234567",
    "tmdb": 67890
  },
  "overview": "Movie description...",
  "rating": 8.5,
  "votes": 1000,
  "genres": ["action", "thriller"],
  "stats": {
    "watchers": 5000,
    "plays": 6000,
    "collectors": 3000
  },
  "ratings": {
    "rating": 8.5,
    "votes": 1000,
    "distribution": {...}
  },
  "poster_url": "https://image.tmdb.org/t/p/w500/...",
  "tmdb_data": {...},
  "cachedAt": "2024-01-01T12:00:00.000Z",
  "lastAccessed": "2024-01-01T12:00:00.000Z",
  "cacheVersion": "1.0"
}
```

## API Endpoints

### Cache Statistics
```
GET /api/cache/stats
```
Returns comprehensive cache statistics including movie count, size, and memory usage.

### Search Cached Movies
```
GET /api/cache/movies/search?q=query&limit=10
```
Search through cached movies by title with fuzzy matching.

### Get Cached Movie
```
GET /api/cache/movies/:traktId
```
Retrieve a specific movie from the cache by Trakt ID.

### Batch Get Movies
```
POST /api/cache/movies/batch
Content-Type: application/json

{
  "traktIds": [123, 456, 789]
}
```
Retrieve multiple movies from cache in a single request.

### Force Save Cache
```
POST /api/cache/movies/save
```
Force immediate save of cache to disk.

### Clean Up Old Entries
```
POST /api/cache/movies/cleanup
Content-Type: application/json

{
  "maxAge": 2592000000  // 30 days in milliseconds (optional)
}
```
Remove old cache entries based on last access time.

### Clear Caches
```
POST /api/cache/memory/clear     # Clear memory cache only
POST /api/cache/movies/clear     # Clear persistent movie cache (requires confirmation)
```

## Configuration

Movie cache settings in `src/config/index.js`:

```javascript
storage: {
  movieCache: {
    enabled: true,
    autoSaveInterval: 300000,        // 5 minutes
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    cleanupInterval: 24 * 60 * 60 * 1000 // 24 hours
  }
}
```

## Usage Examples

### Automatic Caching

Movies are automatically cached when enhanced:

```javascript
// This will cache the movie data
const enhanced = await enhancementService.enhanceMovieData(movieItem);
```

### Manual Cache Operations

```javascript
const movieDataService = require('./src/services/movieDataService');

// Store a movie
movieDataService.storeMovie(movieData);

// Retrieve a movie
const movie = movieDataService.getMovie(traktId, title, year);

// Search movies
const results = movieDataService.searchMovies('matrix', 10);

// Get statistics
const stats = movieDataService.getStats();
```

## Testing

Run the test script to verify cache functionality:

```bash
# Start the server first
npm start

# In another terminal, run the test
node scripts/test_movie_cache.js
```

## Performance Benefits

1. **Reduced API Calls**: Cached movies don't require new API requests
2. **Faster Response Times**: Disk cache is faster than network requests
3. **Offline Capability**: Cached movies available even if APIs are down
4. **Bandwidth Savings**: Reduces external API usage

## Monitoring

Monitor cache performance through:

- Cache hit/miss ratios in logs
- Cache statistics API endpoint
- File system monitoring of cache directory
- Memory usage tracking

## Maintenance

### Regular Cleanup
The system automatically cleans up old entries, but you can manually trigger cleanup:

```bash
curl -X POST http://localhost:5000/api/cache/movies/cleanup
```

### Backup
The cache file can be backed up like any JSON file:

```bash
cp saved_networks/movie_cache/movies.json backup/movies_$(date +%Y%m%d).json
```

### Migration
To migrate cache data between environments, simply copy the `movie_cache` directory.

## Troubleshooting

### Cache Not Saving
- Check file permissions on `saved_networks/movie_cache/`
- Verify disk space availability
- Check logs for write errors

### Performance Issues
- Monitor cache file size (large files may slow down loading)
- Consider cleanup of old entries
- Check memory usage for large caches

### Data Corruption
- The system validates JSON on load
- Corrupted files will be logged and ignored
- Cache will rebuild automatically

## Future Enhancements

- Compression for large cache files
- Database backend option
- Cache warming strategies
- Advanced search capabilities
- Cache synchronization between instances