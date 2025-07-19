from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import asyncio
import aiohttp
import logging
from concurrent.futures import ThreadPoolExecutor
import time

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

# Thread pool for concurrent requests
executor = ThreadPoolExecutor(max_workers=10)

def make_trakt_request(endpoint, params=None):
    """Make a request to the Trakt API with proper headers."""
    url = f"{TRAKT_BASE_URL}{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": TRAKT_API_KEY,
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Trakt API request failed: {e}")
        return None

def make_tmdb_request(endpoint, params=None):
    """Make a request to the TMDB API."""
    if not TMDB_API_KEY:
        return None
        
    url = f"{TMDB_BASE_URL}{endpoint}"
    if params is None:
        params = {}
    params['api_key'] = TMDB_API_KEY
    
    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"TMDB API request failed: {e}")
        return None

def enhance_movie_data(movie_item):
    """Enhance a single movie with stats, ratings, and poster."""
    movie = movie_item['movie']
    enhanced_item = movie_item.copy()
    
    try:
        # Use ThreadPoolExecutor to make concurrent requests
        futures = []
        
        # Submit all requests concurrently
        stats_future = executor.submit(make_trakt_request, f"/movies/{movie['ids']['trakt']}/stats")
        ratings_future = executor.submit(make_trakt_request, f"/movies/{movie['ids']['trakt']}/ratings")
        
        poster_future = None
        if TMDB_API_KEY:
            poster_future = executor.submit(make_tmdb_request, '/search/movie', {
                'query': movie['title'],
                'year': movie.get('year', '')
            })
        
        # Collect results
        stats = stats_future.result(timeout=3)
        ratings = ratings_future.result(timeout=3)
        
        if stats:
            enhanced_item['stats'] = stats
        if ratings:
            enhanced_item['ratings'] = ratings
        
        # Handle poster
        if poster_future:
            tmdb_data = poster_future.result(timeout=3)
            if tmdb_data and tmdb_data.get('results'):
                poster_path = tmdb_data['results'][0].get('poster_path')
                if poster_path:
                    enhanced_item['posterUrl'] = f"{TMDB_IMAGE_BASE}{poster_path}"
        
    except Exception as e:
        logger.warning(f"Error enhancing movie {movie['title']}: {e}")
    
    return enhanced_item

def enhance_related_movie(movie):
    """Enhance a single related movie with rating and poster."""
    enhanced_movie = movie.copy()
    
    try:
        # Submit concurrent requests
        ratings_future = executor.submit(make_trakt_request, f"/movies/{movie['ids']['trakt']}/ratings")
        
        poster_future = None
        if TMDB_API_KEY:
            poster_future = executor.submit(make_tmdb_request, '/search/movie', {
                'query': movie['title'],
                'year': movie.get('year', '')
            })
        
        # Get results
        ratings = ratings_future.result(timeout=2)
        enhanced_movie['rating'] = ratings.get('rating', 0) if ratings else 0
        
        if poster_future:
            tmdb_data = poster_future.result(timeout=2)
            if tmdb_data and tmdb_data.get('results'):
                poster_path = tmdb_data['results'][0].get('poster_path')
                if poster_path:
                    enhanced_movie['posterUrl'] = f"{TMDB_IMAGE_BASE}{poster_path}"
        
    except Exception as e:
        logger.warning(f"Error enhancing related movie {movie['title']}: {e}")
        enhanced_movie['rating'] = 0
    
    return enhanced_movie

@app.route('/api/search/movies', methods=['GET'])
def search_movies():
    """Search for movies using the Trakt API with optimized concurrent enhancement."""
    start_time = time.time()
    query = request.args.get('query', '').strip()
    
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    
    try:
        # Search movies on Trakt
        data = make_trakt_request('/search/movie', {'query': query})
        
        if not data:
            return jsonify([])
        
        # Filter only movie results and limit to first 10 for performance
        movies = [item for item in data if item.get('movie')][:10]
        
        # Use ThreadPoolExecutor to enhance movies concurrently
        enhanced_movies = []
        with ThreadPoolExecutor(max_workers=5) as pool:
            futures = [pool.submit(enhance_movie_data, item) for item in movies]
            
            for future in futures:
                try:
                    enhanced_movie = future.result(timeout=5)
                    enhanced_movies.append(enhanced_movie)
                except Exception as e:
                    logger.warning(f"Failed to enhance movie: {e}")
        
        end_time = time.time()
        logger.info(f"Search completed in {end_time - start_time:.2f} seconds")
        
        return jsonify(enhanced_movies)
        
    except Exception as e:
        logger.error(f"Error searching movies: {e}")
        return jsonify({'error': 'Failed to search movies'}), 500

@app.route('/api/search/movies/fast', methods=['GET'])
def search_movies_fast():
    """Fast search that returns basic data immediately, enhancement optional."""
    query = request.args.get('query', '').strip()
    
    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400
    
    try:
        # Search movies on Trakt
        data = make_trakt_request('/search/movie', {'query': query})
        
        if not data:
            return jsonify([])
        
        # Return basic data immediately without enhancement
        movies = [item for item in data if item.get('movie')][:15]
        
        return jsonify(movies)
        
    except Exception as e:
        logger.error(f"Error searching movies: {e}")
        return jsonify({'error': 'Failed to search movies'}), 500

@app.route('/api/movies/<int:trakt_id>/enhance', methods=['GET'])
def enhance_movie(trakt_id):
    """Enhance a specific movie with stats, ratings, and poster."""
    try:
        # Find the movie first
        movie_data = make_trakt_request(f"/movies/{trakt_id}")
        if not movie_data:
            return jsonify({'error': 'Movie not found'}), 404
        
        # Create a movie item structure
        movie_item = {'movie': movie_data}
        enhanced = enhance_movie_data(movie_item)
        
        return jsonify(enhanced)
        
    except Exception as e:
        logger.error(f"Error enhancing movie: {e}")
        return jsonify({'error': 'Failed to enhance movie'}), 500

@app.route('/api/movies/<int:trakt_id>', methods=['GET'])
def get_movie_details(trakt_id):
    """Get detailed information about a specific movie."""
    try:
        movie_details = make_trakt_request(f"/movies/{trakt_id}")
        return jsonify(movie_details)
    except Exception as e:
        logger.error(f"Error getting movie details: {e}")
        return jsonify({'error': 'Failed to get movie details'}), 500

@app.route('/api/movies/<int:trakt_id>/related', methods=['GET'])
def get_related_movies(trakt_id):
    """Get movies related to a specific movie with optimized enhancement."""
    start_time = time.time()
    
    try:
        related_movies = make_trakt_request(f"/movies/{trakt_id}/related")
        
        if not related_movies:
            return jsonify([])
        
        # Limit to 8 movies for better performance
        movies_to_enhance = related_movies[:8]
        
        # Use ThreadPoolExecutor for concurrent enhancement
        enhanced_related = []
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(enhance_related_movie, movie) for movie in movies_to_enhance]
            
            for future in futures:
                try:
                    enhanced_movie = future.result(timeout=3)
                    enhanced_related.append(enhanced_movie)
                except Exception as e:
                    logger.warning(f"Failed to enhance related movie: {e}")
        
        end_time = time.time()
        logger.info(f"Related movies completed in {end_time - start_time:.2f} seconds")
        
        return jsonify(enhanced_related)
        
    except Exception as e:
        logger.error(f"Error getting related movies: {e}")
        return jsonify({'error': 'Failed to get related movies'}), 500

@app.route('/api/movies/<int:trakt_id>/related/fast', methods=['GET'])
def get_related_movies_fast(trakt_id):
    """Get related movies without enhancement for speed."""
    try:
        related_movies = make_trakt_request(f"/movies/{trakt_id}/related")
        
        if not related_movies:
            return jsonify([])
        
        # Return first 12 movies without enhancement
        return jsonify(related_movies[:12])
        
    except Exception as e:
        logger.error(f"Error getting related movies: {e}")
        return jsonify({'error': 'Failed to get related movies'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'trakt_api_configured': bool(TRAKT_API_KEY),
        'tmdb_api_configured': bool(TMDB_API_KEY),
        'optimization': 'enabled'
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