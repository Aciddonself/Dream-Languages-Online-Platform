"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DocumentKey = "cv" | "cover-letter" | "recommendation";
type ApiResult = { error?: string; message?: string };

async function readResult(response: Response): Promise<ApiResult> {
  const body = await response.text();
  if (!body.trim()) throw new Error(`The document service returned an empty response (HTTP ${response.status}).`);
  try { return JSON.parse(body) as ApiResult; }
  catch { throw new Error(`The document service returned an invalid response (HTTP ${response.status}).`); }
}

export function TeacherApplicationDocumentControl({ applicationId, document, label }: { applicationId: string; document: DocumentKey; label: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endpoint = `/api/admin/volunteer-applications/${applicationId}/${document}`;

  async function download() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        const result = await readResult(response);
        throw new Error(result.error ?? "This application document is unavailable. Upload a replacement to restore it.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `${document}-${applicationId}`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this application document.");
    } finally { setBusy(false); }
  }

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(endpoint, { method: "POST", body: form });
      const result = await readResult(response);
      if (!response.ok) throw new Error(result.error ?? "Could not save this replacement document.");
      setNotice(`${label} replaced and saved securely.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this replacement document.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return <div className="grid justify-items-start gap-1">
    <div className="flex flex-wrap gap-2">
      <button type="button" className="text-sm font-semibold underline disabled:opacity-50" onClick={() => void download()} disabled={busy}>{busy ? "Working…" : `View ${label}`}</button>
      <button type="button" className="text-sm font-semibold underline disabled:opacity-50" onClick={() => input.current?.click()} disabled={busy}>Upload replacement</button>
      <input ref={input} className="sr-only" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={() => void upload()} aria-label={`Upload replacement ${label}`} />
    </div>
    {notice && <span role="status" className="text-xs text-emerald-700">{notice}</span>}
    {error && <span role="alert" className="max-w-xl text-xs text-red-700">{error}</span>}
  </div>;
}
