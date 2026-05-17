import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { OpenAiConfig } from './config.js';

// @anchor:create-model
export function createModel(config: OpenAiConfig): LanguageModel {
  const provider = createOpenAICompatible({
    name: 'openai-compatible',
    apiKey: config.apiKey,
    baseURL: config.baseUrl
  });

  return provider(config.model);
}
