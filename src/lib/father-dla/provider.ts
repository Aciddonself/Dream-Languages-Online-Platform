export type Provider = "groq" | "gemini";

/** Prefer Groq when present. Fall back to Gemini if Groq rejects its key or endpoint. */
export function activeProvider(): Provider | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function fallbackProvider(provider: Provider): Provider | null {
  if (provider === "groq" && process.env.GEMINI_API_KEY) return "gemini";
  return null;
}
