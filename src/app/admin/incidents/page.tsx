import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { incidents } from "@/db/schema";
import { desc } from "drizzle-orm";

const nav = [{ href: "/admin", label: "Dashboard", icon: "🏠" }, { href: "/admin/incidents", label: "Incidents", icon: "🛡️" }];

export default async function AdminIncidents() {
  await requireRole(["super_admin"]);
  const records = await db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(100);
  return (
    <PortalShell title="Incident Centre" nav={nav}>
      <h1 className="display-font text-2xl font-bold mb-4">Incident Centre</h1>
      <p className="mb-4 text-sm opacity-70">Review moderation incidents. This list only displays masked incident details.</p>
      <GlassCard className="p-5" strong>
        {records.length ? <ul className="divide-y divide-[var(--border-strong)]">{records.map((incident) => (
          <li key={incident.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><div className="font-semibold">{incident.type}</div><div className="text-sm opacity-65">{incident.maskedContent ?? "No masked details"} · {incident.createdAt.toLocaleString()}</div></div>
            <span className="text-xs font-semibold uppercase">{incident.status}</span>
          </li>
        ))}</ul> : <p className="text-sm opacity-65">No incidents have been reported.</p>}
      </GlassCard>
    </PortalShell>
  );
}