"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Entry = {
  id: string; direction: "income" | "expense"; entryDate: string; weekStart: string;
  amount: number; currency: string; category: string; purpose: string; reference: string | null;
  recorder: string; createdAt: string;
};
type Week = { weekStart: string; income: Record<string, number>; expenses: Record<string, number>; opening: Record<string, number>; closing: Record<string, number>; entryCount: number };
type Report = { month: string; selectedWeekStart: string; selectedWeekEnd: string; openingBalance: Record<string, number>; entries: Entry[]; weeks: Week[]; monthOpening: Record<string, number>; monthIncome: Record<string, number>; monthExpenses: Record<string, number>; monthClosing: Record<string, number> };
const ugx = (value: number) => new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(value);
const today = () => new Date().toISOString().slice(0, 10);

export function FinanceCashbook() {
  const [weekDate, setWeekDate] = useState(today);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/finance/cashbook?week=${encodeURIComponent(weekDate)}&month=${encodeURIComponent(month)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load the cashbook.");
      setReport(data as Report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the cashbook.");
    } finally {
      setBusy(false);
    }
  }, [weekDate, month]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function addEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      direction: form.get("direction"), entryDate: form.get("entryDate"), amount: Number(form.get("amount")),
      currency: form.get("currency"), category: form.get("category"), purpose: form.get("purpose"), reference: form.get("reference"),
    };
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/finance/cashbook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Could not save this entry.");
      formElement.reset();
      setWeekDate(String(payload.entryDate));
      setMonth(String(payload.entryDate).slice(0, 7));
      setNotice("Cashbook entry saved and balances recalculated.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this entry.");
    } finally { setBusy(false); }
  }

  async function reverseEntry(entry: Entry) {
    const reason = window.prompt("Why are you reversing this entry? The original will remain in the audit trail.");
    if (!reason?.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/finance/cashbook", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not reverse this entry.");
      setNotice("Entry reversed. Weekly and monthly balances have been recalculated.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not reverse this entry."); }
    finally { setBusy(false); }
  }

  const currencyCodes = useMemo(() => [...new Set(["UGX", ...Object.keys(report?.monthOpening ?? {}), ...Object.keys(report?.monthIncome ?? {}), ...Object.keys(report?.monthExpenses ?? {})])], [report]);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-white/45 p-4">
      <label className="grid gap-1 text-sm font-semibold">Week containing date<input className="glass rounded-xl px-3 py-2" type="date" value={weekDate} onChange={(event) => setWeekDate(event.target.value)} /></label>
      <label className="grid gap-1 text-sm font-semibold">Monthly summary<input className="glass rounded-xl px-3 py-2" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
      <button className="btn-glass px-4 py-2" type="button" onClick={() => void refresh()} disabled={busy}>{busy ? "Refreshing…" : "Refresh balances"}</button>
      <a className="btn-glass btn-glass-primary px-4 py-2" href={`/api/finance/cashbook/report?month=${encodeURIComponent(month)}`}>Download monthly PDF</a>
    </div>

    {notice && <p role="status" className="rounded-xl border border-emerald-600/30 bg-emerald-500/10 p-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-600/30 bg-red-500/10 p-3 text-sm">{error}</p>}

    <form onSubmit={addEntry} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-white/45 p-4 md:grid-cols-4">
      <h2 className="md:col-span-4 text-lg font-bold">Record money received or spent</h2>
      <label className="grid gap-1 text-sm">Entry type<select name="direction" className="glass rounded-xl px-3 py-2.5"><option value="income">Money in</option><option value="expense">Money out</option></select></label>
      <label className="grid gap-1 text-sm">Date<input name="entryDate" type="date" defaultValue={today()} required className="glass rounded-xl px-3 py-2.5" /></label>
      <label className="grid gap-1 text-sm">Amount<input name="amount" type="number" min="1" step="1" required className="glass rounded-xl px-3 py-2.5" /></label>
      <label className="grid gap-1 text-sm">Currency<select name="currency" className="glass rounded-xl px-3 py-2.5"><option>UGX</option><option>USD</option><option>EUR</option><option>GBP</option><option>KES</option><option>TZS</option></select></label>
      <label className="grid gap-1 text-sm">Category<input name="category" maxLength={64} placeholder="Tuition, rent, supplies…" required className="glass rounded-xl px-3 py-2.5" /></label>
      <label className="grid gap-1 text-sm md:col-span-2">Purpose / details<input name="purpose" maxLength={500} required className="glass rounded-xl px-3 py-2.5" placeholder="What was received or what was purchased?" /></label>
      <label className="grid gap-1 text-sm">Reference<input name="reference" maxLength={160} className="glass rounded-xl px-3 py-2.5" placeholder="Receipt or transfer ref" /></label>
      <button className="btn-glass btn-glass-primary self-end px-4 py-2.5 font-bold" disabled={busy}>{busy ? "Saving…" : "Save entry"}</button>
      <p className="text-xs opacity-65 md:col-span-4">Entries are dated, attributed to the staff member who records them and can only be corrected by an audited reversal. Balances carry forward automatically by currency.</p>
    </form>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Monthly cash totals">
      {currencyCodes.map((currency) => <div key={currency} className="rounded-2xl border border-[var(--border)] bg-white/45 p-4">
        <div className="text-xs font-semibold uppercase opacity-60">{currency} · {month}</div>
        <div className="mt-2 text-sm">Brought forward <strong>{ugx(report?.monthOpening[currency] ?? 0)}</strong></div>
        <div className="text-sm">Received <strong>{ugx(report?.monthIncome[currency] ?? 0)}</strong></div>
        <div className="text-sm">Spent <strong>{ugx(report?.monthExpenses[currency] ?? 0)}</strong></div>
        <div className="mt-1 border-t border-current/10 pt-1 text-sm">Closing balance <strong>{ugx(report?.monthClosing[currency] ?? 0)}</strong></div>
      </div>)}
    </section>

    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/45">
      <div className="border-b border-current/10 p-4"><h2 className="font-bold">Weekly balances</h2><p className="text-sm opacity-65">Opening balance comes from earlier entries. Each closing balance rolls into the next week.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-current/10"><th className="p-3">Week starting</th><th className="p-3">Opening</th><th className="p-3">Money in</th><th className="p-3">Money out</th><th className="p-3">Closing</th><th className="p-3">Entries</th></tr></thead><tbody>
        {(report?.weeks ?? []).map((week) => <tr key={week.weekStart} className="border-b border-current/5"><td className="p-3 font-semibold">{week.weekStart}</td><td className="p-3">{Object.entries(week.opening).map(([c, n]) => <div key={c}>{c} {ugx(n)}</div>) || "—"}</td><td className="p-3">{Object.entries(week.income).map(([c, n]) => <div key={c}>{c} {ugx(n)}</div>)}</td><td className="p-3">{Object.entries(week.expenses).map(([c, n]) => <div key={c}>{c} {ugx(n)}</div>)}</td><td className="p-3 font-bold">{Object.entries(week.closing).map(([c, n]) => <div key={c}>{c} {ugx(n)}</div>)}</td><td className="p-3">{week.entryCount}</td></tr>)}
        {!report?.weeks.length && <tr><td colSpan={6} className="p-4 opacity-65">No weekly entries found for this month.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/45">
      <div className="border-b border-current/10 p-4"><h2 className="font-bold">Entries for week {report?.selectedWeekStart ?? ""} to {report?.selectedWeekEnd ?? ""}</h2></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-current/10"><th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Category</th><th className="p-3">Purpose</th><th className="p-3">Amount</th><th className="p-3">Recorded by</th><th className="p-3">Correct</th></tr></thead><tbody>
        {(report?.entries ?? []).map((entry) => <tr key={entry.id} className="border-b border-current/5"><td className="p-3">{entry.entryDate}</td><td className="p-3 font-semibold">{entry.direction === "income" ? "Money in" : "Money out"}</td><td className="p-3">{entry.category}</td><td className="p-3">{entry.purpose}{entry.reference ? <span className="block text-xs opacity-60">Ref: {entry.reference}</span> : null}</td><td className="p-3">{entry.currency} {ugx(entry.amount)}</td><td className="p-3">{entry.recorder}</td><td className="p-3"><button type="button" className="text-xs font-semibold underline" onClick={() => void reverseEntry(entry)} disabled={busy}>Reverse</button></td></tr>)}
        {!report?.entries.length && <tr><td colSpan={7} className="p-4 opacity-65">No entries for this week.</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
