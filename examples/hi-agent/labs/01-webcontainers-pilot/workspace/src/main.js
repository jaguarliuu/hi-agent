import { loadConfig } from './config.js';
import { OpenAiChatClient } from './openai-chat-client.js';

// @anchor:main-entry
async function main() {
  const prompt = '请介绍一下 Agent 是什么';
  const config = loadConfig();
  const client = new OpenAiChatClient(config);
  const reply = await client.chat(prompt);

  console.log(`User: ${prompt}`);
  console.log(`Assistant: ${reply}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
