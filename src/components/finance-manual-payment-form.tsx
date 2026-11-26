"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type DepartmentOption = { id: string; name: string };
type StudentOption = {
  id: string;
  name: string;
  registrationNumber: string | null;
  department: string | null;
  category: "new" | "continuing";
  hasFeeSchedule: boolean;
  balances: { currency: string; amount: number }[];
};

export function FinanceManualPaymentForm({ departments }: { departments: DepartmentOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [category, setCategory] = useState("all");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [currency, setCurrency] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const selected = students.find((student) => student.id === studentId);
  const balances = selected?.balances ?? [];
  const outstanding = balances.find((balance) => balance.currency === currency)?.amount ?? 0;

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingStudents(true);
      try {
        const params = new URLSearchParams({ q: query, category });
        if (departmentId) params.set("departmentId", departmentId);
        const response = await fetch(`/api/finance/payments/students?${params}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({})) as { students?: StudentOption[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load registered students.");
        setStudents(Array.isArray(data.students) ? data.students : []);
        setError("");
      } catch (cause) {
        if (!controller.signal.aborted) {
          setStudents([]);
          setError(cause instanceof Error ? cause.message : "Could not load registered students.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingStudents(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, departmentId, category]);

  function chooseStudent(id: string) {
    setStudentId(id);
    const student = students.find((item) => item.id === id);
    setCurrency(student?.balances[0]?.currency ?? "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true); setError(""); setNotice(""); setReceiptUrl("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/finance/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId, amount: Number(form.get("amount")), currency, method: form.get("method"), reference: form.get("reference"),
        }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; paymentId?: string; receiptNumber?: string };
      if (!response.ok) throw new Error(data.error ?? `Payment could not be saved (HTTP ${response.status}).`);
      setNotice(`Payment recorded and applied to the student’s fees. Receipt ${data.receiptNumber} is ready.`);
      if (data.paymentId) setReceiptUrl(`/api/portal/documents/receipt/${data.paymentId}`);
      formElement.reset();
      setStudentId(""); setCurrency(""); setQuery("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record this payment.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-white/45 p-4 sm:grid-cols-2 lg:grid-cols-3">
    <div className="sm:col-span-2 lg:col-span-3"><h2 className="text-lg font-bold">Record a payment received</h2><p className="text-sm opacity-70">Record money received at school. The receipt and collected totals will use the student&apos;s registered language department.</p></div>
    <label className="grid gap-1 text-sm font-semibold">Student category
      <select className="glass rounded-xl px-3 py-2.5" value={category} onChange={(event) => { setCategory(event.target.value); setStudentId(""); setCurrency(""); }}>
        <option value="all">New and continuing students</option>
        <option value="new">New student · no verified payment yet</option>
        <option value="continuing">Continuing · has a verified payment</option>
      </select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Language department
      <select className="glass rounded-xl px-3 py-2.5" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setStudentId(""); setCurrency(""); }}>
        <option value="">All language departments</option>
        <option value="unassigned">Department unassigned</option>
        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Search by name or registration number
      <input className="glass rounded-xl px-3 py-2.5" value={query} onChange={(event) => { setQuery(event.target.value); setStudentId(""); setCurrency(""); }} placeholder="Type a name or DLA registration number" autoComplete="off" />
    </label>
    <label className="grid gap-1 text-sm font-semibold sm:col-span-2 lg:col-span-1">Registered student
      <select className="glass rounded-xl px-3 py-2.5" value={studentId} onChange={(event) => chooseStudent(event.target.value)} required disabled={loadingStudents && !students.length}>
        <option value="">{loadingStudents ? "Searching students…" : "Choose a registered student"}</option>
        {students.map((student) => <option key={student.id} value={student.id}>
          {student.name}{student.registrationNumber ? ` · ${student.registrationNumber}` : " · no registration number"} · {student.department ?? "Unassigned"} · {student.category === "new" ? "New" : "Continuing"}{!student.hasFeeSchedule ? " · Fee setup needed" : ""}
        </option>)}
      </select>
      <span className="text-xs font-normal opacity-65">Only active or registered students with an outstanding fee balance are listed.</span>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Currency
      <select className="glass rounded-xl px-3 py-2.5" value={currency} onChange={(event) => setCurrency(event.target.value)} required disabled={!balances.length}>
        {balances.length ? balances.map((balance) => <option key={balance.currency} value={balance.currency}>{balance.currency} · balance {balance.amount.toLocaleString()}</option>) : <option value="">{selected && !selected.hasFeeSchedule ? "Assign fees first" : "Select a student first"}</option>}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Amount received
      <input className="glass rounded-xl px-3 py-2.5" name="amount" type="number" min="1" max={outstanding || undefined} step="1" required disabled={!selected || !selected.hasFeeSchedule} />
    </label>
    <label className="grid gap-1 text-sm font-semibold">Payment method
      <select className="glass rounded-xl px-3 py-2.5" name="method" required><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="momo">MTN Mobile Money</option><option value="airtel_money">Airtel Money</option><option value="other">Other</option></select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Reference or receipt note <span className="font-normal opacity-65">Optional for cash</span>
      <input className="glass rounded-xl px-3 py-2.5" name="reference" maxLength={160} placeholder="Bank reference, transaction ID, or cash note" />
    </label>
    <div className="flex items-end"><button className="btn-glass btn-glass-primary rounded-xl px-4 py-2.5 font-bold" disabled={busy || !selected || !selected.hasFeeSchedule || !balances.length}>{busy ? "Saving payment…" : "Record payment and issue receipt"}</button></div>
    {selected && (selected.hasFeeSchedule ? <p className="text-sm opacity-70 sm:col-span-2 lg:col-span-3">{selected.department ?? "Department unassigned"} · {selected.category === "new" ? "New student" : "Continuing student"} · Outstanding {currency}: {outstanding.toLocaleString()}</p> : <p className="text-sm text-amber-800 sm:col-span-2 lg:col-span-3">No fee schedule is set for this student yet. An admin or finance user must assign their language level and fees on the <a className="font-semibold underline" href="/finance/students">Student fees by language and level</a> page first.</p>)}
    {notice && <p role="status" className="text-sm text-emerald-700 sm:col-span-2 lg:col-span-3">{notice}</p>}
    {receiptUrl && <a className="text-sm font-semibold underline sm:col-span-2 lg:col-span-3" href={receiptUrl}>Download this receipt</a>}
    {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-3">{error}</p>}
    {!loadingStudents && !error && !students.length && <p className="text-sm opacity-70 sm:col-span-2 lg:col-span-3">No matching active or registered students were found.</p>}
  </form>;
}
