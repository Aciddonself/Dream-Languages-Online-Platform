"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { GlassButton, GlassCard } from "@/components/ui/glass";
import Image from "next/image";

type SessionOption = {
  id: string;
  title: string;
  className: string | null;
  startsAt: string;
  endsAt: string;
  liveStartedAt: string | null;
  liveEndedAt: string | null;
  teacherCheckInAt?: string | null;
  teacherCheckOutAt?: string | null;
  meetUrl: string | null;
};

type AttendanceState = {
  session: SessionOption;
  attendance?: {
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    confirmedAt: string | null;
  } | null;
  attendancePercent?: number;
  roster?: {
    studentId: string;
    name: string;
    avatarUrl: string | null;
    status: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    confirmedAt: string | null;
    attendancePercent: number;
  }[];
};

function time(value: string | null | undefined) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function AttendanceSessionPanel({
  sessions,
  audience,
}: {
  sessions: SessionOption[];
  audience: "student" | "teacher";
}) {
  const [states, setStates] = useState<Record<string, AttendanceState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [correction, setCorrection] = useState<{ sessionId: string; studentId: string } | null>(null);

  const refresh = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/academic/sessions/${sessionId}/attendance`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setStates((current) => ({ ...current, [sessionId]: data }));
        setErrors((current) => ({ ...current, [sessionId]: "" }));
      } else {
        setErrors((current) => ({ ...current, [sessionId]: data.error ?? "Could not load attendance." }));
      }
    } catch {
      setErrors((current) => ({ ...current, [sessionId]: "Unable to refresh attendance. Check your connection." }));
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      for (const session of sessions) void refresh(session.id);
    }, 0);
    const interval = window.setInterval(() => {
      for (const session of sessions) void refresh(session.id);
    }, 15_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [sessions, refresh]);

  async function act(sessionId: string, action: string, studentId?: string, details: Record<string, string> = {}) {
    setBusy((current) => ({ ...current, [sessionId]: true }));
    setErrors((current) => ({ ...current, [sessionId]: "" }));
    try {
      const response = await fetch(`/api/academic/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, studentId, ...details }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors((current) => ({ ...current, [sessionId]: data.error ?? "Attendance update failed." }));
        return false;
      }
      await refresh(sessionId);
      return true;
    } catch {
      setErrors((current) => ({ ...current, [sessionId]: "Unable to update attendance. Check your connection." }));
      return false;
    } finally {
      setBusy((current) => ({ ...current, [sessionId]: false }));
    }
  }

  function localDateTime(value: string) {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function submitCorrection(event: FormEvent<HTMLFormElement>, sessionId: string, studentId: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const status = String(formData.get("status"));
    const checkInAt = String(formData.get("checkInAt") ?? "");
    const checkOutAt = String(formData.get("checkOutAt") ?? "");
    const reason = String(formData.get("reason") ?? "");
    const details: Record<string, string> = { status, reason };
    if (status === "present") {
      details.checkInAt = new Date(checkInAt).toISOString();
      details.checkOutAt = new Date(checkOutAt).toISOString();
    }
    void act(sessionId, "correct", studentId, details).then((saved) => { if (saved) setCorrection(null); });
  }

  if (!sessions.length) {
    return <GlassCard className="p-6"><p className="opacity-70">No current or upcoming sessions are available.</p></GlassCard>;
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => {
        const state = states[session.id];
        const current = state?.session ?? session;
        const live = Boolean(current.liveStartedAt && !current.liveEndedAt);
        const attendee = state?.attendance;
        return (
          <GlassCard key={session.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-lg">{session.title}</h2>
                <p className="text-sm opacity-65">{session.className ?? "Class session"} · {new Date(session.startsAt).toLocaleString()}</p>
                <p className="mt-2 text-sm font-medium" aria-live="polite">{live ? "Class is live" : current.liveEndedAt ? "Class ended" : "Scheduled"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {audience === "teacher" ? (
                  <>
                    {!current.liveStartedAt && <GlassButton disabled={busy[session.id]} onClick={() => void act(session.id, "start")}>Start attendance</GlassButton>}
                    {live && <GlassButton variant="glass" disabled={busy[session.id]} onClick={() => void act(session.id, "end")}>End class</GlassButton>}
                  </>
                ) : (
                  <>
                    {session.meetUrl && live && <a className="btn-glass btn-glass-primary rounded-xl px-4 py-2 font-semibold" href={session.meetUrl} target="_blank" rel="noreferrer">Join class</a>}
                    {live && !attendee?.checkInAt && <GlassButton disabled={busy[session.id]} onClick={() => void act(session.id, "check_in")}>Check in</GlassButton>}
                    {live && attendee?.checkInAt && !attendee.checkOutAt && <GlassButton variant="glass" disabled={busy[session.id]} onClick={() => void act(session.id, "check_out")}>Check out</GlassButton>}
                  </>
                )}
              </div>
            </div>

            {audience === "teacher" ? (
              <>
                <p className="mt-3 text-sm opacity-70">Teacher check-in {time(current.teacherCheckInAt)} · check-out {time(current.teacherCheckOutAt)}</p>
                {state?.roster?.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead><tr className="text-left opacity-65"><th className="py-2">Student</th><th>Attendance</th><th>In</th><th>Out</th><th>Rate</th><th>Review</th></tr></thead>
                      <tbody>
                        {state.roster.map((student) => (
                          <tr key={student.studentId} className="border-t border-white/10">
                            <td className="py-2"><span className="flex items-center gap-2">{student.avatarUrl && <Image src={student.avatarUrl} alt="" width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />} {student.name}</span></td>
                            <td>{student.confirmedAt ? student.status : student.checkInAt ? "Needs confirmation" : student.status ?? "Not checked in"}</td>
                            <td>{time(student.checkInAt)}</td>
                            <td>{time(student.checkOutAt)}</td>
                            <td>{student.attendancePercent}%</td>
                            <td className="py-2">
                              {student.checkInAt && !student.confirmedAt && <button className="font-semibold underline" disabled={busy[session.id]} onClick={() => void act(session.id, "confirm", student.studentId)}>Confirm</button>}
                              {current.liveEndedAt && !student.checkInAt && <button className="font-semibold underline" disabled={busy[session.id]} onClick={() => void act(session.id, "mark_absent", student.studentId)}>Mark absent</button>}
                              {current.liveEndedAt && <button className="ml-2 font-semibold underline" onClick={() => setCorrection({ sessionId: session.id, studentId: student.studentId })}>Correct</button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="mt-4 text-sm opacity-60">No enrolled students in this class.</p>}
                {correction?.sessionId === session.id && (() => {
                  const student = state.roster?.find((item) => item.studentId === correction.studentId);
                  return student ? (
                    <form className="mt-4 grid gap-3 rounded-2xl border border-white/15 p-4 sm:grid-cols-2" onSubmit={(event) => submitCorrection(event, session.id, student.studentId)}>
                      <h3 className="font-semibold sm:col-span-2">Correct attendance for {student.name}</h3>
                      <label className="grid gap-1 text-sm">Status<select name="status" defaultValue={student.status === "absent" ? "absent" : "present"} className="rounded-xl border border-white/15 bg-transparent px-3 py-2"><option value="present">Present</option><option value="absent">Absent</option></select></label>
                      <label className="grid gap-1 text-sm">Check-in time<input name="checkInAt" type="datetime-local" required defaultValue={localDateTime(student.checkInAt ?? session.startsAt)} className="rounded-xl border border-white/15 bg-transparent px-3 py-2" /></label>
                      <label className="grid gap-1 text-sm">Check-out time<input name="checkOutAt" type="datetime-local" required defaultValue={localDateTime(student.checkOutAt ?? session.endsAt)} className="rounded-xl border border-white/15 bg-transparent px-3 py-2" /></label>
                      <label className="grid gap-1 text-sm sm:col-span-2">Reason for correction<textarea name="reason" required minLength={3} maxLength={1000} className="rounded-xl border border-white/15 bg-transparent px-3 py-2" /></label>
                      <div className="flex gap-3 sm:col-span-2"><GlassButton disabled={busy[session.id]}>Save correction</GlassButton><GlassButton type="button" variant="glass" onClick={() => setCorrection(null)}>Cancel</GlassButton></div>
                    </form>
                  ) : null;
                })()}
                {session.meetUrl && <a className="mt-3 inline-block text-sm font-semibold underline" href={session.meetUrl} target="_blank" rel="noreferrer">Open private class meeting</a>}
              </>
            ) : (
              <div className="mt-3 text-sm opacity-70">
                <p>Attendance: {state?.attendancePercent ?? 0}% across completed classes. Current class: {attendee?.status ?? "Not checked in"}{attendee?.confirmedAt ? " · Confirmed by teacher" : ""}.</p>
                <p className="mt-1">Check in while class is live, then check out when you leave. The teacher confirms your record.</p>
              </div>
            )}
            {errors[session.id] && <p className="mt-3 text-sm text-[var(--danger)]" role="alert">{errors[session.id]}</p>}
          </GlassCard>
        );
      })}
    </div>
  );
}
