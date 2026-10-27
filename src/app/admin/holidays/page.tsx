import { HolidayManagement } from "@/components/holiday-management";
import { PortalShell } from "@/components/portal-shell";
import { requireRole } from "@/lib/rbac";
import type { NavItem } from "@/lib/portal-nav";

const nav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/holidays", label: "Holiday approvals", icon: "🌴" },
  { href: "/admin/users", label: "Users", icon: "👥" },
];

export default async function AdminHolidaysPage() {
  await requireRole(["super_admin"]);
  return (
    <PortalShell title="Holiday approvals" nav={nav}>
      <h1 className="mb-2 text-3xl font-bold">Holiday announcements</h1>
      <p className="mb-5 text-sm opacity-70">Create holiday drafts, approve announcements, and retry any student email deliveries that failed.</p>
      <HolidayManagement />
    </PortalShell>
  );
}
