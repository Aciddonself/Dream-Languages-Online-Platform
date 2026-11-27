"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DepartmentOption = { id: string; name: string };

export function AdminUserDepartment({
  userId,
  departmentId,
  departments,
}: {
  userId: string;
  departmentId: string | null;
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(departmentId ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!selectedId) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_department", userId, departmentId: selectedId }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not assign the language department.");
      setMessage("Saved");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save department.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-48 gap-1.5">
      <select aria-label="Student language department" className="glass w-full px-2 py-2" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">Choose language</option>
        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
      </select>
      <button type="button" onClick={save} disabled={!selectedId || saving || selectedId === departmentId} className="glass rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-45">
        {saving ? "Saving…" : "Save department"}
      </button>
      {message && <span className={message === "Saved" ? "text-xs text-emerald-700" : "max-w-48 text-xs text-red-700"} role="status">{message}</span>}
    </div>
  );
}
