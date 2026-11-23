"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClassOption = { id: string; name: string; departmentId: string | null; departmentName: string | null; teacherId: string | null };
type DepartmentOption = { id: string; name: string };

export function AdminUserClassAssignment({
  userId,
  role,
  assignedClassId,
  departmentId,
  departments,
  classes,
}: {
  userId: string;
  role: "student" | "teacher";
  assignedClassId: string;
  departmentId: string | null;
  departments: DepartmentOption[];
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [selectedDepartment, setSelectedDepartment] = useState(departmentId ?? "");
  const [selectedClass, setSelectedClass] = useState(assignedClassId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const options = classes.filter((schoolClass) =>
    schoolClass.departmentId === selectedDepartment &&
    (role === "student" || !schoolClass.teacherId || schoolClass.teacherId === userId),
  );

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_class", userId, classId: selectedClass }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Could not assign class (HTTP ${response.status}).`);
      setMessage("Department and class assignment saved.");
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
        aria-label="Language department for class assignment"
        value={selectedDepartment}
        onChange={(event) => { setSelectedDepartment(event.target.value); setSelectedClass(""); setMessage(""); }}
      >
        <option value="">Choose a language department</option>
        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
      </select>
      <select
        className="glass rounded-lg px-2 py-2 text-xs"
        aria-label={role === "teacher" ? "Assigned teaching class" : "Enrolled class"}
        value={selectedClass}
        disabled={!selectedDepartment}
        onChange={(event) => { setSelectedClass(event.target.value); setMessage(""); }}
      >
        <option value="">{selectedDepartment ? "Choose a class" : "Choose a department first"}</option>
        {options.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
      </select>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !selectedClass || selectedClass === assignedClassId}
        className="glass w-fit rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-45"
      >
        {saving ? "Saving…" : "Save class"}
      </button>
      {message && <span role="status" className="max-w-64 text-xs opacity-75">{message}</span>}
    </div>
  );
}
