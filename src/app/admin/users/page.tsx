import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { AdminUserCreate } from "@/components/admin-user-create";
import { AdminApplicantPromote } from "@/components/admin-applicant-promote";
import { AdminUserStatus } from "@/components/admin-user-status";
import { AdminUserCredentials } from "@/components/admin-user-credentials";
import { db } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/users", label: "Users", icon: "👥" },
];

export default async function AdminUsers() {
  const actor = await requireRole(["super_admin"]);
  const all = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      status: users.status,
      registrationNumber: users.registrationNumber,
      address: users.address,
      nextOfKinName: users.nextOfKinName,
      nextOfKinPhone: users.nextOfKinPhone,
      studyFormat: users.studyFormat,
      studyDurationMonths: users.studyDurationMonths,
    })
    .from(users);
  return (
    <PortalShell title="User Management" nav={nav}>
      <h1 className="display-font text-2xl font-bold mb-4">Users</h1>
      <GlassCard className="p-4 mb-4 space-y-4">
        <div className="text-sm opacity-70">{all.length} users</div>
        <AdminUserCreate />
      </GlassCard>
      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Registration no.</th><th className="text-left p-3">Email / login</th><th className="text-left p-3">Role held</th><th className="text-left p-3">Status</th><th className="text-left p-3">Issue credentials</th><th className="text-left p-3">Admission</th></tr>
          </thead>
          <tbody>
            {all.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="p-3">{u.displayName}{u.role === "applicant" && <div className="max-w-xs text-xs opacity-65">{u.address ?? "Address missing"} · Next of kin: {u.nextOfKinName ?? "Not provided"} {u.nextOfKinPhone ?? ""} · {u.studyFormat?.replaceAll("_", " ") ?? "Format pending"} {u.studyDurationMonths ? `${u.studyDurationMonths} month(s)` : ""}</div>}</td>
                <td className="p-3 font-mono text-xs">{u.registrationNumber ?? "—"}</td>
                <td className="p-3 opacity-70">{u.email}</td>
                        <td className="p-3">
                          {u.status === "archived" && ["teacher", "finance", "head_academics"].includes(u.role)
                            ? <><strong>Gone {u.role === "head_academics" ? "Academic worker" : u.role === "finance" ? "Finance worker" : "Teacher"}</strong><div className="text-xs opacity-65">Previous role: {u.role}</div></>
                            : u.role}
                        </td>
                        <td className="p-3"><AdminUserStatus userId={u.id} status={u.status} isSelf={u.id === actor.id} /></td>
                        <td className="p-3">{u.id === actor.id ? "Use administrator recovery" : <AdminUserCredentials userId={u.id} />}</td>
                <td className="p-3">{u.role === "applicant" ? <AdminApplicantPromote userId={u.id} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </PortalShell>
  );
}