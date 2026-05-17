import {
  assistantMessage,
  userMessage,
  type ChatMessage
} from './chat-message.js';
import type { OpenAiChatClient } from './chat-client.js';

// @anchor:chat-session
export class OpenAiChatSession {
  private readonly history: ChatMessage[] = [];

  constructor(private readonly client: OpenAiChatClient) {}

  async send(userInput: string): Promise<string> {
    const currentUserMessage = userMessage(userInput);
    const requestMessages = [...this.history, currentUserMessage];

    const reply = await this.client.chatMessages(requestMessages);
    this.history.push(currentUserMessage, assistantMessage(reply));

    return reply;
  }

  getHistory(): readonly ChatMessage[] {
    return [...this.history];
  }
}
