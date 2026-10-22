"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  provider?: string;
};

const STARTER_PROMPTS = [
  { label: "🇫🇷 French Verbs", prompt: "How do I conjugate regular -ER verbs in French with examples?" },
  { label: "🇩🇪 German Cases", prompt: "Explain the difference between Nominativ, Akkusativ, and Dativ in German." },
  { label: "🇰🇪 Kiswahili Greetings", prompt: "Teach me everyday greetings and responses in Kiswahili." },
  { label: "🇺🇬 Luganda Culture", prompt: "What are polite everyday greetings in Luganda and their meanings?" },
  { label: "🎥 Google Meet Classes", prompt: "How do live classes work on Google Meet at Dream Languages Uganda?" },
  { label: "🇪🇸 Spanish Ser vs Estar", prompt: "When do I use 'ser' versus 'estar' in Spanish?" },
  { label: "📝 Quiz Me!", prompt: "Give me a quick 3-question beginner vocabulary quiz in German or French!" },
];

export function FatherDla() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agentStatus, setAgentStatus] = useState<{ status: string; activeProvider: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check agent status on mount
  useEffect(() => {
    fetch("/api/father-dla")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAgentStatus(data);
      })
      .catch(() => {});
  }, []);

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  async function handleSend(textToSend?: string) {
    const question = (textToSend ?? input).trim();
    if (!question || busy) return;

    setBusy(true);
    setError("");

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");

    try {
      const response = await fetch("/api/father-dla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-14).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Father-DLA could not answer right now.");
        setMessages((current) => current.slice(0, -1));
        setInput(question);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer,
          provider: data.provider,
        },
      ]);
    } catch {
      setError("Unable to reach Father-DLA. Please check your connection and try again.");
      setMessages((current) => current.slice(0, -1));
      setInput(question);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSend();
  }

  function clearChat() {
    setMessages([]);
    setError("");
  }

  const providerLabel =
    agentStatus?.activeProvider === "gemini"
      ? "Google Gemini AI"
      : agentStatus?.activeProvider === "openai"
      ? "OpenAI GPT"
      : "DLA Intelligence Engine";

  return (
    <div className="fixed bottom-5 right-5 z-[80]">
      {open && (
        <section
          aria-label="Father-DLA learning assistant"
          className="mb-3 flex h-[min(76vh,36rem)] w-[min(94vw,26rem)] flex-col overflow-hidden rounded-3xl border border-white/20 bg-[var(--surface)] shadow-2xl backdrop-blur-2xl"
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-white/15 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 text-white font-bold text-sm shadow">
                🎓
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[var(--surface)]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-white">Father-DLA</h2>
                  <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Connected
                  </span>
                </div>
                <p className="text-[11px] opacity-70">
                  AI Language Tutor • {providerLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="rounded-lg px-2 py-1 text-xs opacity-60 hover:opacity-100 hover:bg-white/10"
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-xs opacity-75 hover:bg-white/10 hover:opacity-100"
                aria-label="Close Father-DLA"
              >
                ✕
              </button>
            </div>
          </header>

          {/* Messages & Chat Body */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {!messages.length && (
              <div className="space-y-4 pt-2">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-3.5 text-center">
                  <span className="text-2xl">✨</span>
                  <h3 className="mt-1 font-semibold text-sm">Welcome to Father-DLA</h3>
                  <p className="mt-1 text-xs opacity-75 leading-relaxed">
                    I am your multilingual language tutor and academic assistant. Ask me questions about French, German, Kiswahili, Luganda, Spanish, English, or your Google Meet live classes!
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-60">
                    Quick Learning Topics
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {STARTER_PROMPTS.map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(item.prompt)}
                        className="rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-left hover:bg-white/15 transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${index}-${message.role}`}
                className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`whitespace-pre-wrap rounded-2xl p-3 text-sm max-w-[90%] leading-relaxed ${
                    message.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "border border-white/15 bg-white/10 text-white rounded-tl-sm"
                  }`}
                >
                  <strong className="mb-1 block text-[11px] font-semibold opacity-75">
                    {message.role === "user" ? "You" : "Father-DLA Tutor"}
                  </strong>
                  {message.content}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-xs opacity-75 p-2" role="status">
                <span className="inline-block h-2 w-2 animate-ping rounded-full bg-[var(--brand-primary)]" />
                <span>Father-DLA is preparing your explanation…</span>
              </div>
            )}
          </div>

          {error && <p className="px-4 py-1 text-xs text-[var(--danger)]" role="alert">{error}</p>}

          {/* Form input */}
          <form onSubmit={submit} className="flex gap-2 border-t border-white/15 bg-white/5 p-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything in English, French, German, Luganda..."
              maxLength={3000}
              rows={2}
              className="min-w-0 flex-1 resize-none rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-indigo-400 focus:outline-none"
              aria-label="Ask Father-DLA anything"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="self-end rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow transition-opacity disabled:opacity-40"
            >
              Ask
            </button>
          </form>
        </section>
      )}

      {/* Floating Toggle Button */}
      <button
        type="button"
        className="group relative ml-auto flex items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-5 py-3 font-semibold text-white shadow-xl hover:shadow-indigo-500/30 transition-all hover:scale-105"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
        </span>
        <span>{open ? "Close Father-DLA" : "Ask Father-DLA AI"}</span>
      </button>
    </div>
  );
}
