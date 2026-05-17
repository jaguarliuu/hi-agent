export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export function userMessage(content: string): ChatMessage {
  return createMessage('user', content);
}

export function assistantMessage(content: string): ChatMessage {
  return createMessage('assistant', content);
}

function createMessage(role: ChatRole, content: string): ChatMessage {
  const normalized = content.trim();
  if (!normalized) {
    throw new Error('message content must not be blank');
  }

  return { role, content: normalized };
}
