"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput, GlassCard } from "@/components/ui/glass";

type RecordingItem = { id: string; title: string; description: string | null; fileName: string | null; uploadComplete: boolean; createdAt: string; className: string };
type ClassOption = { id: string; name: string };

function RecordingRows({ recordings }: { recordings: RecordingItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  async function remove(recordingId: string, title: string) {
    if (!window.confirm(`Permanently delete “${title}” and remove access for students?`)) return;
    setBusyId(recordingId); setError("");
    try {
      const response = await fetch("/api/admin/recordings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordingId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not delete the class recording.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete the recording."); }
    finally { setBusyId(""); }
  }
  return <div className="grid gap-4">{recordings.map((recording) => <GlassCard className="p-4" key={recording.id}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{recording.title}</h3><p className="text-sm opacity-65">{recording.className} · {recording.fileName ?? "Video"} · Added {new Date(recording.createdAt).toLocaleDateString()}{!recording.uploadComplete && " · Upload incomplete"}</p>{recording.description && <p className="mt-2 text-sm">{recording.description}</p>}</div><button type="button" onClick={() => void remove(recording.id, recording.title)} disabled={busyId === recording.id} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10">{busyId === recording.id ? "Deleting…" : "Delete recording"}</button></div>
    {recording.uploadComplete && <video className="mt-4 max-h-[32rem] w-full rounded-xl bg-black" controls preload="metadata" src={`/api/portal/recordings/${recording.id}`} aria-label={recording.title} />}
  </GlassCard>)}{!recordings.length && <p className="rounded-xl border border-white/10 p-4 text-sm opacity-65">No class recordings yet.</p>}{error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}</div>;
}

export function AdminRecordingLibrary({ classes, recordings }: { classes: ClassOption[]; recordings: RecordingItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) { setError("Choose an MP4, WebM, or MOV video file."); return; }
    if (file.size > 250 * 1024 * 1024) { setError("Choose a recording smaller than 250 MB."); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/admin/recordings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_upload", classId: data.get("classId"), title: data.get("title"), description: data.get("description"), fileName: file.name, contentType: file.type, fileSizeBytes: file.size }) });
      const prepared = await response.json() as { error?: string; recordingId?: string; path?: string; token?: string };
      if (!response.ok || !prepared.recordingId || !prepared.path || !prepared.token) throw new Error(prepared.error ?? "The private upload could not be prepared.");
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder-project.supabase.co", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key-for-builds-only", { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: uploadError } = await supabase.storage.from("class-materials").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const completed = await fetch("/api/admin/recordings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete_upload", recordingId: prepared.recordingId }) });
      const completion = await completed.json() as { error?: string };
      if (!completed.ok) throw new Error(completion.error ?? "Video uploaded, but its library record could not be completed.");
      form.reset(); setSuccess("Recording is saved privately and available to students in this class."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save the recording."); }
    finally { setBusy(false); }
  }
  return <div className="grid gap-5">
    <form className="grid gap-3 rounded-xl border border-white/10 p-4" onSubmit={submit}>
      <p className="text-sm opacity-70">Upload a recording produced with your meeting service (such as Google Meet). Use MP4, WebM, or MOV up to 250 MB. It is stored privately and shared only with the selected class and authorized staff.</p>
      <GlassInput name="title" placeholder="Recording title" required maxLength={180} />
      <select name="classId" className="glass w-full rounded-xl px-3 py-2.5" defaultValue="" required><option value="">Select class</option>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <GlassInput name="description" placeholder="Description (optional)" maxLength={2000} />
      <input className="glass w-full px-4 py-2.5 text-sm" name="file" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" required />
      <GlassButton type="submit" disabled={busy || classes.length === 0}>{busy ? "Uploading securely…" : "Save class recording"}</GlassButton>
      {!classes.length && <p className="text-sm opacity-65">Create a class first, then you can add recordings.</p>}
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}{success && <p className="text-sm text-[var(--success)]" role="status">{success}</p>}
    </form>
    <RecordingRows recordings={recordings} />
  </div>;
}
