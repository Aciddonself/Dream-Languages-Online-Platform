import "server-only";
import type { ModelEvent, ModelMessage } from "./gemini";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Streams a reply from Groq (OpenAI-compatible API). Groq has no built-in web search, so none is offered. */
export async function* streamGroq(opts: {
  model: string;
  system: string;
  messages: ModelMessage[];
  maxTokens: number;
  signal?: AbortSignal;
}): AsyncGenerator<ModelEvent> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    signal: opts.signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: opts.maxTokens + 600,
      reasoning_effort: "low",
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Model request failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let index: number;
    while ((index = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const dataLine = raw.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (payload === "[DONE]") continue;
      let event: any;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.error) throw new Error("Model stream error");
      const text = event.choices?.[0]?.delta?.content;
      if (typeof text === "string" && text) yield { type: "text", text };
      const usage = event.usage ?? event.x_groq?.usage;
      if (usage) {
        inputTokens = usage.prompt_tokens ?? inputTokens;
        outputTokens = usage.completion_tokens ?? outputTokens;
      }
    }
  }
  yield { type: "usage", inputTokens, outputTokens, searches: 0 };
}
