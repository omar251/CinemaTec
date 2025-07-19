from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from urllib.parse import urlencode
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# API Configuration from environment variables
TRAKT_API_KEY = os.getenv('TRAKT_API_KEY')
TMDB_API_KEY = os.getenv('TMDB_API_KEY')
TRAKT_BASE_URL = "https://api.trakt.tv"
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

# Validate required environment variables
if not TRAKT_API_KEY:
    logger.error("TRAKT_API_KEY environment variable is required")
    raise ValueError("TRAKT_API_KEY environment variable is required")

if not TMDB_API_KEY:
    logger.warning("TMDB_API_KEY not provided - poster images will not be available")

def make_trakt_request(endpoint, params=None):
    """Make a request to the Trakt API with proper headers."""
    url = f"{TRAKT_BASE_URL}{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": TRAKT_API_KEY,
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Trakt API request failed: {e}")
        raise

def make_tmdb_request(endpoint, params=None):
    """Make a request to the TMDB API."""
    if not TMDB_API_KEY:
        return None
        
    url = f"{TMDB_BASE_URL}{endpoint}"
    if params is None:
        params = {}
    params['api_key'] = TMDB_API_KEY
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"TMDB API request failed: {e}")
        return None

@app.route('/api/search/movies', methods=['GET'])
def search_movies():
    """Search for movies using the Trakt API."""
    query = request.args.get('query', '').strip()
    
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    
    try:
        # Search movies on Trakt
        data = make_trakt_request('/search/movie', {'query': query})
        
        if not data:
            return jsonify([])
        
        # Filter only movie results
        movies = [item for item in data if item.get('movie')]
        
        # Enhance with additional data
        enhanced_movies = []
        for item in movies:
            movie = item['movie']
            enhanced_item = item.copy()
            
            try:
                # Get movie stats and ratings
                stats = make_trakt_request(f"/movies/{movie['ids']['trakt']}/stats")
                ratings = make_trakt_request(f"/movies/{movie['ids']['trakt']}/ratings")
                
                enhanced_item['stats'] = stats
                enhanced_item['ratings'] = ratings
                
                # Get poster from TMDB
                if TMDB_API_KEY:
                    tmdb_data = make_tmdb_request('/search/movie', {
                        'query': movie['title'],
                        'year': movie.get('year', '')
                    })
                    
                    if tmdb_data and tmdb_data.get('results'):
                        poster_path = tmdb_data['results'][0].get('poster_path')
                        if poster_path:
                            enhanced_item['posterUrl'] = f"{TMDB_IMAGE_BASE}{poster_path}"
                
            except Exception as e:
                logger.warning(f"Error enhancing movie {movie['title']}: {e}")
                # Continue with basic data if enhancement fails
            
            enhanced_movies.append(enhanced_item)
        
        return jsonify(enhanced_movies)
        
    except Exception as e:
        logger.error(f"Error searching movies: {e}")
        return jsonify({'error': 'Failed to search movies'}), 500

@app.route('/api/movies/<int:trakt_id>', methods=['GET'])
def get_movie_details(trakt_id):
    """Get detailed information about a specific movie."""
    try:
        movie_details = make_trakt_request(f"/movies/{trakt_id}")
        return jsonify(movie_details)
    except Exception as e:
        logger.error(f"Error getting movie details: {e}")
        return jsonify({'error': 'Failed to get movie details'}), 500

@app.route('/api/movies/<int:trakt_id>/stats', methods=['GET'])
def get_movie_stats(trakt_id):
    """Get statistics for a specific movie."""
    try:
        stats = make_trakt_request(f"/movies/{trakt_id}/stats")
        return jsonify(stats)
    except Exception as e:
        logger.error(f"Error getting movie stats: {e}")
        return jsonify({'error': 'Failed to get movie stats'}), 500

@app.route('/api/movies/<int:trakt_id>/ratings', methods=['GET'])
def get_movie_ratings(trakt_id):
    """Get ratings for a specific movie."""
    try:
        ratings = make_trakt_request(f"/movies/{trakt_id}/ratings")
        return jsonify(ratings)
    except Exception as e:
        logger.error(f"Error getting movie ratings: {e}")
        return jsonify({'error': 'Failed to get movie ratings'}), 500

@app.route('/api/movies/<int:trakt_id>/related', methods=['GET'])
def get_related_movies(trakt_id):
    """Get movies related to a specific movie."""
    try:
        related_movies = make_trakt_request(f"/movies/{trakt_id}/related")
        
        # Enhance related movies with ratings and posters
        enhanced_related = []
        for movie in related_movies[:12]:  # Limit to 12 movies
            enhanced_movie = movie.copy()
            
            try:
                # Get ratings
                ratings = make_trakt_request(f"/movies/{movie['ids']['trakt']}/ratings")
                enhanced_movie['rating'] = ratings.get('rating', 0)
                
                # Get poster from TMDB
                if TMDB_API_KEY:
                    tmdb_data = make_tmdb_request('/search/movie', {
                        'query': movie['title'],
                        'year': movie.get('year', '')
                    })
                    
                    if tmdb_data and tmdb_data.get('results'):
                        poster_path = tmdb_data['results'][0].get('poster_path')
                        if poster_path:
                            enhanced_movie['posterUrl'] = f"{TMDB_IMAGE_BASE}{poster_path}"
                
            except Exception as e:
                logger.warning(f"Error enhancing related movie {movie['title']}: {e}")
                enhanced_movie['rating'] = 0
            
            enhanced_related.append(enhanced_movie)
        
        return jsonify(enhanced_related)
        
    except Exception as e:
        logger.error(f"Error getting related movies: {e}")
        return jsonify({'error': 'Failed to get related movies'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'trakt_api_configured': bool(TRAKT_API_KEY),
        'tmdb_api_configured': bool(TMDB_API_KEY)
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)