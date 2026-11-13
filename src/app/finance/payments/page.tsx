import { desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { payments, users } from "@/db/schema";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { PaymentReviewControls } from "@/components/payment-review-controls";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/finance", label: "Dashboard", icon: "🏠" },
  { href: "/finance/payments", label: "Payments", icon: "💳" },
  { href: "/finance/holds", label: "Holds", icon: "⏸️" },
  { href: "/finance/reports", label: "Reports", icon: "📊" },
];

export default async function FinancePaymentsPage() {
  await requireRole(["finance", "super_admin"]);
  const rows = await db.select({
    id: payments.id, studentId: payments.studentId, amount: payments.amount, currency: payments.currency,
    method: payments.method, reference: payments.reference, status: payments.status, createdAt: payments.createdAt,
    name: users.displayName, firstName: users.firstName, lastName: users.lastName, email: users.email, registrationNumber: users.registrationNumber,
  }).from(payments).leftJoin(users, eq(payments.studentId, users.id)).orderBy(desc(payments.createdAt)).limit(250);

  return <PortalShell title="Payment Verification" nav={nav}>
    <h1 className="display-font mb-2 text-3xl font-bold">Payment Verification</h1>
    <p className="mb-5 text-sm opacity-70">Verify reported transfers to credit the student&apos;s fee balance, or reject them with a reason.</p>
    <div className="space-y-3">
      {rows.length ? rows.map((payment) => {
        const name = payment.name || [payment.firstName, payment.lastName].filter(Boolean).join(" ") || payment.email || "Student";
        return <GlassCard className="p-4" key={payment.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-semibold">{name}{payment.registrationNumber ? ` · ${payment.registrationNumber}` : ""}</div>
              <div className="mt-1 text-sm">{payment.currency} {payment.amount.toLocaleString()} · {payment.method.replaceAll("_", " ")}</div>
              <div className="text-sm opacity-65">Reference: {payment.reference ?? "Not supplied"} · {payment.createdAt.toLocaleString()}</div>
              {payment.status === "pending" && <div className="mt-3"><PaymentReviewControls paymentId={payment.id} /></div>}
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${payment.status === "verified" ? "bg-emerald-500/15 text-emerald-800" : payment.status === "rejected" ? "bg-red-500/15 text-red-800" : "bg-amber-500/15 text-amber-800"}`}>{payment.status}</span>
          </div>
        </GlassCard>;
      }) : <GlassCard className="p-5 text-sm opacity-65">No payment records have been submitted.</GlassCard>}
    </div>
  </PortalShell>;
}
