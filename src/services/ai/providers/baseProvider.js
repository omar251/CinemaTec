/**
 * Base AI Provider Interface
 */
class BaseAIProvider {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.enabled = false;
    this.name = 'unknown';
    this.model = null;
  }

  isEnabled() {
    return !!this.enabled;
  }

  getProviderInfo() {
    return {
      name: this.name,
      model: this.model,
      enabled: this.isEnabled(),
    };
  }

  // Implement in subclasses
  async generateText(prompt) {
    throw new Error('generateText not implemented');
  }

  // Optional streaming implementation; subclasses may override
  async generateTextStream(prompt, onDelta) {
    // Default fallback: non-streaming
    const full = await this.generateText(prompt);
    if (onDelta) onDelta(full);
    return full;
  }

  async healthCheck() {
    if (!this.isEnabled()) {
      return { status: 'disabled', reason: 'Provider not configured' };
    }
    try {
      const testPrompt = 'Say "AI service is working" in exactly those words.';
      const out = await this.generateText(testPrompt);
      return { status: 'healthy', model: this.model, response: String(out).trim() };
    } catch (err) {
      return { status: 'error', error: err.message };
    }
  }
}

module.exports = BaseAIProvider;
