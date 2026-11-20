import { desc } from "drizzle-orm";
import { AdminSmsForm } from "@/components/admin-sms-form";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { smsCampaigns } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/cms", label: "CMS", icon: "📝" },
  { href: "/admin/sms", label: "Bulk SMS", icon: "✉️" },
];

export default async function AdminSmsPage() {
  await requireRole(["super_admin"]);
  const campaigns = await db.select().from(smsCampaigns).orderBy(desc(smsCampaigns.createdAt)).limit(20);
  const username = process.env.AFRICASTALKING_USERNAME;
  const providerReady = Boolean(username && process.env.AFRICASTALKING_API_KEY);
  const sandbox = username?.toLowerCase() === "sandbox";
  return (
    <PortalShell title="School Communications" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Bulk SMS</h1>
      <p className="text-sm opacity-65 mb-5">Only the school administrator can send messages to registered student contacts.</p>
      <GlassCard className="p-5 mb-5">
        <h2 className="font-semibold mb-2">Africa&apos;s Talking setup</h2>
        <ul className="space-y-1 text-sm">
          <li>API username and key: <strong>{providerReady ? "Configured" : "Missing"}</strong></li>
          <li>Environment: <strong>{sandbox ? "Sandbox" : username ? "Live account" : "Not configured"}</strong></li>
          <li>Uganda sender ID: <strong>{sandbox ? "Not needed in sandbox" : process.env.AFRICASTALKING_SENDER_ID ? "Configured" : "Missing"}</strong></li>
        </ul>
        <p className="mt-3 text-xs opacity-65">Sandbox messages only simulate delivery. Live delivery needs a funded provider account and an approved Uganda sender ID. A submitted campaign means the provider accepted it, not that every handset received it.</p>
      </GlassCard>
      <GlassCard className="p-5 mb-5"><AdminSmsForm /></GlassCard>
      <GlassCard className="p-5">
        <h2 className="font-semibold mb-3">Recent campaigns</h2>
        {campaigns.length ? <ul className="space-y-2">{campaigns.map((campaign: { id: string; message: string; createdAt: Date; status: string; recipientCount: number }) => (
          <li className="rounded-xl border border-white/10 p-3" key={campaign.id}>
            <p className="text-sm">{campaign.message}</p>
            <p className="mt-1 text-xs opacity-65">{campaign.createdAt.toLocaleString()} · {campaign.status} · {campaign.recipientCount} accepted</p>
          </li>
        ))}</ul> : <p className="text-sm opacity-65">No SMS campaigns have been submitted.</p>}
      </GlassCard>
    </PortalShell>
  );
}
