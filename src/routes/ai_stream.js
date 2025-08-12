/**
 * AI streaming routes (SSE)
 */
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

// Utility to send SSE data
function sseSend(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Generic streaming endpoint
router.post('/stream', async (req, res) => {
  try {
    const { prompt, cacheKey } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Notify client that stream started
    sseSend(res, 'start', { ok: true });

    let final = '';
    await aiService.generateContentStream(prompt, cacheKey, (delta) => {
      final += delta;
      sseSend(res, 'delta', { token: delta });
    });

    sseSend(res, 'done', { text: final });
    res.end();
  } catch (error) {
    logger.error(`AI stream failed: ${error.message}`);
    try {
      sseSend(res, 'error', { message: error.message });
    } catch (_) {}
    res.end();
  }
});

// Streaming network analysis
router.post('/network-analysis/stream', async (req, res) => {
  try {
    const { networkData } = req.body || {};
    if (!networkData?.nodes?.length) {
      return res.status(400).json({ error: 'Network data with nodes is required' });
    }

    // Build prompt and cache key similar to non-streaming version
    const titles = (networkData.nodes || []).map(n => n.title || '').filter(Boolean).sort().join('|');
    const linkCount = Array.isArray(networkData.links) ? networkData.links.length : 0;
    const cacheKey = `ai:network:${titles}:${linkCount}`;
    const movieTitles = networkData.nodes.map(node => node.title).join(', ');

    const prompt = `Analyze this movie network and provide insights about the connections and themes.\n\nMovies in network: ${movieTitles}\nTotal movies: ${networkData.nodes.length}\nTotal connections: ${networkData.links.length}\n\nProvide a brief analysis (2-3 sentences) about:\n- Common themes or genres\n- Notable patterns or clusters\n- What this network reveals about movie relationships\n\nAnalysis:`;

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseSend(res, 'start', { ok: true });

    let final = '';
    await aiService.generateContentStream(prompt, cacheKey, (delta) => {
      final += delta;
      sseSend(res, 'delta', { token: delta });
    });

    sseSend(res, 'done', { text: final });
    res.end();
  } catch (error) {
    logger.error(`AI network stream failed: ${error.message}`);
    try {
      sseSend(res, 'error', { message: error.message });
    } catch (_) {}
    res.end();
  }
});

module.exports = router;
