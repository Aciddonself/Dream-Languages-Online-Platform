"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GlassButton, GlassInput } from "@/components/ui/glass";

type ClassOption = { id: string; name: string };

export function MaterialUploadForm({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/portal/materials", { method: "POST", body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "The document could not be uploaded.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("Unable to upload the document. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
      <GlassInput name="title" placeholder="Document title" maxLength={160} required />
      <select className="glass w-full px-4 py-2.5" name="classId" defaultValue="" required>
        <option value="">Select class</option>
        {classes.map((schoolClass) => <option value={schoolClass.id} key={schoolClass.id}>{schoolClass.name}</option>)}
      </select>
      <GlassInput name="description" placeholder="Description (optional)" maxLength={2000} />
      <input className="glass w-full px-4 py-2.5 text-sm" name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" />
      <p className="text-xs opacity-65 md:col-span-2">PDF, Word, Excel, PowerPoint, CSV, or text · maximum 25 MB. Only enrolled students and authorized staff can download class documents.</p>
      <GlassButton type="submit" disabled={busy || !classes.length}>{busy ? "Uploading..." : "Upload document"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {!classes.length && <p className="text-sm opacity-65">No classes are available for your account.</p>}
    </form>
  );
}
