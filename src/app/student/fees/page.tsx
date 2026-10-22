import Link from "next/link";
import { and, desc, eq, gte } from "drizzle-orm";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { feeSchedules, payments } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/exams", label: "Exams", icon: "📝" },
  { href: "/student/results", label: "Results", icon: "📊" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
  { href: "/student/community", label: "Community", icon: "💬" },
  { href: "/student/reviews", label: "Share a Review", icon: "⭐" },
];

export default async function StudentFeesPage() {
  const user = await requireRole(["student"]);
  const [schedules, paymentRows] = await Promise.all([
    db.select().from(feeSchedules).where(eq(feeSchedules.studentId, user.id)).orderBy(desc(feeSchedules.createdAt)),
    db.select().from(payments).where(and(eq(payments.studentId, user.id), gte(payments.createdAt, user.createdAt))).orderBy(desc(payments.createdAt)),
  ]);
  const currencies = [...new Set([...schedules.map((row) => row.currency), ...paymentRows.map((row) => row.currency)])];
  const totals = currencies.map((currency) => {
    const currencySchedules = schedules.filter((row) => row.currency === currency);
    const currencyPayments = paymentRows.filter((row) => row.currency === currency && row.status === "verified");
    return {
      currency,
      fees: currencySchedules.reduce((sum, row) => sum + row.amount, 0),
      balance: currencySchedules.reduce((sum, row) => sum + Math.max(0, row.amount - row.paid), 0),
      credited: currencySchedules.reduce((sum, row) => sum + row.paid, 0),
      totalPaid: currencyPayments.reduce((sum, row) => sum + row.amount, 0),
    };
  });
  return (
    <PortalShell title="Student Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Fees and Payments</h1>
      <p className="text-sm opacity-65 mb-5">Payment history is shown from your admission date ({user.createdAt.toLocaleDateString()}). Receipts become available after payment verification.</p>
      {totals.length ? <div className="mb-5 space-y-4">{totals.map((total) => (
        <div key={total.currency} className="grid gap-4 sm:grid-cols-3">
          <GlassCard className="p-5"><div className="text-sm opacity-65">Scheduled fees · {total.currency}</div><div className="mt-2 text-2xl font-bold">{total.currency} {total.fees.toLocaleString()}</div></GlassCard>
          <GlassCard className="p-5"><div className="text-sm opacity-65">Verified payments since admission</div><div className="mt-2 text-2xl font-bold">{total.currency} {total.totalPaid.toLocaleString()}</div><div className="text-xs opacity-60">Ledger credited: {total.currency} {total.credited.toLocaleString()}</div></GlassCard>
          <GlassCard className="p-5"><div className="text-sm opacity-65">Outstanding balance</div><div className="mt-2 text-2xl font-bold">{total.currency} {total.balance.toLocaleString()}</div><div className="text-xs opacity-60">{total.balance === 0 ? "No scheduled fees outstanding" : "Balance due"}</div></GlassCard>
        </div>
      ))}</div> : <GlassCard className="mb-5 p-5 text-sm opacity-65">No fee schedule has been assigned yet.</GlassCard>}
      <GlassCard className="p-5 mb-5">
        <h2 className="font-semibold mb-3">Fee schedule</h2>
        {schedules.length ? <div className="space-y-2">{schedules.map((fee) => (
          <div className="flex flex-wrap justify-between gap-2 rounded-xl border border-white/10 p-3 text-sm" key={fee.id}>
            <span>{fee.status} · Due {fee.dueDate ?? "date not set"}</span>
            <span>{fee.currency} {fee.paid.toLocaleString()} paid of {fee.amount.toLocaleString()}</span>
          </div>
        ))}</div> : <p className="text-sm opacity-65">No fee schedule has been assigned yet. Contact the finance office to confirm your programme charges.</p>}
      </GlassCard>
      <GlassCard className="p-5">
        <h2 className="font-semibold mb-3">Payment history</h2>
        {paymentRows.length ? <div className="space-y-2">{paymentRows.map((payment) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm" key={payment.id}>
            <div><div>{payment.currency} {payment.amount.toLocaleString()} · {payment.method} · {payment.status}</div><div className="text-xs opacity-60">{payment.createdAt.toLocaleString()} · Reference {payment.reference ?? "not supplied"}</div></div>
            {payment.status === "verified" && <Link className="font-semibold underline" href={`/api/portal/documents/receipt/${payment.id}`}>Download receipt PDF</Link>}
          </div>
        ))}</div> : <p className="text-sm opacity-65">No payments recorded since admission.</p>}
      </GlassCard>
    </PortalShell>
  );
}
