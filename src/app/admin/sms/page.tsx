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
  return (
    <PortalShell title="School Communications" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Bulk SMS</h1>
      <p className="text-sm opacity-65 mb-5">Only the school administrator can send messages to registered student contacts.</p>
      <GlassCard className="p-5 mb-5"><AdminSmsForm /></GlassCard>
      <GlassCard className="p-5">
        <h2 className="font-semibold mb-3">Recent campaigns</h2>
        {campaigns.length ? <ul className="space-y-2">{campaigns.map((campaign) => (
          <li className="rounded-xl border border-white/10 p-3" key={campaign.id}>
            <p className="text-sm">{campaign.message}</p>
            <p className="mt-1 text-xs opacity-65">{campaign.createdAt.toLocaleString()} · {campaign.status} · {campaign.recipientCount} accepted</p>
          </li>
        ))}</ul> : <p className="text-sm opacity-65">No SMS campaigns have been submitted.</p>}
      </GlassCard>
    </PortalShell>
  );
}
