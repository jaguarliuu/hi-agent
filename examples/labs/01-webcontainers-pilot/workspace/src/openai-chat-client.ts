import OpenAI from 'openai';
import { type AppConfig } from './config';

export class OpenAiChatClient {
  constructor(private readonly config: AppConfig) {}

  async chat(userPrompt: string): Promise<string> {
    if (this.config.useMock) {
      return `Mock assistant: 已收到你的问题「${userPrompt}」`;
    }

    const client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl
    });

    const completion = await client.chat.completions.create({
      model: this.config.model,
      messages: [{ role: 'user', content: userPrompt }]
    });

    return completion.choices[0]?.message?.content ?? 'No assistant content';
  }
}
