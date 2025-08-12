/**
 * Gemini AI Provider
 */
const BaseAIProvider = require('./baseProvider');
let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (_) {
  // optional dep fallback
}

class GeminiProvider extends BaseAIProvider {
  constructor(config, logger) {
    super(config, logger);
    this.name = 'gemini';

    const key = config?.apis?.gemini?.key || config?.apis?.ai?.key;
    const model = config?.apis?.gemini?.model || config?.apis?.ai?.model || 'gemini-1.5-flash';

    if (!key || !GoogleGenerativeAI) {
      logger && logger.warn('Gemini provider not available - missing API key or package');
      this.enabled = false;
      return;
    }
    try {
      this.client = new GoogleGenerativeAI(key);
      this.model = model;
      this.modelClient = this.client.getGenerativeModel({ model });
      this.enabled = true;
      logger && logger.info('🤖 Gemini provider initialized');
    } catch (err) {
      logger && logger.error(`Failed to init Gemini provider: ${err.message}`);
      this.enabled = false;
    }
  }

  async generateText(prompt) {
    if (!this.enabled) throw new Error('AI provider not available');
    const result = await this.modelClient.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }
}

module.exports = GeminiProvider;
