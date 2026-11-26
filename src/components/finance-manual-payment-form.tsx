"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type StudentOption = {
  id: string;
  name: string;
  registrationNumber: string | null;
  department: string | null;
  balances: { currency: string; amount: number }[];
};

export function FinanceManualPaymentForm({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [currency, setCurrency] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const selected = students.find((student) => student.id === studentId);
  const balances = selected?.balances ?? [];
  const outstanding = balances.find((balance) => balance.currency === currency)?.amount ?? 0;

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
      setStudentId(""); setCurrency("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record this payment.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-[var(--border)] bg-white/45 p-4 sm:grid-cols-2 lg:grid-cols-3">
    <div className="sm:col-span-2 lg:col-span-3"><h2 className="text-lg font-bold">Record a payment received</h2><p className="text-sm opacity-70">For cash, bank, or mobile money received directly by the school. Saving posts it to the student’s fees and issues a receipt.</p></div>
    <label className="grid gap-1 text-sm font-semibold">Student
      <select className="glass rounded-xl px-3 py-2.5" value={studentId} onChange={(event) => chooseStudent(event.target.value)} required>
        <option value="">Choose a student</option>
        {students.map((student) => <option key={student.id} value={student.id}>{student.name}{student.registrationNumber ? ` · ${student.registrationNumber}` : ""}{student.department ? ` · ${student.department}` : ""}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Currency
      <select className="glass rounded-xl px-3 py-2.5" value={currency} onChange={(event) => setCurrency(event.target.value)} required disabled={!balances.length}>
        {balances.length ? balances.map((balance) => <option key={balance.currency} value={balance.currency}>{balance.currency} · balance {balance.amount.toLocaleString()}</option>) : <option value="">Select a student first</option>}
      </select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Amount received
      <input className="glass rounded-xl px-3 py-2.5" name="amount" type="number" min="1" max={outstanding || undefined} step="1" required />
    </label>
    <label className="grid gap-1 text-sm font-semibold">Payment method
      <select className="glass rounded-xl px-3 py-2.5" name="method" required><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="momo">MTN Mobile Money</option><option value="airtel_money">Airtel Money</option><option value="other">Other</option></select>
    </label>
    <label className="grid gap-1 text-sm font-semibold">Reference or receipt note <span className="font-normal opacity-65">Optional for cash</span>
      <input className="glass rounded-xl px-3 py-2.5" name="reference" maxLength={160} placeholder="Bank reference, transaction ID, or cash note" />
    </label>
    <div className="flex items-end"><button className="btn-glass btn-glass-primary rounded-xl px-4 py-2.5 font-bold" disabled={busy || !students.length}>{busy ? "Saving payment…" : "Record payment and issue receipt"}</button></div>
    {selected && <p className="text-sm opacity-70 sm:col-span-2 lg:col-span-3">Outstanding {currency}: {outstanding.toLocaleString()}</p>}
    {notice && <p role="status" className="text-sm text-emerald-700 sm:col-span-2 lg:col-span-3">{notice}</p>}
    {receiptUrl && <a className="text-sm font-semibold underline sm:col-span-2 lg:col-span-3" href={receiptUrl}>Download this receipt</a>}
    {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2 lg:col-span-3">{error}</p>}
    {!students.length && <p className="text-sm opacity-70 sm:col-span-2 lg:col-span-3">No students with an unpaid fee balance are available.</p>}
  </form>;
}
