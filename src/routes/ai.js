/**
 * AI integration routes (provider-agnostic)
 */
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const ttsService = require('../services/ttsService');
const logger = require('../utils/logger');

// Generate AI synopsis for a movie
router.post('/synopsis', async (req, res) => {
  try {
    const { movieTitle, movieOverview } = req.body;

    if (!movieTitle) {
      return res.status(400).json({ error: 'Movie title is required' });
    }

    if (!movieOverview) {
      return res.status(400).json({ error: 'Movie overview is required' });
    }

    logger.info(`Generating AI synopsis for: ${movieTitle}`);

    const synopsis = await aiService.generateMovieSynopsis(movieTitle, movieOverview);

    res.json({
      success: true,
      movieTitle,
      synopsis: synopsis.trim()
    });

  } catch (error) {
    logger.error(`AI synopsis generation failed: ${error.message}`, {
      movieTitle: req.body.movieTitle
    });

    if (error.message.includes('AI service not available')) {
      return res.status(503).json({ 
        error: 'AI service not available',
        details: 'AI provider not configured'
      });
    }

    res.status(500).json({ 
      error: 'Failed to generate synopsis',
      details: error.message
    });
  }
});

// Generate AI insights for movie relationships
router.post('/insights', async (req, res) => {
  try {
    const { selectedMovie, relatedMovies } = req.body;

    if (!selectedMovie?.title) {
      return res.status(400).json({ error: 'Selected movie with title is required' });
    }

    if (!Array.isArray(relatedMovies) || relatedMovies.length === 0) {
      return res.status(400).json({ error: 'Related movies array is required' });
    }

    logger.info(`Generating AI insights for: ${selectedMovie.title}`, {
      relatedCount: relatedMovies.length
    });

    const insights = await aiService.generateMovieInsights(selectedMovie, relatedMovies);

    res.json({
      success: true,
      selectedMovie: selectedMovie.title,
      relatedCount: relatedMovies.length,
      insights: insights.trim()
    });

  } catch (error) {
    logger.error(`AI insights generation failed: ${error.message}`, {
      selectedMovie: req.body.selectedMovie?.title
    });

    if (error.message.includes('AI service not available')) {
      return res.status(503).json({ 
        error: 'AI service not available',
        details: 'AI provider not configured'
      });
    }

    res.status(500).json({ 
      error: 'Failed to generate insights',
      details: error.message
    });
  }
});

// Generate network analysis
router.post('/network-analysis', async (req, res) => {
  try {
    const { networkData } = req.body;

    if (!networkData?.nodes || !Array.isArray(networkData.nodes)) {
      return res.status(400).json({ error: 'Network data with nodes array is required' });
    }

    if (networkData.nodes.length === 0) {
      return res.status(400).json({ error: 'Network must contain at least one movie' });
    }

    logger.info(`Generating network analysis for ${networkData.nodes.length} movies`);

    const analysis = await aiService.generateNetworkAnalysis(networkData);

    res.json({
      success: true,
      networkSize: networkData.nodes.length,
      connectionCount: networkData.links?.length || 0,
      analysis: analysis.trim()
    });

  } catch (error) {
    logger.error(`AI network analysis failed: ${error.message}`, {
      nodeCount: req.body.networkData?.nodes?.length,
      errorStack: error.stack
    });

    if (error.message.includes('AI service not available')) {
      return res.status(503).json({ 
        error: 'AI service not available',
        details: 'AI provider not configured. Set AI_PROVIDER and corresponding API key in your .env file.'
      });
    }

    res.status(500).json({ 
      error: 'Failed to generate network analysis',
      details: error.message,
      hint: 'Check AI provider configuration in .env (AI_PROVIDER, AI_API_KEY or provider-specific key)'
    });
  }
});

// Get available AI providers and current status
router.get('/providers', async (req, res) => {
  try {
    const providers = await aiService.getAvailableProviders();
    const currentProvider = await aiService.getCurrentProvider();
    
    res.json({
      success: true,
      providers,
      currentProvider
    });
  } catch (error) {
    logger.error(`Failed to get AI providers: ${error.message}`);
    res.status(500).json({
      error: 'Failed to get AI providers',
      details: error.message
    });
  }
});


// AI service health check
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await aiService.healthCheck();
    
    if (healthStatus.status === 'healthy') {
      res.json({
        status: 'healthy',
        service: `AI (${healthStatus.provider || 'unknown'})`,
        provider: healthStatus.provider || 'unknown',
        model: healthStatus.model,
        test_response: healthStatus.response
      });
    } else {
      res.status(503).json({
        status: healthStatus.status,
        service: `AI (${healthStatus.provider || 'unconfigured'})`,
        provider: healthStatus.provider || 'unconfigured',
        reason: healthStatus.reason || healthStatus.error
      });
    }
  } catch (error) {
    logger.error(`AI health check failed: ${error.message}`);
    res.status(500).json({
      status: 'error',
      service: 'AI',
      error: error.message
    });
  }
});

// Synthesize AI insights text to speech
router.post('/insights/tts', async (req, res) => {
  try {
    const { insightsText } = req.body;

    if (!insightsText) {
      return res.status(400).json({ error: 'Insights text is required for TTS' });
    }

    logger.info(`Synthesizing AI insights text for TTS (length: ${insightsText.length})`);

    const audioBase64 = await ttsService.synthesizeText(insightsText);

    res.json({
      success: true,
      audio: audioBase64
    });

  } catch (error) {
    logger.error(`AI insights TTS failed: ${error.message}`, {
      insightsTextLength: req.body.insightsText?.length,
      errorStack: error.stack
    });

    res.status(500).json({
      error: 'Failed to synthesize AI insights for TTS',
      details: error.message
    });
  }
});

// Chat with AI
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    logger.info(`AI chat request received with ${messages.length} messages`);

    const chatResponse = await aiService.getChatCompletion(messages);

    res.json({
      success: true,
      response: chatResponse.trim()
    });

  } catch (error) {
    logger.error(`AI chat failed: ${error.message}`, {
      messageCount: req.body.messages?.length,
      errorStack: error.stack
    });

    if (error.message.includes('AI service not available')) {
      return res.status(503).json({
        error: 'AI service not available',
        details: 'AI provider not configured or does not support chat completions.'
      });
    }

    res.status(500).json({
      error: 'Failed to get AI chat response',
      details: error.message
    });
  }
});

module.exports = router;
