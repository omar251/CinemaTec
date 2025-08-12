/**
 * Groq Provider (chat completions)
 */
const BaseAIProvider = require('./baseProvider');
let Groq;
try {
  Groq = require('groq-sdk');
} catch (_) {
  // optional dependency not installed by default
}

class GroqProvider extends BaseAIProvider {
  constructor(config, logger) {
    super(config, logger);
    this.name = 'groq';

    const key = process.env.GROQ_API_KEY || config?.apis?.groq?.key || config?.apis?.ai?.groq?.key || config?.apis?.ai?.key;
    const model = process.env.GROQ_MODEL || config?.apis?.groq?.model || config?.apis?.ai?.groq?.model || config?.apis?.ai?.model || 'llama-3.1-8b-instant';

    if (!key || !Groq) {
      logger && logger.warn('Groq provider not available - missing API key or package');
      this.enabled = false;
      return;
    }

    try {
      this.client = new Groq({ apiKey: key });
      this.model = model;
      this.enabled = true;
      logger && logger.info('🤖 Groq provider initialized');
    } catch (err) {
      logger && logger.error(`Failed to init Groq provider: ${err.message}`);
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

  async generateTextStream(prompt, onDelta) {
    if (!this.enabled) throw new Error('AI provider not available');
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      stream: true
    });
    let final = '';
    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content || '';
      if (token) {
        final += token;
        if (onDelta) onDelta(token);
      }
    }
    return final.trim();
  }
}

module.exports = GroqProvider;
