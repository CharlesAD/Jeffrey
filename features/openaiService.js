// openaiService.js
const OpenAI = require("openai");
const { ACCESS_TOKEN_OPENAI } = process.env;

const openai = new OpenAI({ apiKey: ACCESS_TOKEN_OPENAI });

let log = [
  {
    role: "system",
    content: "You are a general friendly assistant who is knowledgeable about code.",
  },
];

module.exports.getOpenAIResponse = async (userMessage, maxTokens = 1000) => {
  log.push({ role: "user", content: userMessage });
  const completion = await openai.chat.completions.create({
    messages: log,
    model: "gpt-4",
    max_tokens: maxTokens,
  });
  const response = completion.choices[0].message.content;
  log.push({ role: "assistant", content: response });
  return response;
};
