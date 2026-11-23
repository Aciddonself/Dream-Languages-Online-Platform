"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DepartmentOption = { id: string; name: string };

export function AdminUserEdit({
  user,
  departments,
  disabled = false,
  departmentLocked = false,
}: {
  user: { id: string; firstName: string | null; lastName: string | null; phone: string | null; departmentId: string | null };
  departments: DepartmentOption[];
  disabled?: boolean;
  departmentLocked?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [departmentId, setDepartmentId] = useState(user.departmentId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit_profile", userId: user.id, firstName, lastName, phone, departmentId }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? `Could not update user (HTTP ${response.status}).`);
      setMessage("User details saved.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save user details.");
    } finally {
      setBusy(false);
    }
  }

  if (disabled) return <span className="text-xs opacity-60">Protected account</span>;

  return (
    <div className="min-w-64 space-y-2">
      <button type="button" className="glass rounded-lg px-3 py-1.5 text-xs font-semibold" onClick={() => setOpen((value) => !value)}>
        {open ? "Cancel edit" : "Edit user"}
      </button>
      {open && <div className="grid min-w-64 gap-2 rounded-lg border border-white/15 p-3">
        <label className="grid gap-1 text-xs">First name<input className="glass rounded-md px-2 py-1.5" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={100} required /></label>
        <label className="grid gap-1 text-xs">Last name<input className="glass rounded-md px-2 py-1.5" value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={100} required /></label>
        <label className="grid gap-1 text-xs">Phone<input className="glass rounded-md px-2 py-1.5" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} /></label>
        {departmentLocked
          ? <p className="text-xs opacity-75">Change the language department using the assigned class selector.</p>
          : <label className="grid gap-1 text-xs">Language department<select className="glass rounded-md px-2 py-1.5" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">No department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select></label>}
        <button type="button" onClick={() => void save()} disabled={busy || !firstName.trim() || !lastName.trim()} className="glass rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
      </div>}
      {message && <span role="status" className="block max-w-64 text-xs opacity-75">{message}</span>}
    </div>
  );
}
