"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ClassOption = { id: string; name: string; departmentId: string | null; departmentName: string | null; teacherId: string | null };
type DepartmentOption = { id: string; name: string };
const courseLevels = ["A1", "A2", "B1", "B2", "C1", "C2"];
const levelSelections = [
  { value: "A1", label: "A1 only" }, { value: "A2", label: "A2 only" },
  { value: "B1", label: "B1 only" }, { value: "B2", label: "B2 only" },
  { value: "C1", label: "C1 only" }, { value: "C2", label: "C2 only" },
  { value: "A1-A2", label: "A1–A2 range" }, { value: "B1-B2", label: "B1–B2 range" },
  { value: "C1-C2", label: "C1–C2 range" }, { value: "GENERAL", label: "General · all levels" },
];

function selectionsFromAssignedCodes(codes: string[]) {
  const selected = new Set(codes.map((code) => code.toUpperCase()));
  if (courseLevels.every((code) => selected.has(code))) return ["GENERAL"];
  const result: string[] = [];
  for (const [range, pair] of [["A1-A2", ["A1", "A2"]], ["B1-B2", ["B1", "B2"]], ["C1-C2", ["C1", "C2"]]] as const) {
    if (pair.every((code) => selected.has(code))) {
      result.push(range);
      pair.forEach((code) => selected.delete(code));
    }
  }
  return [...result, ...courseLevels.filter((code) => selected.has(code))];
}

export function AdminUserClassAssignment({
  userId,
  role,
  assignedClassId,
  assignedLevelCodes = [],
  departmentId,
  departments,
  classes,
}: {
  userId: string;
  role: "student" | "teacher";
  assignedClassId: string;
  assignedLevelCodes?: string[];
  departmentId: string | null;
  departments: DepartmentOption[];
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [selectedDepartment, setSelectedDepartment] = useState(departmentId ?? "");
  const [selectedClass, setSelectedClass] = useState(assignedClassId);
  const [selectedLevels, setSelectedLevels] = useState(() => selectionsFromAssignedCodes(assignedLevelCodes));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const assignedLevelCodesKey = assignedLevelCodes.join(",");
  const options = classes.filter((schoolClass) =>
    schoolClass.departmentId === selectedDepartment,
  );

  useEffect(() => {
    setSelectedDepartment(departmentId ?? "");
    setSelectedClass(assignedClassId);
    setSelectedLevels(selectionsFromAssignedCodes(assignedLevelCodesKey ? assignedLevelCodesKey.split(",") : []));
  }, [assignedClassId, assignedLevelCodesKey, departmentId]);

  function toggleLevel(value: string) {
    setSelectedLevels((current) => {
      if (value === "GENERAL") return current.includes(value) ? [] : [value];
      const withoutGeneral = current.filter((level) => level !== "GENERAL");
      return withoutGeneral.includes(value) ? withoutGeneral.filter((level) => level !== value) : [...withoutGeneral, value];
    });
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role === "teacher"
          ? { action: "set_teacher_level", userId, departmentId: selectedDepartment, teachingLevels: selectedLevels }
          : { action: "set_class", userId, classId: selectedClass }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; levelCodes?: string[] };
      if (!response.ok) throw new Error(result.error ?? `Could not assign class (HTTP ${response.status}).`);
      setMessage(role === "teacher"
        ? `Teacher assigned to ${result.levelCodes?.join(", ") || "selected levels"}.`
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
          <fieldset className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg border border-[var(--border)] p-2 text-xs" disabled={!selectedDepartment}>
            <legend className="px-1">Teaching levels / ranges</legend>
            {levelSelections.map((option) => <label key={option.value} className="flex items-center gap-1.5">
              <input type="checkbox" checked={selectedLevels.includes(option.value)} onChange={() => { toggleLevel(option.value); setMessage(""); }} />
              <span>{option.label}</span>
            </label>)}
          </fieldset>
          <span className="text-xs opacity-70">Currently assigned to {assignedLevelCodes.length ? assignedLevelCodes.join(", ") : "no levels"}. General covers all levels in this language.</span>
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
          ? !selectedDepartment || !selectedLevels.length
          : !selectedClass || selectedClass === assignedClassId)}
        className="glass w-fit rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-45"
      >
        {saving ? "Saving…" : role === "teacher" ? "Save teaching assignment" : "Save class"}
      </button>
      {message && <span role="status" className="max-w-64 text-xs opacity-75">{message}</span>}
    </div>
  );
}
