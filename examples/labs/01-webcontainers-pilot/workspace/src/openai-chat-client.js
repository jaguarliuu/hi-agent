export class OpenAiChatClient {
  constructor(config) {
    this.config = config;
  }

  async chat(userPrompt) {
    if (this.config.useMock) {
      return `Mock assistant: 已收到你的问题「${userPrompt}」`;
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${body}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? 'No assistant content';
  }
}
