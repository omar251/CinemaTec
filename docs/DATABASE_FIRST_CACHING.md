# Database-First Caching System

The CinemaTec application has been refactored to use **PostgreSQL database as the primary local caching system** instead of JSON files. This provides better performance, reliability, and scalability.

## Architecture Overview

### Before: JSON File-Based Caching
- Primary cache: `saved_networks/movie_cache/movies.json`
- Memory cache: In-memory Map for API responses
- Issues: File I/O bottlenecks, data consistency, limited search capabilities

### After: Database-First Caching
- **Primary cache**: PostgreSQL database with optimized schema
- **Secondary cache**: Small in-memory LRU cache (100 entries) for frequently accessed movies
- **Tertiary cache**: Memory cache for API responses (unchanged)

## Key Components

### 1. Database-First Movie Data Service (`src/services/movieDataService.js`)

**Core Features:**
- ✅ **Database as Primary Storage**: All movie data stored in PostgreSQL
- ✅ **Memory Cache Layer**: Fast access to frequently used movies
- ✅ **Full-Text Search**: PostgreSQL-powered search with ranking
- ✅ **Batch Operations**: Efficient bulk movie retrieval
- ✅ **Cache Statistics**: Comprehensive performance metrics
- ✅ **Automatic Cleanup**: Remove old, unused entries

**Key Methods:**
```javascript
// Store movie in database (primary cache)
await movieDataService.storeMovie(movieData)

// Get movie with multi-level caching
await movieDataService.getMovie(traktId, title, year)

// Search movies with full-text search
await movieDataService.searchMovies(query, limit)

// Get all movies with pagination
await movieDataService.getAllMovies(limit, offset)

// Get comprehensive statistics
await movieDataService.getStats()
```

### 2. Enhanced Database Schema

**Movies Table** with optimized indexes:
```sql
-- Full-text search index
CREATE INDEX idx_movies_search ON movies USING gin(to_tsvector('english', title || ' ' || COALESCE(overview, '')));

-- Performance indexes
CREATE INDEX idx_movies_trakt_id ON movies(trakt_id);
CREATE INDEX idx_movies_title_year ON movies(title, year);
CREATE INDEX idx_movies_last_accessed ON movies(last_accessed);
```

**Related Tables:**
- `movie_genres`: Many-to-many relationship for genres
- `movie_languages`: Many-to-many relationship for languages
- `app_metadata`: Application-wide statistics

### 3. Multi-Level Caching Strategy

#### Level 1: Memory Cache (Fastest)
- **Size**: 100 most recently accessed movies
- **TTL**: Session-based (cleared on restart)
- **Use Case**: Frequently accessed movies during user session

#### Level 2: Database Cache (Primary)
- **Size**: Unlimited (managed by cleanup)
- **TTL**: 30 days default (configurable)
- **Use Case**: All cached movie data with full search capabilities

#### Level 3: API Cache (Unchanged)
- **Size**: Configurable per cache type
- **TTL**: 5-15 minutes depending on data type
- **Use Case**: Raw API responses to reduce external API calls

## Performance Benefits

### Search Performance
```javascript
// Before: Linear search through JSON array
const results = movies.filter(m => m.title.includes(query));

// After: PostgreSQL full-text search with ranking
const results = await movieDataService.searchMovies(query, limit);
// Uses: to_tsvector, plainto_tsquery, ts_rank for relevance
```

### Data Retrieval
```javascript
// Before: Load entire JSON file into memory
const allMovies = JSON.parse(fs.readFileSync('movies.json'));

// After: Efficient database queries with pagination
const movies = await movieDataService.getAllMovies(50, 0);
```

### Memory Usage
- **Before**: Entire movie dataset in memory (~50-100MB for large collections)
- **After**: Only 100 most recent movies in memory (~5-10MB)

## API Endpoints

### Cache Management (`/api/cache/`)

```http
GET /api/cache/stats
# Returns comprehensive cache statistics

POST /api/cache/clear
Content-Type: application/json
{
  "type": "movie-data" | "memory" | null  // null clears both
}

POST /api/cache/cleanup
Content-Type: application/json
{
  "maxAgeHours": 720  // 30 days default
}

GET /api/cache/search?q=batman&limit=10
# Search movies in database cache

GET /api/cache/movies?limit=50&offset=0
# Get cached movies with pagination
```

### Import Operations (`/api/import/`)

```http
POST /api/import/movies
# Import all movies from movies.json to database

POST /api/import/movie
Content-Type: application/json
{
  "title": "The Dark Knight",
  "year": 2008
}

GET /api/import/stats
# Get import statistics and file info
```

## Migration Process

### Automatic Migration
The system can automatically migrate existing JSON cache to database:

```bash
# Import existing movies.json to database
npm run import-movies

# Or via API
curl -X POST http://localhost:3000/api/import/movies
```

### Manual Migration
```javascript
const movieImportService = require('./src/services/movieImportService');

// Import all movies from JSON
const result = await movieImportService.importMoviesFromJson();
console.log(`Imported ${result.successCount} movies`);
```

## Configuration

### Environment Variables
```env
# Database connection (existing)
DATABASE_URL=postgresql://user:pass@localhost:5432/cinematec

# Cache settings (new)
MOVIE_CACHE_MAX_MEMORY_SIZE=100
MOVIE_CACHE_CLEANUP_HOURS=720  # 30 days
MOVIE_CACHE_ENABLE_SEARCH_INDEX=true
```

### Cache Configuration
```javascript
// In movieDataService constructor
this.maxMemoryCacheSize = process.env.MOVIE_CACHE_MAX_MEMORY_SIZE || 100;
```

## Monitoring and Metrics

### Cache Hit Rates
```javascript
const stats = await movieDataService.getStats();
console.log(`Memory hits: ${stats.cacheHits.memory}`);
console.log(`Database hits: ${stats.cacheHits.database}`);
console.log(`Cache misses: ${stats.cacheHits.miss}`);
console.log(`Hit rate: ${stats.memory.hitRate}%`);
```

### Database Performance
```javascript
const stats = await movieDataService.getStats();
console.log(`Total movies: ${stats.database.totalMovies}`);
console.log(`Average rating: ${stats.database.averageRating}`);
console.log(`Languages: ${stats.database.languagesCount}`);
console.log(`Genres: ${stats.database.totalGenres}`);
```

## Backward Compatibility

### Existing Code
Most existing code continues to work with minimal changes:

```javascript
// Before (synchronous)
const movie = movieDataService.getMovie(traktId);

// After (asynchronous)
const movie = await movieDataService.getMovie(traktId);
```

### JSON File Support
The old JSON files are preserved and can still be imported:
- `saved_networks/movie_cache/movies.json` → Database import
- Import service handles data transformation automatically

## Troubleshooting

### Common Issues

1. **Database Connection**
   ```bash
   # Check database connectivity
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM movies;"
   ```

2. **Memory Cache Issues**
   ```javascript
   // Clear memory cache
   movieDataService.clearMemoryCache();
   ```

3. **Search Not Working**
   ```sql
   -- Verify search index exists
   SELECT indexname FROM pg_indexes WHERE tablename = 'movies';
   ```

### Performance Tuning

1. **Database Indexes**
   ```sql
   -- Add custom indexes for specific queries
   CREATE INDEX idx_movies_rating ON movies(overall_rating DESC);
   CREATE INDEX idx_movies_year ON movies(year DESC);
   ```

2. **Memory Cache Size**
   ```javascript
   // Increase memory cache for high-traffic scenarios
   this.maxMemoryCacheSize = 500; // Default: 100
   ```

## Future Enhancements

### Planned Features
- [ ] **Redis Integration**: Optional Redis layer for distributed caching
- [ ] **Cache Warming**: Pre-populate cache with popular movies
- [ ] **Analytics**: Detailed cache performance analytics
- [ ] **Compression**: Compress large movie data in database
- [ ] **Partitioning**: Partition movies table by year for better performance

### Scalability Considerations
- **Read Replicas**: Use PostgreSQL read replicas for read-heavy workloads
- **Connection Pooling**: Implement connection pooling for high concurrency
- **Horizontal Scaling**: Consider sharding by movie year or genre

## Summary

The database-first caching system provides:

✅ **Better Performance**: Fast database queries with indexes  
✅ **Improved Search**: Full-text search with relevance ranking  
✅ **Reduced Memory Usage**: Only cache frequently accessed data  
✅ **Better Reliability**: ACID transactions and data consistency  
✅ **Scalability**: Handle larger datasets efficiently  
✅ **Maintainability**: Standard SQL operations and monitoring  

The system maintains backward compatibility while providing significant performance and reliability improvements for movie data management.