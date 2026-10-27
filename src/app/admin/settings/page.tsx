import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { asc } from "drizzle-orm";
import { AdminOwnPasswordChange } from "@/components/admin-own-password-change";

const nav = [{ href: "/admin", label: "Dashboard", icon: "🏠" }, { href: "/admin/settings", label: "Settings", icon: "⚙️" }];

export default async function AdminSettings() {
  await requireRole(["super_admin"]);
  const records = await db.select({ key: settings.key, updatedAt: settings.updatedAt }).from(settings).orderBy(asc(settings.key));
  return (
    <PortalShell title="Settings" nav={nav}>
      <h1 className="display-font text-2xl font-bold mb-4">Settings</h1>
      <p className="mb-4 text-sm opacity-70">School profile, registration format, grading, academic calendar, fee policy, notifications, and integration settings.</p>
      <GlassCard className="p-5" strong>
        <h2 className="font-semibold mb-3">Configured setting keys</h2>
        {records.length ? <ul className="divide-y divide-[var(--border-strong)]">{records.map((record: { key: string; updatedAt: Date }) => (
          <li className="flex items-center justify-between gap-3 py-3" key={record.key}>
            <span className="font-medium">{record.key}</span><span className="text-xs opacity-60">Updated {record.updatedAt.toLocaleDateString()}</span>
          </li>
        ))}</ul> : <p className="text-sm opacity-65">No custom settings are configured yet.</p>}
      </GlassCard>
      <GlassCard className="mt-4 p-5" strong>
        <h2 className="font-semibold mb-2">Administrator password</h2>
        <p className="mb-4 text-sm opacity-70">Change your password while signed in. Use at least 12 characters and do not share it.</p>
        <AdminOwnPasswordChange />
      </GlassCard>
    </PortalShell>
  );
}