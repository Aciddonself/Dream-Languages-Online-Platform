"use client";

import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";
import { prepareProfilePhoto } from "@/lib/prepare-profile-photo";
import { toast } from "sonner";

type DepartmentOption = { id: string; name: string };

export function ApplyForm({
  departments,
  initialDepartmentId = "",
}: {
  departments: DepartmentOption[];
  initialDepartmentId?: string;
}) {
  const [selectedDeptId, setSelectedDeptId] = useState(initialDepartmentId);
  const [isInternational, setIsInternational] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData(formElement);
      const photo = formData.get("profilePhoto");
      if (photo instanceof File) formData.set("profilePhoto", await prepareProfilePhoto(photo));
      const response = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });
      const body = await response.text();
      let data: { error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[]> }; message?: string };
      try {
        data = JSON.parse(body) as typeof data;
      } catch {
        throw new Error(`The application service returned an unexpected response (HTTP ${response.status}). Please try again later.`);
      }
      if (!response.ok) {
        const apiError = data.error;
        const fieldError = typeof apiError === "object" && apiError
          ? apiError.formErrors?.[0] ?? Object.values(apiError.fieldErrors ?? {}).flat()[0]
          : undefined;
        const message = (typeof apiError === "string" ? apiError : fieldError) ?? "Application failed. Check the form and try again.";
        setError(message);
        toast.error(message);
        return;
      }
      const message = data.message ?? "Application received. The administrator will review it and provide login credentials if accepted.";
      toast.success(message);
      setSuccess(message);
      formElement.reset();
      setIsInternational(false);
    } catch (submissionError) {
      const message = submissionError instanceof Error
        ? submissionError.message
        : "Unable to submit the application. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GlassInput name="firstName" placeholder="First name" required maxLength={100} />
        <GlassInput name="lastName" placeholder="Last name" required maxLength={100} />
      </div>
      <GlassInput name="email" type="email" placeholder="Email" required />
      <GlassInput name="phone" type="tel" placeholder="Phone number" required maxLength={32} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GlassInput name="dateOfBirth" type="date" aria-label="Date of birth" required />
        <GlassInput name="nationality" placeholder="Nationality" required maxLength={100} />
      </div>
      <GlassInput name="address" placeholder="Residential address" required maxLength={500} />
      <select
        className="glass w-full px-4 py-2.5"
        name="departmentId"
        required
        value={selectedDeptId}
        onChange={(e) => setSelectedDeptId(e.target.value)}
      >
        <option value="">Choose your preferred language or programme</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select className="glass w-full px-4 py-2.5" name="studyFormat" required defaultValue="">
          <option value="" disabled>Choose study format</option>
          <option value="regular">Regular</option>
          <option value="intensive">Intensive</option>
          <option value="super_intensive">Super intensive</option>
        </select>
        <select className="glass w-full px-4 py-2.5" name="studyDurationMonths" required defaultValue="">
          <option value="" disabled>Choose duration</option>
          <option value="1">1 month</option>
          <option value="2">2 months</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isInternational"
          checked={isInternational}
          onChange={(event) => setIsInternational(event.target.checked)}
        />
        I am an international student studying from outside Uganda
      </label>
      <input type="hidden" name="isInternationalValue" value={String(isInternational)} />
      <select className="glass w-full px-4 py-2.5" name="studyMode" required defaultValue="">
        <option value="" disabled>Choose in-person or online learning</option>
        <option value="physical">In-person</option>
        <option value="online">Online (Google Meet Live)</option>
      </select>
      <fieldset className="grid gap-3 rounded-2xl border border-white/15 p-4 sm:grid-cols-2">
        <legend className="px-2 font-semibold">Next of kin</legend>
        <GlassInput name="nextOfKinName" placeholder="Full name" required maxLength={160} />
        <GlassInput name="nextOfKinRelationship" placeholder="Relationship" required maxLength={80} />
        <GlassInput name="nextOfKinPhone" type="tel" placeholder="Working phone number" required maxLength={32} />
        <GlassInput name="nextOfKinAddress" placeholder="Address" required maxLength={500} />
      </fieldset>
      <label className="grid gap-2 text-sm">
        Profile photo (JPG, PNG, or WebP; max 5 MB)
        <input name="profilePhoto" type="file" required accept="image/jpeg,image/png,image/webp" />
      </label>
      <p className="text-xs opacity-60">
        The administrator reviews your complete application before confirming admission and issuing your login credentials. Online language classes require a computer or laptop, stable internet, and a quiet place to study.
      </p>
      {error && <div className="text-sm text-[var(--danger)]" role="alert">{String(error)}</div>}
      {success && <div className="text-sm text-[var(--success)]" role="status">{success}</div>}
      <GlassButton type="submit" className="w-full" loading={loading}>
        {loading ? "Submitting application..." : "Submit application"}
      </GlassButton>
    </form>
  );
}
