-- CinemaTec Explorer Database Schema
-- PostgreSQL 14.18

-- Table for global application metadata
CREATE TABLE app_metadata (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    total_movies INTEGER,
    total_connections INTEGER,
    seed_movie VARCHAR(255),
    max_depth INTEGER,
    average_rating DECIMAL(3,1),
    -- Storing genres as a TEXT array or JSONB for simplicity in metadata,
    -- as it's a global list and not a many-to-many relationship here.
    global_genres TEXT[] -- Or VARCHAR(255)[] or JSONB if your SQL dialect supports it
);

-- Table for individual movies
CREATE TABLE movies (
    movie_key VARCHAR(255) PRIMARY KEY, -- Unique identifier for each movie
    internal_id INTEGER,               -- Corresponds to 'id' in your JSON node
    title VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    trakt_id INTEGER UNIQUE,
    imdb_id VARCHAR(20) UNIQUE,
    tmdb_id INTEGER UNIQUE,
    depth INTEGER,
    x_coord DECIMAL(10,8),
    y_coord DECIMAL(10,8),
    is_new BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    vx DECIMAL(10,8),
    vy DECIMAL(10,8),
    fx DECIMAL(10,8), -- Nullable
    fy DECIMAL(10,8), -- Nullable
    expanding BOOLEAN DEFAULT FALSE,
    tagline TEXT,
    overview TEXT,
    released_date DATE,
    runtime_minutes INTEGER,
    country VARCHAR(10),
    trailer_url VARCHAR(512),
    homepage_url VARCHAR(512), -- Nullable
    status VARCHAR(50),
    overall_rating DECIMAL(3,2), -- From fullDetails.ratings.rating
    total_votes INTEGER,         -- From fullDetails.ratings.votes
    comment_count INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE,
    primary_language VARCHAR(10),
    certification VARCHAR(20),
    original_title VARCHAR(255),
    has_after_credits BOOLEAN DEFAULT FALSE,
    has_during_credits BOOLEAN DEFAULT FALSE,
    stats_watchers INTEGER,
    stats_plays INTEGER,
    stats_collectors INTEGER,
    stats_comments INTEGER,
    stats_lists INTEGER,
    stats_favorited INTEGER,
    stats_recommended INTEGER,
    poster_url VARCHAR(512),
    tmdb_backdrop_path VARCHAR(512),
    tmdb_popularity DECIMAL(10,8),
    tmdb_poster_path VARCHAR(512),
    tmdb_video BOOLEAN,
    tmdb_vote_average DECIMAL(3,2),
    tmdb_vote_count INTEGER,
    cached_at TIMESTAMP WITH TIME ZONE,
    last_accessed TIMESTAMP WITH TIME ZONE,
    cache_version VARCHAR(20)
    -- basicDetails is an empty map, so no columns are created for it.
);

-- Lookup table for genres
CREATE TABLE genres (
    genre_name VARCHAR(50) PRIMARY KEY
);

-- Junction table for many-to-many relationship between movies and genres
CREATE TABLE movie_genres (
    movie_key VARCHAR(255) NOT NULL,
    genre_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (movie_key, genre_name),
    FOREIGN KEY (movie_key) REFERENCES movies (movie_key) ON DELETE CASCADE,
    FOREIGN KEY (genre_name) REFERENCES genres (genre_name) ON DELETE CASCADE
);

-- Lookup table for subgenres
CREATE TABLE subgenres (
    subgenre_name VARCHAR(50) PRIMARY KEY
);

-- Junction table for many-to-many relationship between movies and subgenres
CREATE TABLE movie_subgenres (
    movie_key VARCHAR(255) NOT NULL,
    subgenre_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (movie_key, subgenre_name),
    FOREIGN KEY (movie_key) REFERENCES movies (movie_key) ON DELETE CASCADE,
    FOREIGN KEY (subgenre_name) REFERENCES subgenres (subgenre_name) ON DELETE CASCADE
);

-- Lookup table for languages (spoken in movies)
CREATE TABLE languages (
    language_code VARCHAR(10) PRIMARY KEY -- e.g., 'en', 'fr'
);

-- Junction table for many-to-many relationship between movies and spoken languages
CREATE TABLE movie_languages (
    movie_key VARCHAR(255) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    PRIMARY KEY (movie_key, language_code),
    FOREIGN KEY (movie_key) REFERENCES movies (movie_key) ON DELETE CASCADE,
    FOREIGN KEY (language_code) REFERENCES languages (language_code) ON DELETE CASCADE
);

-- Lookup table for available translation languages
CREATE TABLE available_translations (
    translation_code VARCHAR(10) PRIMARY KEY -- e.g., 'es', 'de'
);

-- Junction table for many-to-many relationship between movies and available translations
CREATE TABLE movie_available_translations (
    movie_key VARCHAR(255) NOT NULL,
    translation_code VARCHAR(10) NOT NULL,
    PRIMARY KEY (movie_key, translation_code),
    FOREIGN KEY (movie_key) REFERENCES movies (movie_key) ON DELETE CASCADE,
    FOREIGN KEY (translation_code) REFERENCES available_translations (translation_code) ON DELETE CASCADE
);

-- Table to store the rating distribution for each movie
CREATE TABLE movie_rating_distribution (
    movie_key VARCHAR(255) NOT NULL,
    rating_value INTEGER NOT NULL, -- 0 to 10
    vote_count INTEGER NOT NULL,
    PRIMARY KEY (movie_key, rating_value),
    FOREIGN KEY (movie_key) REFERENCES movies (movie_key) ON DELETE CASCADE,
    CHECK (rating_value >= 0 AND rating_value <= 10)
);

-- Table for movie connections/links in the network
CREATE TABLE movie_connections (
    id SERIAL PRIMARY KEY,
    source_movie_key VARCHAR(255) NOT NULL,
    target_movie_key VARCHAR(255) NOT NULL,
    connection_type VARCHAR(50) DEFAULT 'related',
    strength DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (source_movie_key) REFERENCES movies (movie_key) ON DELETE CASCADE,
    FOREIGN KEY (target_movie_key) REFERENCES movies (movie_key) ON DELETE CASCADE,
    UNIQUE(source_movie_key, target_movie_key)
);

-- Table for saved networks
CREATE TABLE saved_networks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    movie_count INTEGER DEFAULT 0,
    connection_count INTEGER DEFAULT 0,
    settings JSONB
);

-- Junction table for movies in saved networks
CREATE TABLE network_movies (
    network_id INTEGER NOT NULL,
    movie_key VARCHAR(255) NOT NULL,
    position_x DECIMAL(10,8),
    position_y DECIMAL(10,8),
    depth INTEGER,
    PRIMARY KEY (network_id, movie_key),
    FOREIGN KEY (network_id) REFERENCES saved_networks (id) ON DELETE CASCADE,
    FOREIGN KEY (movie_key) REFERENCES movies (movie_key) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_movies_trakt_id ON movies (trakt_id);
CREATE INDEX idx_movies_imdb_id ON movies (imdb_id);
CREATE INDEX idx_movies_tmdb_id ON movies (tmdb_id);
CREATE INDEX idx_movies_year ON movies (year);
CREATE INDEX idx_movies_overall_rating ON movies (overall_rating);
CREATE INDEX idx_movies_is_favorite ON movies (is_favorite);
CREATE INDEX idx_movies_depth ON movies (depth);
CREATE INDEX idx_movies_cached_at ON movies (cached_at);
CREATE INDEX idx_movie_genres_movie_key ON movie_genres (movie_key);
CREATE INDEX idx_movie_genres_genre_name ON movie_genres (genre_name);
CREATE INDEX idx_movie_connections_source ON movie_connections (source_movie_key);
CREATE INDEX idx_movie_connections_target ON movie_connections (target_movie_key);
CREATE INDEX idx_network_movies_network_id ON network_movies (network_id);

-- Insert some default data
INSERT INTO app_metadata (id, name, description, created_at, updated_at, total_movies, total_connections, max_depth, average_rating)
VALUES ('default', 'CinemaTec Explorer', 'AI-Powered Movie Network Visualization', NOW(), NOW(), 0, 0, 0, 0.0);

-- Insert common genres
INSERT INTO genres (genre_name) VALUES 
('Action'), ('Adventure'), ('Animation'), ('Comedy'), ('Crime'), 
('Documentary'), ('Drama'), ('Family'), ('Fantasy'), ('History'),
('Horror'), ('Music'), ('Mystery'), ('Romance'), ('Science Fiction'),
('Thriller'), ('War'), ('Western'), ('Biography'), ('Sport');

-- Insert common languages
INSERT INTO languages (language_code) VALUES 
('en'), ('es'), ('fr'), ('de'), ('it'), ('ja'), ('ko'), ('zh'), 
('ru'), ('pt'), ('ar'), ('hi'), ('th'), ('tr'), ('pl'), ('nl');

-- Insert common translation languages
INSERT INTO available_translations (translation_code) VALUES 
('en'), ('es'), ('fr'), ('de'), ('it'), ('ja'), ('ko'), ('zh'), 
('ru'), ('pt'), ('ar'), ('hi'), ('th'), ('tr'), ('pl'), ('nl');