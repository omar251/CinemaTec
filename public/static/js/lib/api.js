const apiBase = '/api';

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
        const response = await fetch(`${apiBase}/movies/${movieId}/full`);
        if (!response.ok) throw new Error('Failed to get movie details');
        const data = await response.json();
        return data;
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
            if (response.status === 503) {
                throw new Error('AI service not available');
            }
            throw new Error('Failed to generate analysis');
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
