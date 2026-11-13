"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassButton, GlassCard } from "@/components/ui/glass";

export type GoogleCalendarStatus = { connected: boolean; email: string | null; configured: boolean };

export function GoogleCalendarIntegration({ initialStatus }: { initialStatus: GoogleCalendarStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (!window.confirm("Disconnect the school Google Calendar? Automatic Meet link creation will stop.")) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/google-calendar/status", { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not disconnect Google Calendar.");
      setStatus((current) => ({ ...current, connected: false, email: null }));
      setNotice("Google Calendar has been disconnected.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not disconnect Google Calendar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard className="p-5" strong>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg">Google Calendar and Meet</h2>
          <p className="mt-1 max-w-2xl text-sm opacity-70">Connect the school’s calendar once. Scheduling can then create real Meet links and weekly Calendar events. The refresh token is encrypted in Supabase.</p>
          <p className="mt-2 text-sm" role="status">
            {!status.configured ? "Server setup required" : status.connected ? `Connected${status.email ? ` as ${status.email}` : ""}` : "Not connected"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {status.connected ? (
            <GlassButton type="button" disabled={busy} onClick={() => void disconnect()} className="text-sm">{busy ? "Disconnecting…" : "Disconnect Google"}</GlassButton>
          ) : status.configured ? (
            <Link className="btn-glass btn-glass-primary inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold" href="/api/admin/google-calendar/connect">Connect Google Calendar</Link>
          ) : (
            <Link className="btn-glass inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold" href="/admin/settings">View deployment settings</Link>
          )}
        </div>
      </div>
      {notice && <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm" role="status">{notice}</p>}
    </GlassCard>
  );
}
