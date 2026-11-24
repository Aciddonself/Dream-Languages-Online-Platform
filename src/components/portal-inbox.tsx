"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

type Contact = { id: string; name: string; role: string };
type DirectMessage = {
  id: string;
  senderId: string | null;
  recipientId: string | null;
  senderName: string;
  recipientName: string;
  body: string;
  createdAt: string;
};

export function PortalInbox({ currentUserId }: { currentUserId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/portal/inbox", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as { error?: string; contacts?: Contact[]; messages?: DirectMessage[] };
    if (!response.ok) throw new Error(result.error ?? "Could not load your inbox.");
    setContacts(result.contacts ?? []);
    setMessages(result.messages ?? []);
    setRecipientId((current) => current || result.contacts?.[0]?.id || "");
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { if (active) await load(); }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Could not load your inbox."); }
      finally { if (active) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [load]);

  const contactById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipientId || !body.trim()) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/portal/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, body }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Your message could not be sent.");
      setBody("");
      await load();
      toast.success("Message sent.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Your message could not be sent.";
      setError(message);
      toast.error(message);
    } finally { setSending(false); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,.8fr)]">
      <section className="glass rounded-2xl border border-[var(--border-strong)] p-4 md:p-5" aria-label="Direct messages">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="font-semibold">Messages</h2><p className="text-xs opacity-65">Direct communication between active DLA accounts.</p></div>
          <button type="button" className="btn-glass px-3 py-2 text-sm" onClick={() => void load()}>Refresh</button>
        </div>
        {loading ? <p className="text-sm opacity-65">Loading messages…</p> : messages.length ? (
          <ul className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => {
              const incoming = message.recipientId === currentUserId;
              const otherId = incoming ? message.senderId : message.recipientId;
              return (
                <li key={message.id} className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-70">
                    <span>{message.senderName} to {message.recipientName}</span>
                    <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{message.body}</p>
                  {otherId && contactById.has(otherId) && <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => setRecipientId(otherId)}>Reply to {contactById.get(otherId)?.name}</button>}
                </li>
              );
            })}
          </ul>
        ) : <p className="rounded-xl border border-[var(--border-strong)] p-4 text-sm opacity-65">Your direct messages will appear here.</p>}
      </section>

      <form onSubmit={send} className="glass h-fit rounded-2xl border border-[var(--border-strong)] p-4 md:p-5">
        <h2 className="font-semibold">Write a message</h2>
        <label className="mt-4 grid gap-2 text-sm font-semibold">
          <span>Recipient</span>
          <select className="glass rounded-xl px-3 py-2.5" value={recipientId} onChange={(event) => setRecipientId(event.target.value)} required disabled={!contacts.length}>
            <option value="">{contacts.length ? "Choose a DLA account" : "No active contacts available"}</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.role}</option>)}
          </select>
        </label>
        <label className="mt-4 grid gap-2 text-sm font-semibold">
          <span>Message</span>
          <textarea className="glass min-h-40 rounded-xl px-3 py-2.5 font-normal" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="Write your message…" required />
        </label>
        <div className="mt-2 flex items-center justify-between text-xs opacity-65"><span>Only the recipient can see this message.</span><span>{body.length}/4000</span></div>
        {error && <p className="mt-3 text-sm text-[var(--danger)]" role="alert">{error}</p>}
        <button type="submit" className="btn-glass btn-glass-primary mt-4 w-full px-4 py-2.5 font-semibold" disabled={sending || !recipientId}>{sending ? "Sending…" : "Send message"}</button>
      </form>
    </div>
  );
}
