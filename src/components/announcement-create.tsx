"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";

type ClassOption = { id: string; name: string };

export function AnnouncementCreate({ classes, allowAll }: { classes: ClassOption[]; allowAll: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/academic/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.get("title"), body: data.get("body"), classId: data.get("classId") }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not publish the announcement.");
        return;
      }
      setSuccess("Announcement published to the selected audience.");
      form.reset();
      router.refresh();
    } catch {
      setError("Unable to publish the announcement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <GlassInput name="title" placeholder="Announcement title" maxLength={180} required />
      <textarea className="glass min-h-28 w-full rounded-xl px-4 py-3 text-sm" name="body" maxLength={5000} placeholder="Announcement details" required />
      <select className="glass w-full rounded-xl px-3 py-2.5 text-sm" name="classId" defaultValue="">
        {allowAll && <option value="">All students</option>}
        {!allowAll && <option value="">Select a class</option>}
        {classes.map((schoolClass) => <option value={schoolClass.id} key={schoolClass.id}>{schoolClass.name}</option>)}
      </select>
      <p className="text-xs opacity-65">Personal phone numbers and external contact links are blocked in announcements.</p>
      <GlassButton type="submit" disabled={busy || (!allowAll && !classes.length)}>{busy ? "Publishing..." : "Publish announcement"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {success && <p className="text-sm text-[var(--success)]" role="status">{success}</p>}
    </form>
  );
}
