"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ClassOption = { id: string; name: string; departmentId: string | null; departmentName: string | null; teacherId: string | null };
type DepartmentOption = { id: string; name: string };

export function AdminUserClassAssignment({
  userId,
  role,
  assignedClassId,
  assignedLevelCode = "",
  assignedLevelSummary = "",
  departmentId,
  departments,
  classes,
}: {
  userId: string;
  role: "student" | "teacher";
  assignedClassId: string;
  assignedLevelCode?: string;
  assignedLevelSummary?: string;
  departmentId: string | null;
  departments: DepartmentOption[];
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [selectedDepartment, setSelectedDepartment] = useState(departmentId ?? "");
  const [selectedClass, setSelectedClass] = useState(assignedClassId);
  const [selectedLevel, setSelectedLevel] = useState(assignedLevelCode);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const options = classes.filter((schoolClass) =>
    schoolClass.departmentId === selectedDepartment,
  );

  useEffect(() => {
    setSelectedDepartment(departmentId ?? "");
    setSelectedClass(assignedClassId);
    setSelectedLevel(assignedLevelCode);
  }, [assignedClassId, assignedLevelCode, departmentId]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role === "teacher"
          ? { action: "set_teacher_level", userId, departmentId: selectedDepartment, teachingLevel: selectedLevel }
          : { action: "set_class", userId, classId: selectedClass }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; levelCodes?: string[] };
      if (!response.ok) throw new Error(result.error ?? `Could not assign class (HTTP ${response.status}).`);
      setMessage(role === "teacher"
        ? `Teacher assigned to ${selectedLevel === "GENERAL" ? "all levels" : selectedLevel}${result.levelCodes?.length ? ` (${result.levelCodes.join(", ")})` : ""}.`
        : "Department and class assignment saved.");
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
      {role === "teacher" ? (
        <>
          <select
            className="glass rounded-lg px-2 py-2 text-xs"
            aria-label="Assigned teaching level"
            value={selectedLevel}
            disabled={!selectedDepartment}
            onChange={(event) => { setSelectedLevel(event.target.value); setMessage(""); }}
          >
            <option value="">{selectedDepartment ? "Choose a level" : "Choose a department first"}</option>
            {["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => <option key={level} value={level}>{level}</option>)}
            <option value="GENERAL">General · all levels</option>
          </select>
          {assignedLevelSummary && <span className="text-xs opacity-70">Currently assigned to {assignedLevelSummary}. Saving a level replaces that teacher’s current level assignments.</span>}
        </>
      ) : (
        <select
          className="glass rounded-lg px-2 py-2 text-xs"
          aria-label="Enrolled class"
          value={selectedClass}
          disabled={!selectedDepartment}
          onChange={(event) => { setSelectedClass(event.target.value); setMessage(""); }}
        >
          <option value="">{selectedDepartment ? "Choose a class" : "Choose a department first"}</option>
          {options.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
        </select>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || (role === "teacher"
          ? !selectedLevel || (selectedLevel === assignedLevelCode && selectedDepartment === (departmentId ?? ""))
          : !selectedClass || selectedClass === assignedClassId)}
        className="glass w-fit rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-45"
      >
        {saving ? "Saving…" : role === "teacher" ? "Save teaching assignment" : "Save class"}
      </button>
      {message && <span role="status" className="max-w-64 text-xs opacity-75">{message}</span>}
    </div>
  );
}
