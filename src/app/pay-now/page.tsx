import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GlassCard } from "@/components/ui/glass";

export const dynamic = "force-dynamic";

export default async function PayNowPage() {
  const [row] = await db.select().from(settings).where(eq(settings.key, "payment_details")).limit(1);
  const p = (row?.value as any) ?? {};
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">Pay Now</h1>
      <GlassCard className="p-6 space-y-2">
        <div className="font-semibold">Official Payment Details</div>
        <div className="text-sm opacity-80">Account name: {p.accountName}</div>
        <div className="text-sm opacity-80">Bank accounts: {(p.bankAccounts ?? []).join(", ")}</div>
        <div className="text-sm opacity-80">MTN Mobile Money merchant code: {p.mtnMerchant}</div>
        <div className="text-sm opacity-80">Airtel Money merchant code: {p.airtelMerchant}</div>
        <div className="text-sm opacity-70 mt-3">Always quote your registration number as the payment reference.</div>
      </GlassCard>
    </main>
  );
}