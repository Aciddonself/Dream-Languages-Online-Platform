"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass";

type Source = { title: string; url: string };
type Message = { id?: string | null; role: "user" | "assistant"; content: string; sources?: Source[]; rating?: 1 | -1; reported?: boolean };

type StreamEvent =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "source"; title: string; url: string }
  | { type: "replace"; text: string }
  | { type: "done"; messageId: string | null }
  | { type: "error"; error: string };

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function FatherDlaChat({ name, staff = false, suggestions }: { name: string; staff?: boolean; suggestions: { title: string; prompt: string }[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [level, setLevel] = useState("A1");
  const [configured, setConfigured] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/father-dla")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setConfigured(!!data.configured);
        if (data.level) setLevel(data.level);
        setMessages((data.history ?? []).map((m: { id: string; role: "user" | "assistant"; content: string; sources?: Source[] | null }) => ({ id: m.id, role: m.role, content: m.content, sources: m.sources ?? undefined })));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, status]);

  const send = useCallback(async (custom?: string) => {
    const text = (custom ?? input).trim();
    if (!text || busy) return;
    setError("");
    setInput("");
    setBusy(true);
    setStatus("");
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "", sources: [] }]);

    const patchLast = (fn: (m: Message) => Message) => setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));

    try {
      const res = await fetch("/api/father-dla", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(res.status === 429 ? "You're sending messages too fast. Please wait a little and try again." : data.error ?? "Father-DLA could not respond right now.");
        setMessages((prev) => prev.slice(0, -2));
        setInput(text);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "status") setStatus(event.text);
          else if (event.type === "delta") { setStatus(""); patchLast((m) => ({ ...m, content: m.content + event.text })); }
          else if (event.type === "source") patchLast((m) => ({ ...m, sources: [...(m.sources ?? []), { title: event.title, url: event.url }] }));
          else if (event.type === "replace") patchLast((m) => ({ ...m, content: event.text, sources: [] }));
          else if (event.type === "done") patchLast((m) => ({ ...m, id: event.messageId }));
          else if (event.type === "error") { setError(event.error); setMessages((prev) => (prev[prev.length - 1]?.content ? prev : prev.slice(0, -1))); }
        }
      }
    } catch {
      setError("Connection issue. Please check your internet and try again.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }, [input, busy]);

  async function rate(index: number, rating: 1 | -1, report?: string) {
    const message = messages[index];
    if (!message?.id) return;
    const res = await fetch("/api/father-dla/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: message.id, rating, ...(report ? { report } : {}) }) });
    if (res.ok) setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, rating, reported: m.reported || !!report } : m)));
  }

  function report(index: number) {
    const reason = window.prompt("What was wrong with this answer?");
    if (reason?.trim()) void rate(index, -1, reason.trim());
  }

  async function clearChat() {
    if (!window.confirm("Delete your whole conversation with Father-DLA?")) return;
    const res = await fetch("/api/father-dla", { method: "DELETE" });
    if (res.ok) setMessages([]);
  }

  async function changeLevel(next: string) {
    setLevel(next);
    await fetch("/api/father-dla", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: next }) });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-1">
        {!staff && (
          <GlassCard className="p-5" strong>
            <label className="block text-sm font-bold mb-2" htmlFor="cefr">My language level (CEFR)</label>
            <select id="cefr" value={level} onChange={(e) => void changeLevel(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <p className="mt-2 text-[11px] opacity-70">Father-DLA adjusts its explanations to this level.</p>
          </GlassCard>
        )}
        <GlassCard className="p-5" strong>
          <h3 className="font-bold text-sm mb-3">{staff ? "Teaching helpers" : "Practice ideas"}</h3>
          <div className="space-y-2.5">
            {suggestions.map((s) => (
              <button key={s.title} type="button" disabled={busy} onClick={() => void send(s.prompt)} className="w-full text-left p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-xs font-semibold">
                {s.title}
              </button>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="flex flex-col h-[650px] lg:col-span-2 p-0 overflow-hidden" strong>
        <div className="flex items-center justify-between border-b border-white/15 bg-white/5 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${configured ? "bg-emerald-400" : "bg-amber-400"}`} />
            <div>
              <div className="font-bold text-sm">Father-DLA</div>
              <div className="text-[11px] opacity-70">{configured ? "AI language assistant with web search" : "Not configured yet"}</div>
            </div>
          </div>
          <button type="button" onClick={() => void clearChat()} className="text-xs opacity-60 hover:opacity-100 px-2 py-1 rounded hover:bg-white/10">Clear history</button>
        </div>

        <div ref={scroller} className="flex-1 space-y-4 p-5 overflow-y-auto" aria-live="polite">
          {messages.length === 0 && <p className="text-sm opacity-70">Hello {name}! Ask me anything{staff ? " about lesson plans, tests or translations" : " about your language studies"}.</p>}
          {messages.map((m, i) => (
            <div key={m.id ?? i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`rounded-2xl p-4 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${m.role === "user" ? "bg-blue-600 text-white" : "border border-white/15 bg-white/10"}`}>
                {m.content || (busy && i === messages.length - 1 ? <span className="opacity-60">{status || "Thinking…"}</span> : null)}
              </div>
              {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex max-w-[85%] flex-wrap gap-1.5">
                  {m.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="truncate max-w-[220px] rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] hover:bg-white/15" title={s.url}>
                      {s.title}
                    </a>
                  ))}
                </div>
              )}
              {m.role === "assistant" && m.id && !(busy && i === messages.length - 1) && (
                <div className="mt-1.5 flex gap-1 text-xs opacity-70">
                  <button type="button" aria-label="Good answer" aria-pressed={m.rating === 1} onClick={() => void rate(i, 1)} className={`px-1.5 rounded hover:bg-white/10 ${m.rating === 1 ? "bg-white/20" : ""}`}>👍</button>
                  <button type="button" aria-label="Bad answer" aria-pressed={m.rating === -1} onClick={() => void rate(i, -1)} className={`px-1.5 rounded hover:bg-white/10 ${m.rating === -1 ? "bg-white/20" : ""}`}>👎</button>
                  <button type="button" onClick={() => report(i)} className="px-1.5 rounded hover:bg-white/10">{m.reported ? "Reported ✓" : "Report a problem"}</button>
                </div>
              )}
            </div>
          ))}
          {busy && status && <div className="text-xs opacity-75">🔎 {status}</div>}
          {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex gap-2 border-t border-white/15 bg-white/5 p-4">
          <input
            type="text"
            value={input}
            maxLength={2000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question in any language..."
            disabled={busy}
            className="flex-1 rounded-xl border border-white/15 bg-black/20 px-4 py-2.5 text-sm placeholder:opacity-40 focus:outline-none focus:border-indigo-500"
          />
          <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            Send
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
