"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassButton, GlassInput } from "@/components/ui/glass";
import { prepareProfilePhoto } from "@/lib/prepare-profile-photo";

export function AdminUserCreate() {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "student",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const payload = new FormData();
      for (const [key, value] of Object.entries(form)) payload.set(key, value);
      const photo = photoInput.current?.files?.[0];
      if (photo) payload.set("profilePhoto", await prepareProfilePhoto(photo));
      const response = await fetch("/api/admin/users", {
        method: "POST",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok) {
        const text = typeof result.error === "string" ? result.error : "Check the account details and try again.";
        setError(text);
        toast.error(text);
        return;
      }
      const roleLabel = ({ student: "Student", applicant: "Applicant", teacher: "Teacher", finance: "Finance officer", head_academics: "Head of Academics", super_admin: "Administrator" } as Record<string, string>)[form.role] ?? "User";
      const name = `${form.firstName} ${form.lastName}`.trim();
      const message = result.user?.registrationNumber
        ? `${roleLabel} ${name} created. Registration number: ${result.user.registrationNumber}`
        : `${roleLabel} ${name} created successfully.`;
      setSuccess(message);
      toast.success(message);
      setForm({ email: "", password: "", firstName: "", lastName: "", role: "student" });
      if (photoInput.current) photoInput.current.value = "";
      router.refresh();
    } catch (createError) {
      const text = createError instanceof Error ? createError.message : "Unable to create account. Check your connection and try again.";
      setError(text);
      toast.error(text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-6">
      <GlassInput
        className="md:col-span-1"
        placeholder="First name"
        value={form.firstName}
        onChange={(event) => setForm({ ...form, firstName: event.target.value })}
        required
      />
      <GlassInput
        className="md:col-span-1"
        placeholder="Last name"
        value={form.lastName}
        onChange={(event) => setForm({ ...form, lastName: event.target.value })}
        required
      />
      <GlassInput
        className="md:col-span-1"
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={(event) => setForm({ ...form, email: event.target.value })}
        required
      />
      <GlassInput
        className="md:col-span-1"
        type="password"
        placeholder="Temporary password"
        value={form.password}
        onChange={(event) => setForm({ ...form, password: event.target.value })}
        minLength={10}
        required
      />
      <select
        className="glass min-w-0 px-3 py-2.5 md:col-span-1"
        value={form.role}
        onChange={(event) => setForm({ ...form, role: event.target.value })}
      >
        <option value="student">Student</option>
        <option value="applicant">Applicant</option>
        <option value="teacher">Teacher</option>
        <option value="finance">Finance</option>
        <option value="head_academics">Head of Academics</option>
        <option value="super_admin">Administrator</option>
      </select>
      {form.role === "student" && (
        <label className="grid gap-1 text-xs md:col-span-2">
          <span>Passport-sized student photo (required)</span>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" required />
        </label>
      )}
      <GlassButton type="submit" className="md:col-span-2" disabled={loading}>
        {loading ? "Creating..." : "Create user"}
      </GlassButton>
      {error && <p className="text-sm text-[var(--danger)] md:col-span-6" role="alert">{String(error)}</p>}
      {success && <p className="text-sm text-[var(--success)] md:col-span-6" role="status">{success}</p>}
    </form>
  );
}
