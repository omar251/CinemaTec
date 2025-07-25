# Movie Import Service

The Movie Import Service provides functionality to import movie data from the cached `movies.json` file into the PostgreSQL database.

## Overview

This service reads movie data from `saved_networks/movie_cache/movies.json` and transforms it to match the database schema, then inserts it into the PostgreSQL database with proper relationships for genres, languages, and other metadata.

## Features

- **Batch Import**: Import all movies from movies.json
- **Single Movie Import**: Import a specific movie by title and year
- **Data Transformation**: Automatically transforms JSON structure to database format
- **Error Handling**: Comprehensive error handling with detailed logging
- **Statistics**: Provides import statistics and progress tracking
- **Metadata Updates**: Updates application metadata after import

## Usage

### Command Line Script

```bash
# Import all movies
npm run import-movies

# Or directly
node scripts/import_movies.js
```

### API Endpoints

#### Import All Movies
```http
POST /api/import/movies
```

Response:
```json
{
  "success": true,
  "message": "Movies imported successfully",
  "data": {
    "totalMovies": 317,
    "successCount": 315,
    "errorCount": 2,
    "errors": ["..."]
  }
}
```

#### Import Single Movie
```http
POST /api/import/movie
Content-Type: application/json

{
  "title": "The Dark Knight",
  "year": 2008
}
```

#### Get Import Statistics
```http
GET /api/import/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "jsonMovieCount": 317,
    "dbMovieCount": 315,
    "moviesJsonPath": "/path/to/movies.json",
    "lastModified": "2025-07-25T11:25:05.000Z"
  }
}
```

## Data Transformation

The service transforms movie data from the JSON format to the database schema:

### JSON Structure → Database Structure

- `title`, `year` → Direct mapping
- `ids.trakt`, `ids.imdb`, `ids.tmdb` → Foreign key relationships
- `genres[]` → Many-to-many relationship via `movie_genres` table
- `languages[]` → Many-to-many relationship via `movie_languages` table
- `stats.*` → Individual database columns
- `tmdb_data.*` → TMDB-specific columns
- `rating`, `votes` → Rating and voting data

### Generated Fields

- `movie_key`: Generated as `{title}_{year}` (sanitized)
- `x_coord`, `y_coord`: Random coordinates for visualization
- `depth`: Set to 0 for imported movies
- `cached_at`, `last_accessed`: Current timestamp

## Error Handling

The service includes comprehensive error handling:

- **File Access Errors**: Validates movies.json exists and is readable
- **Data Validation**: Checks for required fields and valid data types
- **Database Errors**: Handles constraint violations and connection issues
- **Batch Processing**: Continues processing even if individual movies fail
- **Detailed Logging**: Provides detailed error messages and progress tracking

## Database Schema Compatibility

The service is designed to work with the existing database schema:

- **Movies Table**: Main movie data storage
- **Genres Table**: Genre lookup table
- **Movie_Genres**: Many-to-many relationship
- **Languages Table**: Language lookup table
- **Movie_Languages**: Many-to-many relationship
- **App_Metadata**: Application statistics

## Performance Considerations

- **Batch Processing**: Processes movies in batches of 10 to avoid overwhelming the database
- **Transaction Safety**: Uses database transactions for data consistency
- **Memory Efficiency**: Streams data processing to handle large datasets
- **Connection Pooling**: Utilizes PostgreSQL connection pooling

## Monitoring and Logging

The service provides detailed logging:

- Import progress with batch information
- Success/failure counts
- Individual movie import status
- Error details for failed imports
- Performance metrics

## Example Usage

```javascript
const movieImportService = require('./src/services/movieImportService');

// Import all movies
const result = await movieImportService.importMoviesFromJson();
console.log(`Imported ${result.successCount} movies`);

// Import single movie
await movieImportService.importSingleMovie('Inception', 2010);

// Get statistics
const stats = await movieImportService.getImportStats();
console.log(`JSON: ${stats.jsonMovieCount}, DB: ${stats.dbMovieCount}`);
```

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is running and connection string is correct
2. **File Not Found**: Verify movies.json exists in `saved_networks/movie_cache/`
3. **Permission Errors**: Check file system permissions
4. **Memory Issues**: For large datasets, consider increasing Node.js memory limit

### Logs Location

Check application logs for detailed error information and import progress.