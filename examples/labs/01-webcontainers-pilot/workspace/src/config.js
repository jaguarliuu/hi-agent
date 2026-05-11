// @anchor:load-config
export function loadConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';

  return {
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
    useMock: apiKey.length === 0
  };
}
