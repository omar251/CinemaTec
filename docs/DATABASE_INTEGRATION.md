# Database Integration Guide

CinemaTec Explorer now supports PostgreSQL database integration for persistent storage of movie data, favorites, and network connections.

## 🚀 Quick Start

### 1. Start PostgreSQL with Docker

```bash
# Start PostgreSQL container
docker-compose up postgres -d

# Or pull and run manually
docker pull postgres:14.18
docker run -d \
  --name cinematec_postgres \
  -e POSTGRES_DB=cinematec_explorer \
  -e POSTGRES_USER=cinematec_user \
  -e POSTGRES_PASSWORD=cinematec_password \
  -p 5432:5432 \
  postgres:14.18
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update database settings:

```bash
DATABASE_URL=postgresql://cinematec_user:cinematec_password@localhost:5432/cinematec_explorer
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cinematec_explorer
DB_USER=cinematec_user
DB_PASSWORD=cinematec_password
```

### 3. Start the Application

```bash
npm install
npm start
```

The database schema will be automatically created on first connection.

## 📊 Database Schema

### Core Tables

- **`movies`** - Complete movie data with ratings, metadata, and cache info
- **`movie_genres`** - Many-to-many relationship for movie genres
- **`movie_languages`** - Many-to-many relationship for spoken languages
- **`movie_connections`** - Network connections between movies
- **`app_metadata`** - Global application statistics

### Lookup Tables

- **`genres`** - Master list of movie genres
- **`languages`** - ISO language codes
- **`available_translations`** - Available subtitle languages

### Advanced Features

- **`movie_rating_distribution`** - Detailed rating breakdowns (0-10)
- **`saved_networks`** - Persistent network configurations
- **`network_movies`** - Movies within saved networks

## 🔌 API Endpoints

### Database Status
```
GET /api/database/status
```
Returns database connection status and metadata.

### Movie Operations
```
GET /api/database/movies              # Get all movies
GET /api/database/movies/favorites    # Get favorite movies
GET /api/database/movies/:movieKey    # Get specific movie
POST /api/database/movies             # Save movie
PATCH /api/database/movies/:movieKey/favorite  # Update favorite status
```

### Network Operations
```
POST /api/database/sync               # Sync current network to database
GET /api/database/load                # Load network from database
POST /api/database/connections        # Save movie connection
GET /api/database/movies/:movieKey/connections  # Get movie connections
```

## 💾 Data Persistence

### Automatic Saving
- Movies are automatically saved when added to the network
- Favorite status is persisted across sessions
- Network connections are tracked and stored

### Manual Sync
Use the sync endpoint to save your entire current network:

```javascript
// Sync current network
fetch('/api/database/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nodes: currentNetworkNodes,
    links: currentNetworkLinks
  })
});
```

### Loading Saved Data
```javascript
// Load network from database
fetch('/api/database/load')
  .then(response => response.json())
  .then(data => {
    // data.nodes - all saved movies
    // data.links - all saved connections
    // data.metadata - app statistics
  });
```

## 🎯 Features

### Enhanced Favorites
- Favorites are now stored in the database
- Persistent across browser sessions
- Can be accessed from any device

### Network Persistence
- Save entire movie networks
- Restore previous exploration sessions
- Track connection patterns over time

### Advanced Analytics
- Rating distribution analysis
- Genre popularity tracking
- Network depth statistics
- User behavior insights

### Performance Benefits
- Faster movie lookups from local database
- Reduced API calls for cached data
- Improved response times for large networks

## 🔧 Configuration

### Connection Pooling
The database service uses connection pooling for optimal performance:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### Caching Strategy
- Movie data is cached with timestamps
- Cache version tracking for data migration
- Last accessed tracking for cleanup

### Error Handling
- Automatic reconnection on connection loss
- Transaction rollback on errors
- Graceful degradation when database is unavailable

## 🐳 Docker Deployment

### Full Stack with Docker Compose
```bash
# Start both database and application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Deployment
For production, consider:
- Using managed PostgreSQL (AWS RDS, Google Cloud SQL)
- Setting up database backups
- Configuring SSL connections
- Implementing connection pooling

## 🔍 Monitoring

### Health Checks
```bash
# Check database status
curl http://localhost:5000/api/database/status

# Check application health
curl http://localhost:5000/api/health
```

### Logs
Database operations are logged with different levels:
- `INFO` - Connection status, successful operations
- `DEBUG` - Query execution times
- `ERROR` - Connection failures, query errors
- `WARN` - Non-critical issues

## 🚨 Troubleshooting

### Connection Issues
1. Verify PostgreSQL is running: `docker ps`
2. Check environment variables in `.env`
3. Ensure port 5432 is not blocked
4. Check database logs: `docker logs cinematec_postgres`

### Performance Issues
1. Monitor connection pool usage
2. Check for long-running queries
3. Analyze database indexes
4. Consider query optimization

### Data Issues
1. Verify schema is up to date
2. Check for foreign key constraints
3. Validate data types and formats
4. Review transaction logs

## 📈 Future Enhancements

- Real-time collaboration features
- Advanced search and filtering
- Data export/import capabilities
- Machine learning insights
- Social features and sharing