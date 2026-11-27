"use client";

import { useEffect, useState } from "react";

type Student = { id: string; fullName: string; email: string; registrationNumber: string | null; status: string; feesComplete: boolean; hasFeeSchedule: boolean; balances: { currency: string; amount: number }[]; override: { reason: string; grantedAt: string } | null };
const format = (amount: number) => new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(amount);

export function StudentAccessOverrides() {
  const [students, setStudents] = useState<Student[]>([]);
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/finance/student-access", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load student fee access.");
      setStudents(data.students as Student[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load student fee access."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function changeAccess(student: Student) {
    const reason = student.override ? undefined : window.prompt(`Why should ${student.fullName} be allowed to access classes and assessments before fees are complete?`);
    if (!student.override && !reason?.trim()) return;
    setPending(student.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/finance/student-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(student.override ? { action: "revoke", studentId: student.id } : { action: "grant", studentId: student.id, reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Could not update access.");
      setNotice(student.override ? `Fee access exception removed for ${student.fullName}.` : `Temporary fee access approved for ${student.fullName}.`);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update access."); }
    finally { setPending(null); }
  }

  return <div className="space-y-4">
    <p className="text-sm opacity-70">Students need fully paid fee schedules before they can open learning materials, classes or assessments. An administrator can grant a recorded exception here.</p>
    {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm">{error}</p>}
    {busy ? <p className="p-4">Loading student balances…</p> : <div className="overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="border-b border-current/10"><th className="p-3">Student</th><th className="p-3">Fee status</th><th className="p-3">Balance</th><th className="p-3">Exception</th><th className="p-3">Action</th></tr></thead><tbody>
      {students.map((student) => <tr key={student.id} className="border-b border-current/5"><td className="p-3"><strong>{student.fullName}</strong><span className="block text-xs opacity-65">{student.registrationNumber ?? "No registration number"} · {student.email}</span></td><td className="p-3">{student.feesComplete ? "Fees complete" : student.hasFeeSchedule ? "Outstanding" : "No fee schedule"}</td><td className="p-3">{student.balances.length ? student.balances.map((item) => <span className="block" key={item.currency}>{item.currency} {format(item.amount)}</span>) : "—"}</td><td className="p-3">{student.override ? <span title={student.override.reason}>Granted · {new Date(student.override.grantedAt).toLocaleDateString()}</span> : "None"}</td><td className="p-3"><button type="button" className="btn-glass px-3 py-2 text-xs font-semibold" onClick={() => void changeAccess(student)} disabled={pending === student.id || (student.feesComplete && !student.override)}>{pending === student.id ? "Saving…" : student.override ? "Revoke exception" : "Grant exception"}</button></td></tr>)}
      {!students.length && <tr><td colSpan={5} className="p-4 opacity-65">No active students found.</td></tr>}
    </tbody></table></div>}
  </div>;
}
