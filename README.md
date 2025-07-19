# Enhanced Trakt API Explorer

A modern web application for exploring movies using the Trakt API with a secure Python backend.

## Features

- 🎬 Search movies using the Trakt API
- ⭐ View movie ratings, stats, and detailed information
- 🖼️ Movie posters from TMDB API
- 🔗 Related movie recommendations
- 📱 Responsive design with glassmorphism UI
- 🔒 Secure API key handling via backend

## Architecture

- **Frontend**: HTML/CSS/JavaScript (Vanilla JS)
- **Backend**: Python Flask API
- **APIs**: Trakt.tv API + TMDB API (optional)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your API keys
nano .env
```

Required API keys:
- **Trakt API Key**: Get from [Trakt.tv OAuth Applications](https://trakt.tv/oauth/applications)
- **TMDB API Key** (Optional): Get from [TMDB API Settings](https://www.themoviedb.org/settings/api)

### 3. Run the Backend

```bash
# Development mode
python app.py

# Or with environment variables directly
TRAKT_API_KEY=your_key TMDB_API_KEY=your_key python app.py

# Production mode with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 4. Update Frontend Configuration

Open `index.html` and update the API base URL:

```javascript
// Change this line (around line 426)
const API_BASE_URL = "http://localhost:5000/api";
```

### 5. Open the Application

Open `index.html` in your browser or serve it with a local server:

```bash
# Using Python's built-in server
python -m http.server 8080

# Then visit: http://localhost:8080
```

## API Endpoints

### Movies
- `GET /api/search/movies?query={title}` - Search movies
- `GET /api/movies/{trakt_id}` - Get movie details
- `GET /api/movies/{trakt_id}/stats` - Get movie statistics
- `GET /api/movies/{trakt_id}/ratings` - Get movie ratings
- `GET /api/movies/{trakt_id}/related` - Get related movies

### Health Check
- `GET /api/health` - Check API status and configuration

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TRAKT_API_KEY` | Yes | Your Trakt.tv API client ID |
| `TMDB_API_KEY` | No | TMDB API key for movie posters |
| `FLASK_ENV` | No | Flask environment (development/production) |
| `PORT` | No | Server port (default: 5000) |

## Security Features

- ✅ API keys stored securely in environment variables
- ✅ CORS enabled for frontend communication
- ✅ Request timeout protection
- ✅ Error handling and logging
- ✅ Input validation

## Deployment

### Docker (Optional)

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

### Heroku

```bash
# Create Procfile
echo "web: gunicorn app:app" > Procfile

# Deploy
git add .
git commit -m "Add Python backend"
heroku create your-app-name
heroku config:set TRAKT_API_KEY=your_key
heroku config:set TMDB_API_KEY=your_key
git push heroku main
```

## Development

### Project Structure

```
├── app.py              # Flask backend API
├── index.html          # Frontend application
├── requirements.txt    # Python dependencies
├── .env.example       # Environment variables template
└── README.md          # This file
```

### Adding New Features

1. Add new API endpoints in `app.py`
2. Update frontend JavaScript to use new endpoints
3. Test with the health check endpoint: `/api/health`

## Troubleshooting

### Common Issues

1. **"TRAKT_API_KEY environment variable is required"**
   - Make sure you've set the environment variable
   - Check your `.env` file exists and has the correct key

2. **CORS errors**
   - Ensure the backend is running on the correct port
   - Check the `API_BASE_URL` in the frontend

3. **No movie posters**
   - TMDB API key is optional but required for posters
   - Check your TMDB API key is valid

### Logs

Check the backend logs for detailed error information:

```bash
# The Flask app logs all requests and errors
python app.py
```

## License

MIT License - feel free to use this project for learning and development.