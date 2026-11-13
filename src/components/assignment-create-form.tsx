"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";

type SchoolClass = { id: string; name: string };

export function AssignmentCreateForm({ classes }: { classes: SchoolClass[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/academic/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        classId: values.get("classId"), title: values.get("title"), description: values.get("description"),
        dueAt: values.get("dueAt") ? new Date(String(values.get("dueAt"))).toISOString() : undefined,
        maxScore: Number(values.get("maxScore")),
      }) });
      const data = await response.json();
      if (!response.ok) { setError(typeof data.error === "string" ? data.error : "Could not create assignment."); return; }
      form.reset(); setMessage("Assignment published to the selected class."); router.refresh();
    } catch { setError("Could not reach the assignment service."); }
    finally { setBusy(false); }
  }
  return <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
    <GlassInput name="title" placeholder="Assignment title" maxLength={180} required />
    <select name="classId" defaultValue="" className="glass rounded-xl px-4 py-2.5" required><option value="">Select class</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select>
    <textarea name="description" placeholder="Instructions and requirements" className="glass min-h-24 rounded-xl px-4 py-3 text-sm md:col-span-2" maxLength={5000} />
    <label className="grid gap-1 text-sm">Due date and time<GlassInput type="datetime-local" name="dueAt" /></label>
    <label className="grid gap-1 text-sm">Maximum score<GlassInput type="number" name="maxScore" min={1} max={1000} defaultValue={100} required /></label>
    <GlassButton type="submit" disabled={busy || !classes.length}>{busy ? "Publishing…" : "Create assignment"}</GlassButton>
    {error && <p role="alert" className="text-sm text-red-700 md:col-span-2">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700 md:col-span-2">{message}</p>}
    {!classes.length && <p className="text-sm opacity-65 md:col-span-2">Assign your account to a class before creating assignments.</p>}
  </form>;
}
