import 'dotenv/config';

export interface OpenAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// @anchor:load-config
export function loadConfig(): OpenAiConfig {
  return {
    baseUrl: readRequiredEnv('OPENAI_BASE_URL'),
    apiKey: readRequiredEnv('OPENAI_API_KEY'),
    model: readRequiredEnv('OPENAI_MODEL')
  };
}

function readRequiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `Missing required config: ${key}. 请在 .env 中配置你的模型连接信息。`
    );
  }
  return value;
}
