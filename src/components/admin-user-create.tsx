"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassButton, GlassInput } from "@/components/ui/glass";
import { prepareProfilePhoto } from "@/lib/prepare-profile-photo";

type DepartmentOption = { id: string; name: string };

export function AdminUserCreate({ canCreateAdmin = false, departments = [] }: { canCreateAdmin?: boolean; departments?: DepartmentOption[] }) {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "student",
    departmentId: "",
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
      const result = await response.json().catch(() => ({})) as { error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[]> }; user?: { registrationNumber?: string } };
      if (!response.ok) {
        const text = typeof result.error === "string" ? result.error
          : result.error?.formErrors?.[0] ?? Object.values(result.error?.fieldErrors ?? {}).flat()[0]
          ?? `The server could not create this account (HTTP ${response.status}). Please try again.`;
        setError(text);
        toast.error(text);
        return;
      }
      const roleLabel = ({ admin: "Admin", student: "Student", applicant: "Applicant", teacher: "Teacher", finance: "Finance officer", head_academics: "Head of Academics" } as Record<string, string>)[form.role] ?? "User";
      const name = `${form.firstName} ${form.lastName}`.trim();
      const message = result.user?.registrationNumber
        ? `${roleLabel} ${name} created. Registration number: ${result.user.registrationNumber}`
        : `${roleLabel} ${name} created successfully.`;
      setSuccess(message);
      toast.success(message);
      setForm({ email: "", password: "", firstName: "", lastName: "", role: "student", departmentId: "" });
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
    <div className="admin-user-create-scroll -mx-4 overflow-x-auto px-4 pb-3" role="region" aria-label="Add user form. Scroll horizontally to see all fields." tabIndex={0}>
      <form onSubmit={submit} className="grid min-w-[1540px] grid-cols-[150px_150px_230px_230px_180px_240px_220px] items-end gap-3">
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
          <span>First name</span>
          <GlassInput placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
          <span>Last name</span>
          <GlassInput placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
          <span>Email address</span>
          <GlassInput type="email" placeholder="name@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
          <span>Temporary password</span>
          <GlassInput type="password" placeholder="At least 10 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={10} required />
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
          <span>Account role</span>
          <select className="glass min-w-0 w-full px-3 py-2.5" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, departmentId: event.target.value === "student" || event.target.value === "applicant" ? form.departmentId : "" })}>
            <option value="student">Student</option>
            <option value="applicant">Applicant</option>
            <option value="teacher">Teacher</option>
            <option value="finance">Finance</option>
            <option value="head_academics">Head of Academics</option>
            {canCreateAdmin && <option value="admin">Admin</option>}
          </select>
        </label>
        {["student", "applicant"].includes(form.role) && (
          <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
            <span>Language department <span className="font-normal">(required)</span></span>
            <select className="glass min-w-0 w-full px-3 py-2.5" value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} required>
              <option value="">Choose a language</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
        )}
        {form.role === "student" && (
          <label className="grid min-w-0 gap-1.5 text-sm font-semibold">
            <span>Passport photo <span className="font-normal">(required)</span></span>
            <input ref={photoInput} className="min-w-0 max-w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
        )}
        <GlassButton type="submit" className="min-h-11 w-full" disabled={loading}>
          {loading ? "Creating..." : "Create user"}
        </GlassButton>
        {error && <p className="col-span-full text-sm text-[var(--danger)]" role="alert">{String(error)}</p>}
        {success && <p className="col-span-full text-sm text-[var(--success)]" role="status">{success}</p>}
      </form>
    </div>
  );
}
