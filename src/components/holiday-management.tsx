"use client";

import { useEffect, useState } from "react";
import { formatHolidayDate } from "@/lib/holiday-dates";

type Holiday = {
  id: string;
  title: string;
  category: "public_holiday" | "other_holiday";
  startsOn: string;
  endsOn: string | null;
  details: string | null;
  status: string;
  approvedAt: string | null;
  reminderSentAt: string | null;
  createdAt: string;
};

function holidayDates(holiday: Holiday) {
  if (holiday.endsOn && holiday.endsOn !== holiday.startsOn) {
    return `${formatHolidayDate(holiday.startsOn)} – ${formatHolidayDate(holiday.endsOn)}`;
  }
  return formatHolidayDate(holiday.startsOn);
}

export function HolidayManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadHolidays() {
    setError("");
    try {
      const response = await fetch("/api/academic/holidays", { cache: "no-store" });
      const data: { holidays?: Holiday[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load school holidays.");
      setHolidays(data.holidays ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load school holidays.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/academic/holidays", { cache: "no-store" })
      .then(async (response) => {
        const data: { holidays?: Holiday[]; error?: string } = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load school holidays.");
        if (active) setHolidays(data.holidays ?? []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load school holidays.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function createHoliday(formElement: HTMLFormElement) {
    setBusyId("create");
    setError("");
    setMessage("");
    const form = new FormData(formElement);
    const endsOn = String(form.get("endsOn") ?? "");
    try {
      const response = await fetch("/api/academic/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          category: form.get("category"),
          startsOn: form.get("startsOn"),
          endsOn: endsOn || null,
          details: form.get("details"),
        }),
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save the holiday draft.");
      formElement.reset();
      setMessage("Holiday saved as a draft. It will only reach students after approval.");
      await loadHolidays();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not save the holiday draft.");
    } finally {
      setBusyId("");
    }
  }

  async function runAction(holiday: Holiday, action: "approve" | "retry_emails") {
    setBusyId(holiday.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/academic/holidays/${holiday.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: { error?: string; message?: string; sentCount?: number; failedCount?: number } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update the holiday.");
      setMessage(data.message ?? (action === "approve"
        ? `Holiday approved and published. ${data.sentCount ?? 0} student email(s) sent.`
        : `Email retry finished. ${data.sentCount ?? 0} email(s) sent; ${data.failedCount ?? 0} failed.`));
      await loadHolidays();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update the holiday.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="glass rounded-2xl p-5">
        <h2 className="mb-1 text-xl font-bold">Prepare a holiday announcement</h2>
        <p className="mb-4 text-sm opacity-70">Draft public and school holidays here. Students are notified in their portals and by email only after an administrator or the Head of Academics approves the draft.</p>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void createHoliday(event.currentTarget); }}>
          <label className="grid gap-1 text-sm font-medium">
            Holiday name
            <input name="title" required maxLength={180} className="glass rounded-xl px-3 py-2" placeholder="e.g. Independence Day" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Holiday category
            <select name="category" className="glass rounded-xl px-3 py-2">
              <option value="public_holiday">Public holiday</option>
              <option value="other_holiday">Other school holiday</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Starts on
            <input name="startsOn" type="date" required className="glass rounded-xl px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Ends on (optional)
            <input name="endsOn" type="date" className="glass rounded-xl px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium md:col-span-2">
            Details for students (optional)
            <textarea name="details" maxLength={2000} rows={3} className="glass rounded-xl px-3 py-2" placeholder="Add any useful instructions or school closure details." />
          </label>
          <button type="submit" disabled={busyId === "create"} className="btn-glass btn-glass-primary rounded-xl px-4 py-2 font-semibold disabled:opacity-50 md:col-span-2">
            {busyId === "create" ? "Saving draft..." : "Save holiday draft"}
          </button>
        </form>
      </section>

      {message && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm" role="status">{message}</p>}
      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm" role="alert">{error}</p>}

      <section>
        <h2 className="mb-3 text-xl font-bold">Holiday drafts and announcements</h2>
        {loading ? <p className="opacity-70">Loading holiday announcements...</p> : holidays.length ? (
          <ul className="grid gap-3">
            {holidays.map((holiday) => (
              <li key={holiday.id} className="glass rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{holiday.title}</h3>
                    <p className="text-sm opacity-75">{holiday.category === "public_holiday" ? "Public holiday" : "Other school holiday"} · {holidayDates(holiday)}</p>
                    {holiday.details && <p className="mt-2 whitespace-pre-wrap text-sm opacity-80">{holiday.details}</p>}
                    <p className="mt-2 text-xs opacity-60">
                      {holiday.status === "approved" ? `Approved${holiday.approvedAt ? ` on ${new Date(holiday.approvedAt).toLocaleString()}` : ""} · Published to students` : "Draft · Awaiting approval"}
                    </p>
                    {holiday.reminderSentAt && <p className="text-xs opacity-60">Approval reminder sent to administrators and the Head of Academics.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {holiday.status === "pending" ? (
                      <button type="button" onClick={() => void runAction(holiday, "approve")} disabled={busyId === holiday.id} className="btn-glass btn-glass-primary rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50">
                        {busyId === holiday.id ? "Approving..." : "Approve and notify students"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => void runAction(holiday, "retry_emails")} disabled={busyId === holiday.id} className="glass rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50">
                        {busyId === holiday.id ? "Sending..." : "Retry unsent student emails"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="glass rounded-xl p-4 text-sm opacity-70">No holiday drafts or announcements yet.</p>}
      </section>
    </div>
  );
}
