import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";

export function StudentFeeAccessNotice({ hasFeeSchedule, balances }: { hasFeeSchedule: boolean; balances: { currency: string; amount: number }[] }) {
  return <GlassCard className="mx-auto max-w-2xl border border-amber-500/30 p-6">
    <h1 className="display-font text-2xl font-bold">Fees need to be cleared before learning access</h1>
    <p className="mt-2 text-sm opacity-75">Classes, learning materials, assignments and tests open after the required fees are paid. If the school has approved an exception, ask an administrator to record it on your account.</p>
    <p className="mt-3 text-sm font-semibold">{hasFeeSchedule ? balances.map((item) => `${item.currency} ${item.amount.toLocaleString()} due`).join(" · ") || "Your fee record is being checked." : "No fee schedule is assigned to your account yet."}</p>
    <Link href="/student/fees" className="btn-glass btn-glass-primary mt-5 inline-flex px-4 py-2">View fees and payment information</Link>
  </GlassCard>;
}
