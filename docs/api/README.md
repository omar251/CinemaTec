# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Endpoints

### Health Check
- **GET** `/health` - Check API status and configuration

### Movies
- **GET** `/search/movies?query={title}` - Search movies (enhanced with full details)
- **GET** `/search/movies/fast?query={title}` - Fast search (basic data only)
- **GET** `/movies/{trakt_id}` - Get movie details
- **GET** `/movies/{trakt_id}/enhance` - Enhance specific movie with additional data
- **GET** `/movies/{trakt_id}/related` - Get related movies (enhanced)
- **GET** `/movies/{trakt_id}/related/fast` - Get related movies (fast)

### Networks
- **GET** `/networks` - Get all saved networks
- **GET** `/networks/{id}` - Get specific network
- **POST** `/networks/save` - Save a network
- **DELETE** `/networks/{id}` - Delete a network
- **GET** `/networks/{id}/export/{format}` - Export network (json, csv, etc.)

### AI Features (Optional)
- **POST** `/ai/synopsis` - Generate AI synopsis for movie
- **POST** `/ai/recommendations` - Get AI-powered recommendations

## Response Format

All endpoints return JSON with consistent error handling:

```json
{
  "success": true,
  "data": {...},
  "error": null
}
```

## Rate Limiting

Currently no rate limiting is implemented, but the backend is designed to handle it when needed.