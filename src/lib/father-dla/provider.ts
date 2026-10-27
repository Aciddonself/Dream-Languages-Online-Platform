export type Provider = "groq" | "gemini";

/** Groq is preferred when its key is set; Gemini remains as a fallback. */
export function activeProvider(): Provider | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}
