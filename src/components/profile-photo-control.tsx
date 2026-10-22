"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { prepareProfilePhoto } from "@/lib/prepare-profile-photo";

export function ProfilePhotoControl() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState("/api/portal/profile-photo");
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload() {
    const photo = inputRef.current?.files?.[0];
    if (!photo) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    try {
      form.set("photo", await prepareProfilePhoto(photo));
      const response = await fetch("/api/portal/profile-photo", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Profile photo upload failed.");
        return;
      }
      setPhotoUrl(`/api/portal/profile-photo?updated=${Date.now()}`);
      setAvailable(true);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload profile photo. Check your connection.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      {available && <Image src={photoUrl} alt="Your profile" width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" onError={() => setAvailable(false)} />}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose profile photo" onChange={() => void upload()} />
      <button type="button" disabled={busy} className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold" onClick={() => inputRef.current?.click()}>
        {busy ? "Uploading…" : available ? "Change photo" : "Add profile photo"}
      </button>
      {error && <span className="max-w-40 text-xs text-[var(--danger)]" role="alert">{error}</span>}
    </div>
  );
}
