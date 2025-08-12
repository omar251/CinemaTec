/**
 * OpenAI Provider (chat completions)
 */
const BaseAIProvider = require('./baseProvider');
let OpenAI;
try {
  OpenAI = require('openai');
} catch (_) {
  // optional dependency not installed by default
}

class OpenAIProvider extends BaseAIProvider {
  constructor(config, logger) {
    super(config, logger);
    this.name = 'openai';

    const key = process.env.OPENAI_API_KEY || config?.apis?.openai?.key || config?.apis?.ai?.key;
    const model = process.env.OPENAI_MODEL || config?.apis?.openai?.model || config?.apis?.ai?.model || 'gpt-4o-mini';

    if (!key || !OpenAI) {
      logger && logger.warn('OpenAI provider not available - missing API key or package');
      this.enabled = false;
      return;
    }
    try {
      this.client = new OpenAI({ apiKey: key });
      this.model = model;
      this.enabled = true;
      logger && logger.info('🤖 OpenAI provider initialized');
    } catch (err) {
      logger && logger.error(`Failed to init OpenAI provider: ${err.message}`);
      this.enabled = false;
    }
  }

  async generateText(prompt) {
    if (!this.enabled) throw new Error('AI provider not available');
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });
    return res.choices?.[0]?.message?.content?.trim() || '';
  }
}

module.exports = OpenAIProvider;
