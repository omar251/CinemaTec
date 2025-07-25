// Auto-detect API base URL based on current location
const apiBase = window.location.port === '5000' ? '/api' : 
                window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' ? 
                `http://127.0.0.1:5000/api` : '/api';

export async function searchMovie(query) {
    try {
        const response = await fetch(`${apiBase}/search/movies/fast?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        return data[0]?.movie || null;
    } catch (error) {
        console.error('Search error:', error);
        return null;
    }
}

export async function getRelatedMovies(movieId) {
    try {
        const response = await fetch(`${apiBase}/movies/${movieId}/related/fast`);
        if (!response.ok) throw new Error('Failed to get related movies');
        const data = await response.json();
        return data.slice(0, 8); // Limit to 8 related movies
    } catch (error) {
        console.error('Related movies error:', error);
        return [];
    }
}

export async function getFullMovieDetails(movieId) {
    try {
        // First try to get from database cache
        console.log(`🎬 Getting movie details for ID: ${movieId}`);
        const cachedMovie = await getCachedMovie(movieId);
        
        if (cachedMovie && cachedMovie.fullDetails) {
            console.log(`✅ Using cached movie details for: ${cachedMovie.title} (${cachedMovie.year})`);
            return {
                success: true,
                movie: cachedMovie.fullDetails,
                source: 'database-cache'
            };
        }
        
        // If we have basic cached data but no full details, use what we have
        if (cachedMovie) {
            console.log(`⚠️ Using basic cached details for: ${cachedMovie.title} (${cachedMovie.year})`);
            return {
                success: true,
                movie: cachedMovie,
                source: 'database-cache-basic'
            };
        }
        
        // Fallback to API if not in cache
        console.log(`🌐 Fetching movie details from API for ID: ${movieId}`);
        const response = await fetch(`${apiBase}/movies/${movieId}/full`);
        if (!response.ok) throw new Error('Failed to get movie details');
        const data = await response.json();
        
        return {
            success: data.success !== false,
            movie: data.movie || data,
            source: 'api'
        };
    } catch (error) {
        console.error('Movie details error:', error);
        return null;
    }
}

export async function saveNetworkToServer(networkData) {
    try {
        const response = await fetch(`${apiBase}/networks/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(networkData)
        });

        if (!response.ok) throw new Error('Failed to save network');
        
        const result = await response.json();
        return result;

    } catch (error) {
        console.error('Save error:', error);
        throw error;
    }
}

export async function loadNetworkFromServer(networkId) {
    try {
        const response = await fetch(`${apiBase}/networks/${networkId}`);
        if (!response.ok) throw new Error('Failed to load network');
        
        const networkData = await response.json();
        return networkData;

    } catch (error) {
        console.error('Load error:', error);
        throw error;
    }
}

export async function getSavedNetworks() {
    try {
        const response = await fetch(`${apiBase}/networks`);
        if (!response.ok) throw new Error('Failed to get saved networks');
        
        const networks = await response.json();
        return networks;

    } catch (error) {
        console.error('Get networks error:', error);
        return [];
    }
}

export async function deleteNetworkFromServer(networkId) {
    try {
        const response = await fetch(`${apiBase}/networks/${networkId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete network');
        
        const result = await response.json();
        return result;

    } catch (error) {
        console.error('Delete error:', error);
        throw error;
    }
}

export async function updateNetworkOnServer(networkId, networkData) {
    try {
        const response = await fetch(`${apiBase}/networks/${networkId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(networkData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update network');
        }

        const result = await response.json();
        return { success: true, data: result };
    } catch (error) {
        console.error('Update network error:', error);
        throw error;
    }
}

export async function exportNetwork(networkId, format) {
    try {
        const response = await fetch(`${apiBase}/networks/${networkId}/export/${format}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `network.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            return true;
        } else {
            return false;
        }
        
    } catch (error) {
        console.error('Export error:', error);
        return false;
    }
}

// AI Integration functions
export async function generateMovieSynopsis(movieTitle, movieOverview) {
    try {
        const response = await fetch(`${apiBase}/ai/synopsis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                movieTitle,
                movieOverview
            })
        });

        if (!response.ok) {
            if (response.status === 503) {
                throw new Error('AI service not available');
            }
            throw new Error('Failed to generate synopsis');
        }

        const data = await response.json();
        return data.synopsis;
    } catch (error) {
        console.error('AI synopsis error:', error);
        throw error;
    }
}

export async function generateMovieInsights(selectedMovie, relatedMovies) {
    try {
        const response = await fetch(`${apiBase}/ai/insights`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                selectedMovie,
                relatedMovies
            })
        });

        if (!response.ok) {
            if (response.status === 503) {
                throw new Error('AI service not available');
            }
            throw new Error('Failed to generate insights');
        }

        const data = await response.json();
        return data.insights;
    } catch (error) {
        console.error('AI insights error:', error);
        throw error;
    }
}

export async function generateNetworkAnalysis(networkData) {
    try {
        const response = await fetch(`${apiBase}/ai/network-analysis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                networkData
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 503) {
                throw new Error('AI service not available - ' + (errorData.details || 'Gemini API key not configured'));
            }
            
            // Handle quota exceeded error specifically
            const errorMessage = errorData.details || errorData.error || 'Failed to generate analysis';
            if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Too Many Requests')) {
                throw new Error('AI quota exceeded - You have reached the daily limit of 50 free requests. Try again tomorrow or upgrade your plan.');
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data.analysis;
    } catch (error) {
        console.error('AI analysis error:', error);
        throw error;
    }
}

export async function checkAIHealth() {
    try {
        const response = await fetch(`${apiBase}/ai/health`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('AI health check error:', error);
        return { status: 'error', error: error.message };
    }
}

// Database-first cache functions

// Get all cached movies from database
export async function getCachedMovies(limit = 1000, offset = 0) {
    try {
        const response = await fetch(`${apiBase}/cache/movies?limit=${limit}&offset=${offset}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.success ? data.data.movies : [];
    } catch (error) {
        console.error('Error fetching cached movies from database:', error);
        return [];
    }
}

// Search movies in database cache
export async function searchCachedMovies(query, limit = 10) {
    try {
        const response = await fetch(`${apiBase}/cache/search?q=${encodeURIComponent(query)}&limit=${limit}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.success ? data.data.results : [];
    } catch (error) {
        console.error('Error searching cached movies in database:', error);
        return [];
    }
}

// Get comprehensive cache statistics from database
export async function getCacheStats() {
    try {
        const response = await fetch(`${apiBase}/cache/stats`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.success ? data.data : data; // Handle both new and old response formats
    } catch (error) {
        console.error('Error fetching cache stats from database:', error);
        return { 
            movieData: { database: { totalMovies: 0 } }, 
            memoryCache: {},
            type: 'database-first'
        };
    }
}

// Get movie from database cache by Trakt ID
export async function getCachedMovie(traktId) {
    try {
        const response = await fetch(`${apiBase}/cache/movie/${traktId}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.success ? data.data : null;
    } catch (error) {
        console.error('Error fetching cached movie from database:', error);
        return null;
    }
}

// Clear database cache
export async function clearCache(type = null) {
    try {
        const response = await fetch(`${apiBase}/cache/clear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type })
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Error clearing cache:', error);
        return false;
    }
}
