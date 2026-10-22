"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GlassButton, GlassInput } from "@/components/ui/glass";

export function AdminUserCreate() {
  const router = useRouter();
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
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          typeof result.error === "string"
            ? result.error
            : "Check the account details and try again.",
        );
        return;
      }
      setSuccess(
        result.user?.registrationNumber
          ? `Student created. Registration number: ${result.user.registrationNumber}`
          : "Account created.",
      );
      setForm({ email: "", password: "", firstName: "", lastName: "", role: "student" });
      router.refresh();
    } catch {
      setError("Unable to create account. Check your connection and try again.");
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
        minLength={12}
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
      <GlassButton type="submit" className="md:col-span-1" disabled={loading}>
        {loading ? "Creating..." : "Create user"}
      </GlassButton>
      {error && <p className="text-sm text-[var(--danger)] md:col-span-6">{String(error)}</p>}
      {success && <p className="text-sm text-[var(--success)] md:col-span-6" role="status">{success}</p>}
    </form>
  );
}
