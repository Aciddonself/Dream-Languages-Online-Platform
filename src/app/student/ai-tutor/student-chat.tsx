"use client";

import { useState, useRef, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass";

type Message = {
  role: "user" | "assistant";
  content: string;
  provider?: string;
};

const PRACTICE_MODES = [
  {
    title: "🇫🇷 French Practice",
    desc: "Verb drills, past tense, and daily dialogue",
    prompt: "Let's practice French! Please quiz me on 3 common French regular verbs with examples.",
  },
  {
    title: "🇩🇪 German Grammar",
    desc: "Akkusativ, Dativ cases & sentence word order",
    prompt: "Can you explain how German Dativ case prepositions work (aus, bei, mit, nach, seit, von, zu)?",
  },
  {
    title: "🇰🇪 Kiswahili Dialogue",
    desc: "Everyday conversation & polite greetings",
    prompt: "Hujambo Father-DLA! Let's practice a realistic conversation between a customer and a shopkeeper in Kiswahili.",
  },
  {
    title: "🇺🇬 Luganda Language",
    desc: "Culture, greetings & noun prefixes",
    prompt: "Oli otya Father-DLA! Teach me the polite morning and evening greeting customs in Luganda.",
  },
  {
    title: "🎥 Live Class Preparation",
    desc: "Review topics for your Google Meet class",
    prompt: "How can I prepare effectively for my upcoming live Google Meet speaking class?",
  },
];

export function StudentAiTutorChat({ studentName }: { studentName: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello ${studentName}! I am Father-DLA, your personal AI Language Tutor at Dream Languages Uganda. I'm connected and ready to practice French, German, Kiswahili, Luganda, Spanish, English, or Arabic with you. What would you like to learn today?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSend(customText?: string) {
    const textToSend = (customText ?? input).trim();
    if (!textToSend || loading) return;

    setError("");
    const newMessages: Message[] = [...messages, { role: "user", content: textToSend }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/father-dla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.slice(-12).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Father-DLA could not respond right now.");
        setMessages((prev) => prev.slice(0, -1));
        setInput(textToSend);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          provider: data.provider,
        },
      ]);
    } catch {
      setError("Connection issue. Please check your internet and try again.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(textToSend);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Practice Suggestions Sidebar */}
      <div className="space-y-4 lg:col-span-1">
        <GlassCard className="p-5" strong>
          <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
            <span>✨</span> Recommended Practice Modes
          </h3>
          <div className="space-y-2.5">
            {PRACTICE_MODES.map((mode, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(mode.prompt)}
                disabled={loading}
                className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 transition-all text-xs group"
              >
                <div className="font-semibold text-white group-hover:text-indigo-300">
                  {mode.title}
                </div>
                <div className="opacity-70 mt-0.5 text-[11px]">{mode.desc}</div>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5 text-xs opacity-75">
          <h4 className="font-semibold text-white mb-1">💡 Language Tip</h4>
          <p className="leading-relaxed">
            Practice for 10-15 minutes daily with Father-DLA to build confidence before attending your scheduled live classes on Google Meet!
          </p>
        </GlassCard>
      </div>

      {/* Main Chat Interface */}
      <GlassCard className="flex flex-col h-[650px] lg:col-span-2 p-0 overflow-hidden" strong>
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b border-white/15 bg-white/5 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="font-bold text-sm text-white">Father-DLA AI Tutor</div>
              <div className="text-[11px] opacity-70">Interactive Multilingual Learning</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  role: "assistant",
                  content: `Hello ${studentName}! Ready for our next language session. What would you like to explore?`,
                },
              ])
            }
            className="text-xs opacity-60 hover:opacity-100 hover:bg-white/10 px-2 py-1 rounded"
          >
            Reset Chat
          </button>
        </div>

        {/* Message History */}
        <div ref={scrollRef} className="flex-1 space-y-4 p-5 overflow-y-auto">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`rounded-2xl p-4 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "border border-white/15 bg-white/10 text-white rounded-tl-sm shadow-md"
                }`}
              >
                <div className="mb-1 text-[11px] font-bold opacity-60">
                  {msg.role === "user" ? studentName : "Father-DLA"}
                </div>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs opacity-75 p-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              <span>Father-DLA is crafting your response…</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 border-t border-white/15 bg-white/5 p-4"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question or practice phrase in any language..."
            disabled={loading}
            className="flex-1 rounded-xl border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
