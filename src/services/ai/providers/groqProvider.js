/**
 * Groq Provider (chat completions)
 */
const BaseAIProvider = require("./baseProvider");
const axios = require("axios");

class GroqProvider extends BaseAIProvider {
  constructor(config, logger) {
    super(config, logger);
    this.name = "groq";

    const key =
      process.env.GROQ_API_KEY ||
      config?.apis?.groq?.key ||
      config?.apis?.ai?.groq?.key ||
      config?.apis?.ai?.key;
    const model =
      process.env.GROQ_MODEL ||
      config?.apis?.groq?.model ||
      config?.apis?.ai?.groq?.model ||
      config?.apis?.ai?.model;

    if (!key) {
      logger && logger.warn("Groq provider not available - missing API key");
      this.enabled = false;
      return;
    }

    if (!model) {
      logger && logger.warn("Groq provider not available - no model specified");
      this.enabled = false;
      return;
    }

    try {
      this.key = key;
      this.model = model;
      this.enabled = true;
      logger &&
        logger.info(`🤖 Groq provider initialized with model: ${model}`);
    } catch (err) {
      logger && logger.error(`Failed to init Groq provider: ${err.message}`);
      this.enabled = false;
    }
  }

  async generateText(prompt) {
    if (!this.enabled) throw new Error("AI provider not available");
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const headers = {
      Authorization: `Bearer ${this.key}`,
      "Content-Type": "application/json",
    };
    const data = {
      model: this.model,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    };

    try {
      const res = await axios.post(url, data, { headers });
      return res.data.choices?.[0]?.message?.content?.trim() || "";
    } catch (error) {
      if (error.response) {
        // Log the full error response from Groq API
        this.logger && this.logger.error(`Groq API error (generateText): ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        if (error.response.status === 400 && error.response.data?.error?.message?.includes("model")) {
          throw new Error(
            `Invalid Groq model '${this.model}': ${error.response.data.error.message}`,
          );
        }
        throw new Error(`Groq API request failed (generateText): ${error.response.data?.error?.message || error.message}`);
      }
      // Log other errors (network, etc.)
      this.logger && this.logger.error(`Groq request failed (generateText): ${error.message}`);
      throw error;
    }
  }

  async generateTextStream(prompt, onDelta) {
    if (!this.enabled) throw new Error("AI provider not available");
    // For simplicity, stream will just return the full text for now
    const text = await this.generateText(prompt);
    if (onDelta) onDelta(text);
    return text;
  }

  async chatCompletion(messages) {
    if (!this.enabled) throw new Error("AI provider not available");
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const headers = {
      Authorization: `Bearer ${this.key}`,
      "Content-Type": "application/json",
    };
    const data = {
      model: this.model,
      messages: messages,
      temperature: 0.7,
    };

    try {
      const res = await axios.post(url, data, { headers });
      return res.data.choices?.[0]?.message?.content?.trim() || "";
    } catch (error) {
      if (error.response) {
        // Log the full error response from Groq API
        this.logger && this.logger.error(`Groq API error (chatCompletion): ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        if (error.response.status === 400 && error.response.data?.error?.message?.includes("model")) {
          throw new Error(
            `Invalid Groq model '${this.model}': ${error.response.data.error.message}`,
          );
        }
        throw new Error(`Groq API request failed (chatCompletion): ${error.response.data?.error?.message || error.message}`);
      }
      // Log other errors (network, etc.)
      this.logger && this.logger.error(`Groq request failed (chatCompletion): ${error.message}`);
      throw error;
    }
  }
}

module.exports = GroqProvider;