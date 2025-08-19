# CinemaTec Explorer - Gemini Context

This document provides an overview of the CinemaTec Explorer project, its architecture, how to build and run it, and key development conventions. It is intended to serve as a comprehensive guide for understanding and interacting with the codebase.

## Project Overview

CinemaTec Explorer is a modern web application designed for exploring movie connections and insights. It features an interactive network visualization, enhanced search capabilities, and AI-powered functionalities.

**Key Features:**
*   **Movie Search & Network Visualization:** Search for movies and visualize their relationships in an interactive network graph.
*   **AI-Powered Chat & Insights:** Engage with an AI assistant to get movie recommendations, analyze your current network, and receive insights, with Text-to-Speech (TTS) capabilities for AI responses.
*   **Network Management:** Save, load, and export your movie networks.
*   **Dynamic Coloring & Filtering:** Color network nodes based on various attributes (e.g., depth, year, genre, rating, popularity, runtime) and apply filters.
*   **Responsive Design:** A modern, glassmorphism-inspired user interface.

**Technologies & Architecture:**
*   **Frontend:** Vanilla JavaScript, HTML, CSS (with D3.js for network visualization).
*   **Backend:** Node.js with Express.js for the API.
*   **APIs:** Trakt.tv API (movie data), TMDB API (movie posters), and various AI providers (Gemini, OpenAI, Groq).
*   **Database:** PostgreSQL (used via `pg` and `pg-pool` libraries).
*   **Containerization:** Docker and Docker Compose for development and deployment.
*   **TTS:** Microsoft Edge TTS via `@andresaya/edge-tts` for speech synthesis.

## Building and Running

### Prerequisites

*   Node.js (>=16.0.0)
*   npm (Node Package Manager)
*   Docker and Docker Compose (for containerized setup)
*   API Keys:
    *   **Trakt API Key**: Required. Obtain from [Trakt.tv OAuth Applications](https://trakt.tv/oauth/applications).
    *   **TMDB API Key** (Optional): For movie posters. Obtain from [TMDB API Settings](https://www.themoviedb.org/settings/api).
    *   **AI API Key** (Optional): For AI features (Gemini, OpenAI, or Groq). Configure in `.env`.

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your API keys:

```bash
cp .env.example .env
# Edit .env and add your API keys
nano .env
```

**Required Environment Variables:**
*   `TRAKT_API_KEY`: Your Trakt.tv API client ID.

**Optional Environment Variables:**
*   `TMDB_API_KEY`: TMDB API key for movie posters.
*   `AI_PROVIDER`: Choose `gemini`, `openai`, or `groq`.
*   `GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`: Corresponding API keys for your chosen AI provider.
*   `GEMINI_MODEL`, `OPENAI_MODEL`, `GROQ_MODEL`: Specific models for AI providers.
*   `NODE_ENV`: Node.js environment (e.g., `development`, `production`).
*   `PORT`: Server port (default: `5000`).
*   `DATABASE_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL database connection details.
*   `TTS_ENABLED`, `TTS_VOICE`, `TTS_RATE`, `TTS_PITCH`: Text-to-Speech configuration.

### 3. Run the Application

#### Using npm scripts (Development)

```bash
# Start the server (production mode)
npm start

# Start with auto-reload (requires nodemon, for development)
npm run dev

# Smart startup with environment checks
npm run quick-start
```

#### Using Docker Compose (Recommended for full stack with PostgreSQL)

```bash
docker-compose up --build
```

The application will be accessible at `http://localhost:5000`. The frontend `public/index.html` can be opened directly in a browser or served with a local static server (e.g., `python -m http.server 8080`).

### 4. Testing

```bash
# Run performance tests
npm test

# Test migration from Python (legacy)
npm run test-migration

# Test AI integration
npm run test-ai

# Test Gemini API specifically
npm run test-gemini

# Test movie cache
npm run test-cache
```

### 5. Health Check

To check the API status and configuration:

```bash
curl http://localhost:5000/api/health
```

## Development Conventions

*   **Code Structure:**
    *   `src/`: Backend Node.js Express application.
        *   `server.js`: Main server entry point.
        *   `config/`: Application configuration.
        *   `middleware/`: Express middleware.
        *   `routes/`: API route definitions.
        *   `services/`: Business logic and external API integrations (e.g., `traktService.js`, `aiService.js`, `ttsService.js`).
        *   `utils/`: Utility functions (e.g., `logger.js`).
        *   `lib/`: Backend utility libraries (e.g., `network_storage.js`).
    *   `public/`: Frontend static files.
        *   `index.html`: Main HTML page.
        *   `static/js/`: Frontend JavaScript modules (`app.js`, `lib/api.js`, `lib/network.js`, `lib/tts.js`, `lib/ui.js`, `lib/mouseNav.js`).
        *   `styles/`: CSS files.
    *   `scripts/`: Various utility scripts (e.g., `network_generator.js`, `performance_test.js`, `start_node.js`, `tts/runEdgeTTS.mjs`).
    *   `database/`: SQL initialization scripts.
    *   `docs/`: Project documentation.
    *   `archive/`: Legacy Python files.
*   **API Key Handling:** API keys are managed via environment variables (`.env` file) and accessed through the `src/config/index.js`.
*   **Logging:** Uses a `logger` utility (likely Winston or similar) for structured logging.
*   **Error Handling:** Centralized error handling middleware in `src/middleware/index.js`.
*   **Caching:** Utilizes a `cacheService` for API responses and enhanced data.
*   **AI Integration:** Designed to be provider-agnostic, supporting Gemini, OpenAI, and Groq via a factory pattern (`src/services/ai/providerFactory.js`).
*   **Frontend Modules:** Frontend JavaScript is modularized using ES Modules (`import/export`).
*   **CSS:** Organized into separate files for animations, components, hover effects, main styles, and responsiveness.
*   **Git:** Standard Git workflow is expected.
