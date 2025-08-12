const GeminiProvider = require('./providers/geminiProvider');
const OpenAIProvider = require('./providers/openaiProvider');
const GroqProvider = require('./providers/groqProvider');

function createAIProvider(config, logger, preferred) {
  const providerPref = preferred || config?.apis?.ai?.provider;
  if (providerPref === 'openai') {
    const openai = new OpenAIProvider(config, logger);
    if (openai.isEnabled()) return openai;
  } else if (providerPref === 'groq') {
    const groq = new GroqProvider(config, logger);
    if (groq.isEnabled()) return groq;
  } else if (providerPref === 'gemini') {
    const geminiPref = new GeminiProvider(config, logger);
    if (geminiPref.isEnabled()) return geminiPref;
  }

  // Try in order: explicit provider failed or not set; attempt gemini, openai, groq
  const gemini = new GeminiProvider(config, logger);
  if (gemini.isEnabled()) return gemini;

  const openai2 = new OpenAIProvider(config, logger);
  if (openai2.isEnabled()) return openai2;

  const groq2 = new GroqProvider(config, logger);
  if (groq2.isEnabled()) return groq2;

  return null;
}

module.exports = { createAIProvider };
