"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepareProfilePhoto } from "@/lib/prepare-profile-photo";

export function AdminStudentPhotoControl({ userId, hasPhoto }: { userId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload() {
    const photo = inputRef.current?.files?.[0];
    if (!photo) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("photo", await prepareProfilePhoto(photo));
      form.set("userId", userId);
      const response = await fetch("/api/portal/profile-photo", { method: "POST", body: form });
      const data: { error?: string } = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not save this student's photo.");
        return;
      }
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not save this student's photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid justify-items-start gap-1">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose passport photo" onChange={() => void upload()} />
      <button type="button" className="text-sm font-semibold text-[var(--brand-primary)] hover:underline disabled:opacity-50" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? "Uploading..." : hasPhoto ? "Replace photo" : "Upload passport photo"}
      </button>
      {error && <span className="max-w-52 text-xs text-[var(--danger)]" role="alert">{error}</span>}
    </div>
  );
}
