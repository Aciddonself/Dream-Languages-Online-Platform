"use client";

import { useRef, useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";
import { toast } from "sonner";

const fileAccept = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function ApplicationFilePicker({ name, label, required = true }: { name: string; label: string; required?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  return (
    <div className="application-file-picker">
      <label htmlFor={`application-${name}`} className="text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id={`application-${name}`}
          className="sr-only"
          name={name}
          type="file"
          required={required}
          accept={fileAccept}
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
        />
        <button
          type="button"
          className="btn-glass rounded-xl px-4 py-2 text-sm font-semibold"
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </button>
        <span className="min-w-0 break-all text-xs opacity-70" aria-live="polite">
          {fileName || "No file selected"}
        </span>
      </div>
    </div>
  );
}

export function TeacherApplicationForm() {
  const [isVolunteer, setIsVolunteer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("isVolunteer", String(isVolunteer));
    try {
      const response = await fetch("/api/volunteer-applications", { method: "POST", body: form });
      const body = await response.text();
      let data: { error?: string } = {};
      try {
        data = JSON.parse(body) as { error?: string };
      } catch {
        data.error = `The application service returned an unexpected response (HTTP ${response.status}). Please try again.`;
      }
      if (!response.ok) {
        const message = data.error ?? "Could not submit your application.";
        setError(message);
        toast.error(message);
        return;
      }
      setSuccess(true);
      formElement.reset();
      toast.success("Application received. The DLA team will review it.");
    } catch (submissionError) {
      const message = submissionError instanceof Error && submissionError.name === "TypeError"
        ? "Unable to reach the application service. Check your connection and try again."
        : submissionError instanceof Error
          ? submissionError.message
          : "Unable to submit the application. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return <p className="rounded-2xl bg-emerald-500/10 p-5 text-sm" role="status">Thank you. Your teacher application has been sent to the school administrator for review.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Your details</legend>
        <GlassInput name="firstName" placeholder="First name" required maxLength={100} />
        <GlassInput name="lastName" placeholder="Last name" required maxLength={100} />
        <GlassInput name="email" type="email" placeholder="Email address" required maxLength={255} />
        <GlassInput name="phone" type="tel" placeholder="Working phone number" required maxLength={32} />
        <GlassInput name="address" placeholder="Current address" required maxLength={500} />
        <GlassInput name="languageTaught" placeholder="Language(s) you teach" required maxLength={160} />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-3 font-semibold">Work arrangement</legend>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={isVolunteer} onChange={(event) => setIsVolunteer(event.target.checked)} /> I am applying to volunteer</label>
        {!isVolunteer && (
          <div className="grid gap-3 sm:grid-cols-2">
            <GlassInput name="payPerSession" type="number" min={1} step={1} placeholder="Expected pay per session (UGX)" required />
            <select className="glass w-full px-4 py-2.5" name="availability" required defaultValue="">
              <option value="" disabled>Preferred work schedule</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
            </select>
            <GlassInput name="referenceName" placeholder="Reference person at previous school/workplace" required maxLength={160} />
            <GlassInput name="referencePhone" type="tel" placeholder="Reference person's working phone number" required maxLength={32} />
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Next of kin</legend>
        <GlassInput name="nextOfKinName" placeholder="Full name" required maxLength={160} />
        <GlassInput name="nextOfKinRelationship" placeholder="Relationship" required maxLength={80} />
        <GlassInput name="nextOfKinPhone" type="tel" placeholder="Working phone number" required maxLength={32} />
        <GlassInput name="nextOfKinAddress" placeholder="Address" required maxLength={500} />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">Application documents</legend>
        <ApplicationFilePicker name="cv" label="CV (PDF, DOC, or DOCX)" />
        <ApplicationFilePicker name="coverLetter" label="Cover letter (PDF, DOC, or DOCX)" />
        {!isVolunteer && <div className="sm:col-span-2"><ApplicationFilePicker name="recommendation" label="Recommendation letter from the school/workplace (PDF, DOC, or DOCX)" /></div>}
      </fieldset>
      <p className="text-xs opacity-65">Choose files up to 10 MB each. They are uploaded securely when you submit the application and are only available to authorized school administrators.</p>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      <GlassButton type="submit" loading={busy}>{busy ? "Uploading files and submitting..." : "Upload files & submit application"}</GlassButton>
    </form>
  );
}
