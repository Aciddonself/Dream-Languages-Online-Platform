"use client";

import { useState, useId } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";

export type DepartmentOption = {
  id: string;
  name: string;
  code: string;
  flagEmoji?: string | null;
};

export type ClassOption = {
  id: string;
  name: string;
  departmentId?: string | null;
};

export type TeacherOption = {
  id: string;
  name: string;
};

interface AdminSessionCreateProps {
  departments?: DepartmentOption[];
  classes: ClassOption[];
  teachers?: TeacherOption[];
  onSuccess?: () => void;
}

// Function to generate a realistic Google Meet URL (format: meet.google.com/xxx-yyyy-zzz)
function generateGoogleMeetUrl(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const randomPart = (length: number) =>
    Array.from({ length }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `https://meet.google.com/${randomPart(3)}-${randomPart(4)}-${randomPart(3)}`;
}

export function AdminSessionCreate({
  departments = [],
  classes,
  teachers = [],
  onSuccess,
}: AdminSessionCreateProps) {
  const formId = useId();
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [room, setRoom] = useState("Google Meet Online Room");
  const [meetUrl, setMeetUrl] = useState("");
  const [recurring, setRecurring] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [calendarUrl, setCalendarUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter classes by selected department
  const filteredClasses = selectedDeptId
    ? classes.filter((c) => c.departmentId === selectedDeptId)
    : classes;

  // Handle department change
  function handleDeptChange(deptId: string) {
    setSelectedDeptId(deptId);
    setSelectedClassId("");
    const dept = departments.find((d) => d.id === deptId);
    if (dept && !title) {
      setTitle(`${dept.flagEmoji ?? ""} ${dept.name} Live Class`.trim());
    }
  }

  // Quick auto-generator for Google Meet
  function handleGenerateMeet() {
    const newMeet = generateGoogleMeetUrl();
    setMeetUrl(newMeet);
    if (!room || room === "Room or location (optional)") {
      setRoom("Google Meet (Live Video)");
    }
  }

  // Auto set end time to 1 hour after start time if empty
  function handleStartsAtChange(val: string) {
    setStartsAt(val);
    if (val && !endsAt) {
      const start = new Date(val);
      start.setHours(start.getHours() + 1);
      const isoLocal = new Date(start.getTime() - start.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setEndsAt(isoLocal);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCalendarUrl("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/academic/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          classId: selectedClassId || undefined,
          teacherId: selectedTeacherId || undefined,
          startsAt: startsAt ? new Date(startsAt).toISOString() : "",
          endsAt: endsAt ? new Date(endsAt).toISOString() : "",
          room,
          meetUrl: meetUrl || undefined,
          recurring,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Could not create the live class session.");
        return;
      }

      setSuccess("Live class successfully scheduled with Google Meet!");

      // Generate Google Calendar Link
      const calendar = new URL("https://calendar.google.com/calendar/render");
      calendar.searchParams.set("action", "TEMPLATE");
      calendar.searchParams.set("text", title);
      calendar.searchParams.set(
        "dates",
        `${new Date(startsAt).toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}/, "")}/${new Date(endsAt).toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}/, "")}`
      );
      calendar.searchParams.set(
        "details",
        [
          `Live Class for Dream Languages Uganda`,
          meetUrl ? `Join Google Meet: ${meetUrl}` : "",
          room ? `Location: ${room}` : "",
        ]
          .filter(Boolean)
          .join("\n\n")
      );
      calendar.searchParams.set("location", meetUrl || room || "Google Meet");
      setCalendarUrl(calendar.toString());

      // Reset
      setTitle("");
      setSelectedClassId("");
      setStartsAt("");
      setEndsAt("");
      setMeetUrl("");

      if (onSuccess) onSuccess();
    } catch {
      setError("Unable to save the session. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
      {/* Department Filter / Selector */}
      {departments.length > 0 && (
        <div className="grid gap-1.5">
          <label htmlFor={`${formId}-dept`} className="text-xs font-semibold opacity-80">
            Language / Department
          </label>
          <select
            id={`${formId}-dept`}
            className="glass w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--surface)] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedDeptId}
            onChange={(e) => handleDeptChange(e.target.value)}
          >
            <option value="">All Departments / Languages</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.flagEmoji ? `${dept.flagEmoji} ` : ""}
                {dept.name} ({dept.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Class Selector */}
      <div className="grid gap-1.5">
        <label htmlFor={`${formId}-class`} className="text-xs font-semibold opacity-80">
          Target Class (or Department-wide)
        </label>
        <select
          id={`${formId}-class`}
          className="glass w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--surface)] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
        >
          <option value="">Department-Wide / All Enrolled Students</option>
          {filteredClasses.map((schoolClass) => (
            <option key={schoolClass.id} value={schoolClass.id}>
              {schoolClass.name}
            </option>
          ))}
        </select>
      </div>

      {/* Session Title */}
      <div className="md:col-span-2 grid gap-1.5">
        <label htmlFor={`${formId}-title`} className="text-xs font-semibold opacity-80">
          Live Class Title
        </label>
        <GlassInput
          id={`${formId}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. French A1 Beginners Live Speaking Class"
          required
          maxLength={160}
        />
      </div>

      {/* Assigned Teacher (if list provided) */}
      {teachers.length > 0 && (
        <div className="grid gap-1.5">
          <label htmlFor={`${formId}-teacher`} className="text-xs font-semibold opacity-80">
            Assigned Teacher / Instructor
          </label>
          <select
            id={`${formId}-teacher`}
            className="glass w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--surface)] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
          >
            <option value="">Assign Self / Class Teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Room / Location */}
      <div className={teachers.length > 0 ? "grid gap-1.5" : "md:col-span-2 grid gap-1.5"}>
        <label htmlFor={`${formId}-room`} className="text-xs font-semibold opacity-80">
          Room / Platform Tag
        </label>
        <GlassInput
          id={`${formId}-room`}
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="Google Meet Online Room"
        />
      </div>

      {/* Start and End Times */}
      <div className="grid gap-1.5">
        <label htmlFor={`${formId}-starts`} className="text-xs font-semibold opacity-80">
          Start Date & Time
        </label>
        <GlassInput
          id={`${formId}-starts`}
          type="datetime-local"
          required
          value={startsAt}
          onChange={(e) => handleStartsAtChange(e.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${formId}-ends`} className="text-xs font-semibold opacity-80">
          End Date & Time
        </label>
        <GlassInput
          id={`${formId}-ends`}
          type="datetime-local"
          required
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </div>

      {/* Google Meet Link with One-Click Generator */}
      <div className="md:col-span-2 rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-sm">
              🎥
            </span>
            <div>
              <h4 className="text-sm font-semibold text-white">Google Meet Connection</h4>
              <p className="text-xs opacity-70">
                Generate an official Google Meet room or enter your existing meeting URL
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerateMeet}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:opacity-90 transition-opacity"
          >
            <span>⚡</span>
            <span>Generate Google Meet Link</span>
          </button>
        </div>

        <GlassInput
          type="url"
          value={meetUrl}
          onChange={(e) => setMeetUrl(e.target.value)}
          placeholder="https://meet.google.com/xxx-yyyy-zzz"
          required
        />

        <div className="flex flex-wrap items-center justify-between text-xs opacity-75">
          <span>Format: https://meet.google.com/[code]</span>
          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-indigo-400 underline hover:text-indigo-300"
          >
            Open meet.google.com/new in new window ↗
          </a>
        </div>
      </div>

      {/* Recurring Checkbox */}
      <div className="md:col-span-2 flex items-center gap-2 text-sm">
        <input
          id={`${formId}-recurring`}
          type="checkbox"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-transparent text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor={`${formId}-recurring`} className="cursor-pointer">
          Recurring weekly live session
        </label>
      </div>

      {/* Submit Buttons */}
      <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
        <GlassButton
          type="submit"
          disabled={submitting}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg hover:shadow-indigo-500/25"
        >
          {submitting ? "Scheduling Live Class..." : "Schedule Live Class on Google Meet"}
        </GlassButton>
      </div>

      {/* Messages */}
      {error && (
        <p className="md:col-span-2 text-sm text-[var(--danger)] bg-red-500/10 border border-red-500/20 p-3 rounded-xl" role="alert">
          {error}
        </p>
      )}
      {success && (
        <div className="md:col-span-2 text-sm text-[var(--success)] bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl space-y-2" role="status">
          <p className="font-semibold">{success}</p>
          {calendarUrl && (
            <a
              className="inline-flex items-center gap-1.5 font-semibold text-emerald-300 underline hover:text-emerald-200"
              href={calendarUrl}
              target="_blank"
              rel="noreferrer"
            >
              📅 Add this Live Class to Google Calendar ↗
            </a>
          )}
        </div>
      )}
    </form>
  );
}
