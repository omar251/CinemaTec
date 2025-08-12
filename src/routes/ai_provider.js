/**
 * AI Provider management routes
 */
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');

// Get current provider info
router.get('/provider', (req, res) => {
  const info = aiService.provider?.getProviderInfo?.() || { name: null, model: null, enabled: false };
  res.json({ provider: info.name, model: info.model, enabled: info.enabled });
});

// Set provider (runtime switch; best-effort)
router.post('/provider', (req, res) => {
  const { provider } = req.body || {};
  if (!provider) return res.status(400).json({ error: 'provider is required' });
  const result = aiService.setProvider(provider);
  if (result.success) res.json(result);
  else res.status(400).json(result);
});

module.exports = router;
