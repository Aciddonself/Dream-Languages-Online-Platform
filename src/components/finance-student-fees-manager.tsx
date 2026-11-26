"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass";

type Level = { id: string; code: string; name: string; departmentId: string; departmentName: string };
type Schedule = { id: string; amount: number; paid: number; currency: string; dueDate: string; status: string; levelId: string | null; levelCode: string | null };
type Student = { id: string; name: string; email: string; registrationNumber: string | null; departmentId: string | null; departmentName: string | null; currentLevelId: string | null; currentLevelCode: string | null; schedules: Schedule[] };

export function FinanceStudentFeesManager({ students, levels }: { students: Student[]; levels: Level[] }) {
  if (!students.length) return <GlassCard className="p-5 text-sm opacity-70">No active or registered students match this search.</GlassCard>;
  return <div className="grid gap-4">{students.map((student) => {
    const options = levels.filter((level) => level.departmentId === student.departmentId);
    return <GlassCard key={student.id} className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="min-w-0"><h2 className="font-bold">{student.name}</h2>
          <p className="text-sm opacity-70">{student.registrationNumber ?? "Registration number pending"} · {student.departmentName ?? "Department unassigned"}</p>
          <p className="text-xs opacity-60">{student.email}</p></div>
        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold">{student.currentLevelCode ? "Assigned level " + student.currentLevelCode : "Level not assigned"}</span>
      </div>
      {student.schedules.length ? student.schedules.map((schedule) => <FeeScheduleEditor
        key={schedule.id + ":" + schedule.amount + ":" + schedule.paid + ":" + schedule.currency + ":" + schedule.dueDate + ":" + schedule.levelId}
        student={student} levels={options} schedule={schedule}
      />) : <p className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm opacity-70">No fee schedule yet. Add this student’s fees by language level before recording a payment.</p>}
      {student.departmentId ? <FeeScheduleEditor key={student.id + ":new"} student={student} levels={options} /> : <p className="text-sm text-amber-800">Assign a language department before setting fees by level.</p>}
      {student.departmentId && !options.length && <p className="text-sm text-amber-800">No active classes with language levels are available in this department.</p>}
    </GlassCard>;
  })}</div>;
}

function FeeScheduleEditor({ student, levels, schedule }: { student: Student; levels: Level[]; schedule?: Schedule }) {
  const router = useRouter();
  const [levelId, setLevelId] = useState(schedule?.levelId ?? student.currentLevelId ?? "");
  const [amount, setAmount] = useState(schedule ? String(schedule.amount) : "");
  const [currency, setCurrency] = useState(schedule?.currency ?? "UGX");
  const [dueDate, setDueDate] = useState(schedule?.dueDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/finance/student-fees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        studentId: student.id, scheduleId: schedule?.id, levelId, amount: Number(amount), currency, dueDate: dueDate || null,
      }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save this fee schedule.");
      setNotice("Fee details saved."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this fee schedule."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="grid gap-3 rounded-xl border border-[var(--border)] bg-white/25 p-3 sm:grid-cols-2 lg:grid-cols-5">
    <label className="grid gap-1 text-sm font-semibold sm:col-span-2 lg:col-span-1">Language level
      <select className="glass rounded-lg px-3 py-2" value={levelId} onChange={(event) => setLevelId(event.target.value)} required>
        <option value="">Choose level</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.departmentName} · {level.code} · {level.name}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Total fees due
      <input className="glass rounded-lg px-3 py-2" type="number" min={schedule?.paid || 1} max="100000000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required />
    </label>
    <label className="grid gap-1 text-sm font-semibold">Currency
      <select className="glass rounded-lg px-3 py-2" value={currency} onChange={(event) => setCurrency(event.target.value)} required><option value="UGX">UGX</option><option value="USD">USD</option></select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Due date
      <input className="glass rounded-lg px-3 py-2" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
    </label>
    <div className="flex items-end"><button type="submit" disabled={busy || !levels.length} className="btn-glass btn-glass-primary w-full rounded-lg px-3 py-2 font-semibold">{busy ? "Saving…" : schedule ? "Save fee edits" : "Assign fees"}</button></div>
    {schedule && <p className="text-xs opacity-70 sm:col-span-2 lg:col-span-5">{schedule.currency} {schedule.paid.toLocaleString()} paid · {schedule.currency} {Math.max(schedule.amount - schedule.paid, 0).toLocaleString()} outstanding · {schedule.levelCode ?? "Selected level"}</p>}
    {notice && <p role="status" className="text-sm text-emerald-700 sm:col-span-2 lg:col-span-5">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-5">{error}</p>}
  </form>;
}
