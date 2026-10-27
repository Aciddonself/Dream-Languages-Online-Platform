import "server-only";

export type ModelEvent =
  | { type: "text"; text: string }
  | { type: "searching"; query?: string }
  | { type: "source"; title: string; url: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; searches: number };

export type ModelMessage = { role: "user" | "assistant"; content: string };

// Google AI Studio keys start with "AIza"; Vertex AI express-mode keys start with "AQ.".
function endpoint(model: string, apiKey: string) {
  const method = `${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  if (apiKey.startsWith("AQ.")) {
    return {
      url: `https://aiplatform.googleapis.com/v1/publishers/google/models/${method}&key=${encodeURIComponent(apiKey)}`,
      headers: {} as Record<string, string>,
    };
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${method}`,
    headers: { "x-goog-api-key": apiKey } as Record<string, string>,
  };
}

/** Streams a reply from Gemini. Web search is Gemini's built-in Google Search grounding tool. */
export async function* streamGemini(opts: {
  model: string;
  system: string;
  messages: ModelMessage[];
  maxTokens: number;
  maxSearches: number;
  allowSearch: boolean;
  signal?: AbortSignal;
}): AsyncGenerator<ModelEvent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const { url, headers } = endpoint(opts.model, apiKey);
  const res = await fetch(url, {
    method: "POST",
    signal: opts.signal,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: opts.maxTokens },
      ...(opts.allowSearch && opts.maxSearches > 0 ? { tools: [{ google_search: {} }] } : {}),
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Model request failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let searches = 0;
  const seen = new Set<string>();
  const queries = new Set<string>();

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
      let event: any;
      try {
        event = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }
      if (event.error) throw new Error("Model stream error");

      const candidate = event.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        if (typeof part.text === "string" && !part.thought) yield { type: "text", text: part.text };
      }
      const grounding = candidate?.groundingMetadata;
      for (const q of grounding?.webSearchQueries ?? []) {
        if (!queries.has(q)) {
          queries.add(q);
          searches += 1;
          yield { type: "searching", query: String(q).slice(0, 120) };
        }
      }
      for (const chunk of grounding?.groundingChunks ?? []) {
        const web = chunk.web;
        if (web?.uri && !seen.has(web.uri)) {
          seen.add(web.uri);
          yield { type: "source", title: String(web.title ?? web.uri).slice(0, 160), url: web.uri };
        }
      }
      if (event.usageMetadata) {
        inputTokens = event.usageMetadata.promptTokenCount ?? inputTokens;
        outputTokens = (event.usageMetadata.candidatesTokenCount ?? 0) + (event.usageMetadata.thoughtsTokenCount ?? 0) || outputTokens;
      }
    }
  }
  yield { type: "usage", inputTokens, outputTokens, searches };
}
