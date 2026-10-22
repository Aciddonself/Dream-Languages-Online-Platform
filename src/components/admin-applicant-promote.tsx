"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminApplicantPromote({ userId }: { userId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [emailWarning, setEmailWarning] = useState("");
  const [loading, setLoading] = useState(false);

  async function admitApplicant() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "admit_applicant" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not admit applicant.");
        return;
      }
      setRegistrationNumber(data.user.registrationNumber ?? "");
      if (!data.emailSent) setEmailWarning(data.emailWarning ?? "Admission email was not sent; check the mail configuration and logs.");
      router.refresh();
    } catch {
      setError("Unable to update this application. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid justify-items-start gap-1">
      <button className="text-sm font-semibold text-[var(--brand-secondary-soft)] hover:underline disabled:opacity-50" type="button" onClick={admitApplicant} disabled={loading || Boolean(registrationNumber)}>
        {loading ? "Updating..." : registrationNumber ? "Admitted" : "Admit as student"}
      </button>
      {registrationNumber && <span className="font-mono text-xs">{registrationNumber}</span>}
      {emailWarning && <span className="max-w-60 text-xs text-[var(--warning)]" role="status">{emailWarning}</span>}
      {error && <span className="text-xs text-[var(--danger)]" role="alert">{error}</span>}
    </div>
  );
}
