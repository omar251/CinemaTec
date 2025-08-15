const GeminiProvider = require("./providers/geminiProvider");
const OpenAIProvider = require("./providers/openaiProvider");
const GroqProvider = require("./providers/groqProvider");

function createAIProvider(config, logger, preferred) {
  const providerPref = preferred || config?.apis?.ai?.provider;

  // If a specific provider is requested, try only that provider and fail if it doesn't work
  if (providerPref === "openai") {
    const openai = new OpenAIProvider(config, logger);
    if (openai.isEnabled()) {
      return openai;
    } else {
      logger &&
        logger.error(
          `Failed to initialize preferred OpenAI provider - check API key and model configuration`,
        );
      return null;
    }
  } else if (providerPref === "groq") {
    const groq = new GroqProvider(config, logger);
    if (groq.isEnabled()) {
      return groq;
    } else {
      logger &&
        logger.error(
          `Failed to initialize preferred Groq provider - check API key and model configuration`,
        );
      return null;
    }
  } else if (providerPref === "gemini") {
    const geminiPref = new GeminiProvider(config, logger);
    if (geminiPref.isEnabled()) {
      return geminiPref;
    } else {
      logger &&
        logger.error(
          `Failed to initialize preferred Gemini provider - check API key and model configuration`,
        );
      return null;
    }
  }

  // If no specific provider is requested, try in order: gemini, openai, groq
  logger &&
    logger.info("No AI provider specified, trying available providers...");

  const gemini = new GeminiProvider(config, logger);
  if (gemini.isEnabled()) return gemini;

  const openai2 = new OpenAIProvider(config, logger);
  if (openai2.isEnabled()) return openai2;

  const groq2 = new GroqProvider(config, logger);
  if (groq2.isEnabled()) return groq2;

  logger && logger.warn("No AI providers could be initialized");
  return null;
}

module.exports = { createAIProvider };
