"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GlassButton, GlassInput } from "@/components/ui/glass";

type Room = { id: string; title: string; topic: string | null; classId: string | null; className: string | null; createdAt: string };
type ClassOption = { id: string; name: string };
type Message = { id: string; senderId: string | null; senderName: string; body: string; createdAt: string };

export function DiscussionHub({
  rooms,
  classes,
  canCreate,
  canTeachNumbers,
  currentUserId,
}: {
  rooms: Room[];
  classes: ClassOption[];
  canCreate: boolean;
  canTeachNumbers: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(rooms[0]?.id ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshMessages = useCallback(async (roomId: string) => {
    if (!roomId) return;
    try {
      const response = await fetch(`/api/portal/discussions/${roomId}/messages`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setMessages(data.messages);
      else setError(data.error ?? "Unable to load discussion messages.");
    } catch {
      setError("Unable to refresh the discussion. Check your connection.");
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refreshMessages(selectedId), 0);
    const interval = window.setInterval(() => void refreshMessages(selectedId), 5_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [selectedId, refreshMessages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/discussions/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: data.get("body"), teachingNumbers: data.get("teachingNumbers") === "on" }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Message could not be sent.");
        return;
      }
      form.reset();
      await refreshMessages(selectedId);
    } catch {
      setError("Unable to send your message. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    const data = new FormData(form);
    try {
      const response = await fetch("/api/portal/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: data.get("classId"), title: data.get("title"), topic: data.get("topic") }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Discussion could not be created.");
        return;
      }
      setSelectedId(result.room.id);
      form.reset();
      router.refresh();
    } catch {
      setError("Unable to create the discussion. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        {canCreate && (
          <form className="glass space-y-2 rounded-2xl p-4" onSubmit={createRoom}>
            <h2 className="font-semibold">Create class discussion</h2>
            <GlassInput name="title" placeholder="Discussion title" maxLength={120} required />
            <select className="glass w-full px-3 py-2 text-sm" name="classId" defaultValue="" required>
              <option value="">Select class</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <GlassInput name="topic" placeholder="Topic (optional)" maxLength={500} />
            <GlassButton type="submit" disabled={busy || !classes.length}>Create</GlassButton>
          </form>
        )}
        <div className="space-y-2">
          {rooms.map((room) => (
            <button type="button" key={room.id} onClick={() => setSelectedId(room.id)} className={`glass w-full rounded-xl p-3 text-left ${selectedId === room.id ? "ring-2 ring-[var(--brand-primary)]" : ""}`}>
              <span className="block font-semibold">{room.title}</span>
              <span className="block text-xs opacity-65">{room.className ?? "Class"}{room.topic ? ` · ${room.topic}` : ""}</span>
            </button>
          ))}
          {!rooms.length && <p className="glass rounded-xl p-4 text-sm opacity-65">No class discussions yet.</p>}
        </div>
      </aside>

      <section className="glass flex min-h-[420px] flex-col rounded-2xl p-4">
        {selectedId ? (
          <>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4" aria-live="polite">
              {messages.map((message) => (
                <article className={`max-w-[90%] rounded-xl p-3 text-sm ${message.senderId === currentUserId ? "ml-auto bg-[var(--brand-primary)]/15" : "bg-white/40"}`} key={message.id}>
                  <div className="mb-1 text-xs font-semibold opacity-65">{message.senderId === currentUserId ? "You" : message.senderName} · {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                </article>
              ))}
              {!messages.length && <p className="py-8 text-center text-sm opacity-65">Be the first to post in this class discussion.</p>}
            </div>
            <form className="space-y-2 border-t border-white/15 pt-3" onSubmit={sendMessage}>
              {canTeachNumbers && <label className="flex items-center gap-2 text-xs opacity-75"><input type="checkbox" name="teachingNumbers" /> This is a classroom lesson using numbers</label>}
              <textarea className="glass min-h-20 w-full rounded-xl px-3 py-2 text-sm" name="body" maxLength={2000} placeholder="Write a class message..." required />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs opacity-60">Private class members only. Personal phone numbers and external-contact handles are blocked.</p>
                <GlassButton type="submit" disabled={busy}>{busy ? "Sending..." : "Send"}</GlassButton>
              </div>
            </form>
          </>
        ) : <p className="m-auto text-sm opacity-60">Select a discussion to read or send class messages.</p>}
        {error && <p className="mt-3 text-sm text-[var(--danger)]" role="alert">{error}</p>}
      </section>
    </div>
  );
}
