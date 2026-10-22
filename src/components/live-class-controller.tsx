"use client";

import { useState } from "react";
import { GlassCard, GlassButton } from "@/components/ui/glass";

export type LiveSessionItem = {
  id: string;
  title: string;
  startsAt: string | Date;
  endsAt: string | Date;
  room?: string | null;
  meetUrl?: string | null;
  className?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  flagEmoji?: string | null;
  teacherName?: string | null;
  liveStartedAt?: string | Date | null;
  liveEndedAt?: string | Date | null;
};

interface LiveClassControllerProps {
  sessions: LiveSessionItem[];
  canManage?: boolean;
}

export function LiveClassController({ sessions: initialSessions, canManage = true }: LiveClassControllerProps) {
  const [sessions, setSessions] = useState<LiveSessionItem[]>(initialSessions);
  const [filterDept, setFilterDept] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Extract unique departments for filter tabs
  const departments = Array.from(
    new Set(
      sessions
        .map((s) => s.departmentName)
        .filter((d): d is string => Boolean(d))
    )
  );

  const filteredSessions = sessions.filter((s) => {
    if (filterDept === "ALL") return true;
    return s.departmentName === filterDept;
  });

  async function handleSessionAction(sessionId: string, action: "start" | "end") {
    setActionLoading(sessionId);
    setMessage(null);

    try {
      const response = await fetch(`/api/academic/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage({
          type: "error",
          text: data.error ?? `Could not ${action} the live class session.`,
        });
        return;
      }

      // Update local session state
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          if (action === "start") {
            return { ...s, liveStartedAt: new Date().toISOString() };
          } else {
            return { ...s, liveEndedAt: new Date().toISOString() };
          }
        })
      );

      setMessage({
        type: "success",
        text: action === "start"
          ? "🔴 Live class started! Google Meet room is now active for students."
          : "✅ Live class ended and attendance minutes recorded.",
      });
    } catch {
      setMessage({ type: "error", text: "Network error while managing live session." });
    } finally {
      setActionLoading(null);
    }
  }

  function copyInvitation(session: LiveSessionItem) {
    const meetLink = session.meetUrl || "Google Meet";
    const startTime = new Date(session.startsAt).toLocaleString();
    const text =
      `🎓 *Dream Languages Uganda — Live Class Invitation*\n` +
      `📖 *Subject*: ${session.title}\n` +
      `🌐 *Language/Department*: ${session.departmentName ?? "Languages"}\n` +
      `⏰ *Time*: ${startTime}\n` +
      `🎥 *Join on Google Meet*: ${meetLink}\n\n` +
      `Please be on time and join directly with your Google Meet link. Karibu!`;

    navigator.clipboard.writeText(text);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 3000);
  }

  return (
    <div className="space-y-4">
      {/* Feedback banner */}
      {message && (
        <div
          className={`p-3.5 rounded-2xl text-sm border ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border-red-500/20 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Language / Department Filter Tabs */}
      {departments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-2">
          <button
            type="button"
            onClick={() => setFilterDept("ALL")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              filterDept === "ALL"
                ? "bg-[var(--brand-primary)] text-white shadow"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            All Languages ({sessions.length})
          </button>
          {departments.map((dept) => {
            const count = sessions.filter((s) => s.departmentName === dept).length;
            const flag = sessions.find((s) => s.departmentName === dept)?.flagEmoji;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setFilterDept(dept)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterDept === dept
                    ? "bg-[var(--brand-primary)] text-white shadow"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {flag ? `${flag} ` : ""}
                {dept} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Sessions Grid */}
      <div className="grid gap-4">
        {filteredSessions.length ? (
          filteredSessions.map((session) => {
            const isLive = Boolean(session.liveStartedAt && !session.liveEndedAt);
            const isEnded = Boolean(session.liveEndedAt);
            const starts = new Date(session.startsAt);
            const ends = new Date(session.endsAt);

            return (
              <GlassCard
                key={session.id}
                className={`relative overflow-hidden p-5 transition-all ${
                  isLive
                    ? "border-emerald-500/50 bg-gradient-to-r from-emerald-950/30 to-blue-950/20 shadow-lg shadow-emerald-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {isLive && (
                  <div className="absolute top-0 right-0 rounded-bl-xl bg-emerald-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-ping rounded-full bg-black" />
                    LIVE ON GOOGLE MEET
                  </div>
                )}

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {session.departmentName && (
                        <span className="rounded-lg bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                          {session.flagEmoji ? `${session.flagEmoji} ` : ""}
                          {session.departmentName}
                        </span>
                      )}
                      {session.className && (
                        <span className="rounded-lg bg-white/10 px-2 py-0.5 text-xs opacity-75">
                          {session.className}
                        </span>
                      )}
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          Class Active
                        </span>
                      ) : isEnded ? (
                        <span className="text-xs opacity-50">Ended</span>
                      ) : (
                        <span className="text-xs opacity-70">Scheduled</span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-white">{session.title}</h3>

                    <p className="text-xs opacity-75">
                      🗓️ {starts.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                      {starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                      {ends.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {session.teacherName ? ` · Instructor: ${session.teacherName}` : ""}
                    </p>

                    {session.meetUrl && (
                      <div className="pt-1 flex items-center gap-2 text-xs">
                        <span className="font-semibold text-emerald-400">Google Meet:</span>
                        <code className="rounded bg-black/30 px-2 py-0.5 text-emerald-300 font-mono">
                          {session.meetUrl}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                    {/* Launch / Join Google Meet */}
                    {session.meetUrl && (
                      <a
                        href={`/api/portal/sessions/${session.id}/join`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95 transition-opacity"
                      >
                        <span>🎥</span>
                        <span>{isLive ? "Join Live Meet" : "Launch Google Meet"}</span>
                      </a>
                    )}

                    {/* Copy Invitation */}
                    <button
                      type="button"
                      onClick={() => copyInvitation(session)}
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10 transition-colors"
                      title="Copy invitation to send to students"
                    >
                      {copiedId === session.id ? "✓ Copied!" : "📋 Copy Invite"}
                    </button>

                    {/* Start / End class buttons for staff */}
                    {canManage && !isEnded && (
                      <>
                        {!isLive ? (
                          <button
                            type="button"
                            disabled={actionLoading === session.id}
                            onClick={() => handleSessionAction(session.id, "start")}
                            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === session.id ? "Starting..." : "Start Live Class"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoading === session.id}
                            onClick={() => handleSessionAction(session.id, "end")}
                            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === session.id ? "Ending..." : "End Live Class"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })
        ) : (
          <GlassCard className="p-8 text-center text-sm opacity-70">
            No live classes scheduled for this selection. Use the scheduler above to schedule a new live class with Google Meet!
          </GlassCard>
        )}
      </div>
    </div>
  );
}
