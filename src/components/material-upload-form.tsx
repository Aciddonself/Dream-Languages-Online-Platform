"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { GlassButton, GlassInput } from "@/components/ui/glass";

type ClassOption = { id: string; name: string };

export function MaterialUploadForm({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File)) {
      setError("Choose a learning material to upload.");
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      setError("Choose a file smaller than 250 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/portal/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_upload",
          classId: formData.get("classId"),
          title: formData.get("title"),
          description: formData.get("description"),
          fileName: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
        }),
      });
      const result = await response.json() as { error?: string; materialId?: string; path?: string; token?: string };
      if (!response.ok || !result.materialId || !result.path || !result.token) {
        setError(typeof result.error === "string" ? result.error : "The upload could not be prepared.");
        return;
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder-project.supabase.co",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key-for-builds-only",
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { error: uploadError } = await supabase.storage.from("class-materials")
        .uploadToSignedUrl(result.path, result.token, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const completed = await fetch("/api/portal/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_upload", materialId: result.materialId }),
      });
      const completedResult = await completed.json() as { error?: string };
      if (!completed.ok) throw new Error(completedResult.error ?? "Upload completed but could not be saved.");
      form.reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
      <GlassInput name="title" placeholder="Material title" maxLength={160} required />
      <select className="glass w-full px-4 py-2.5" name="classId" defaultValue="" required>
        <option value="">Select class</option>
        {classes.map((schoolClass) => <option value={schoolClass.id} key={schoolClass.id}>{schoolClass.name}</option>)}
      </select>
      <GlassInput name="description" placeholder="Description (optional)" maxLength={2000} />
      <input className="glass w-full px-4 py-2.5 text-sm" name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp3,.m4a,.wav,.ogg,.aac,.mp4,.webm,.mov" />
      <p className="text-xs opacity-65 md:col-span-2">Documents, audio (MP3, M4A, WAV, OGG, AAC), or video (MP4, WebM, MOV) · maximum 250 MB. Files go to private Supabase Storage; enrolled students can view or download them.</p>
      <GlassButton type="submit" disabled={busy || !classes.length}>{busy ? "Uploading to secure storage..." : "Upload learning material"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {!classes.length && <p className="text-sm opacity-65">No classes are available for your account.</p>}
    </form>
  );
}
