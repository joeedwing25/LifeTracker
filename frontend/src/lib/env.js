export const getEnv = (name) => {
  return process.env[name] || process.env[`REACT_APP_${name}`];
};

export const aiEnv = {
  groqApiKey: () => getEnv('GROQ_API_KEY'),
  geminiApiKey: () => getEnv('GEMINI_API_KEY'),
  hasGroq: () => Boolean(getEnv('GROQ_API_KEY')),
  hasGemini: () => Boolean(getEnv('GEMINI_API_KEY')),
};
