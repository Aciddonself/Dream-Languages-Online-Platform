"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClassOption = { id: string; name: string; departmentName: string | null; teacherId: string | null };

export function AdminUserClassAssignment({
  userId,
  assignedClassId,
  classes,
}: {
  userId: string;
  assignedClassId: string;
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(assignedClassId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_class", userId, classId: selected }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Could not assign class (HTTP ${response.status}).`);
      setMessage("Class assignment saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this class assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-64 gap-2">
      <select
        className="glass rounded-lg px-2 py-2 text-xs"
        aria-label="Assigned teaching class"
        value={selected}
        onChange={(event) => { setSelected(event.target.value); setMessage(""); }}
      >
        <option value="" disabled>Choose a class to assign</option>
        {classes.map((schoolClass) => {
          const takenByAnotherTeacher = schoolClass.teacherId && schoolClass.teacherId !== userId;
          return (
            <option key={schoolClass.id} value={schoolClass.id} disabled={Boolean(takenByAnotherTeacher)}>
              {schoolClass.name}{schoolClass.departmentName ? ` · ${schoolClass.departmentName}` : ""}{takenByAnotherTeacher ? " · assigned" : ""}
            </option>
          );
        })}
      </select>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || selected === assignedClassId}
        className="glass w-fit rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-45"
      >
        {saving ? "Saving…" : "Save class"}
      </button>
      {message && <span role="status" className="max-w-64 text-xs opacity-75">{message}</span>}
    </div>
  );
}
