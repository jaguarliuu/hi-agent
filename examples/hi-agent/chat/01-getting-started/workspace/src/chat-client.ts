import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import { userMessage, type ChatMessage } from './chat-message.js';

// @anchor:chat-client
export class OpenAiChatClient {
  constructor(private readonly model: LanguageModel) {}

  async chat(userPrompt: string): Promise<string> {
    return this.chatMessages([userMessage(userPrompt)]);
  }

  async chatMessages(messages: ChatMessage[]): Promise<string> {
    if (messages.length === 0) {
      throw new Error('messages must not be empty');
    }

    const result = await generateText({
      model: this.model,
      messages
    });

    const reply = result.text.trim();
    if (!reply) {
      throw new Error('AI response did not contain assistant content');
    }

    return reply;
  }
}
