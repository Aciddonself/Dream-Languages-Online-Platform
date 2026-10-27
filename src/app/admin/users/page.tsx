import Link from "next/link";
import Image from "next/image";
import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { AdminUserCreate } from "@/components/admin-user-create";
import { AdminApplicantPromote } from "@/components/admin-applicant-promote";
import { AdminUserStatus } from "@/components/admin-user-status";
import { AdminUserCredentials } from "@/components/admin-user-credentials";
import { AdminStudentPhotoControl } from "@/components/admin-student-photo-control";
import { StudentDocumentStampControl } from "@/components/student-document-stamp-control";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/users", label: "Users", icon: "👥" },
];

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const actor = await requireRole(["super_admin"]);
  const { q = "", role = "" } = await searchParams;
  const term = q.trim().slice(0, 80);
  const filters = [
    term ? or(ilike(users.registrationNumber, `%${term}%`), ilike(users.displayName, `%${term}%`), ilike(users.email, `%${term}%`)) : undefined,
    role ? eq(users.role, role as typeof users.$inferSelect.role) : undefined,
  ].filter(Boolean);
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
      avatarStorageKey: users.avatarStorageKey,
      documentStampedAt: users.documentStampedAt,
      documentStamperName: users.documentStamperName,
      documentStamperTitle: users.documentStamperTitle,
    })
    .from(users)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(users.registrationNumber), asc(users.createdAt));
  return (
    <PortalShell title="User Management" nav={nav}>
      <h1 className="display-font text-2xl font-bold mb-4">Users</h1>
      <GlassCard className="p-4 mb-4 space-y-4">
        <div className="text-sm opacity-70">{all.length} user{all.length === 1 ? "" : "s"}{term || role ? " matching your filter" : ""}</div>
        <form method="get" className="flex flex-wrap gap-2">
          <input name="q" defaultValue={term} placeholder="Search registration no. (e.g. DLA/2026/REG/0001), name or email" className="glass min-w-0 flex-1 px-4 py-2.5 outline-none" />
          <select name="role" defaultValue={role} className="glass px-3 py-2.5">
            <option value="">All roles</option>
            <option value="student">Student</option>
            <option value="applicant">Applicant</option>
            <option value="teacher">Teacher</option>
            <option value="finance">Finance</option>
            <option value="head_academics">Head of Academics</option>
            <option value="super_admin">Administrator</option>
          </select>
          <button type="submit" className="glass px-4 py-2.5 font-semibold">Filter</button>
          {(term || role) && <Link href="/admin/users" className="glass px-4 py-2.5">Clear</Link>}
        </form>
        <AdminUserCreate />
      </GlassCard>
      <GlassCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr><th className="text-left p-3">Name / photo</th><th className="text-left p-3">Registration no.</th><th className="text-left p-3">Email / login</th><th className="text-left p-3">Role held</th><th className="text-left p-3">Status</th><th className="text-left p-3">Issue credentials</th><th className="text-left p-3">Admission</th><th className="text-left p-3">Passport photo</th><th className="text-left p-3">Official student documents</th></tr>
          </thead>
          <tbody>
            {all.map((u: { id: string; displayName: string | null; role: string; status: string; registrationNumber: string | null; address: string | null; nextOfKinName: string | null; nextOfKinPhone: string | null; studyFormat: string | null; studyDurationMonths: number | null; email: string; avatarStorageKey: string | null; documentStampedAt: Date | null; documentStamperName: string | null; documentStamperTitle: string | null; }) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="p-3"><span className="flex items-center gap-2">{["student", "applicant"].includes(u.role) && u.avatarStorageKey && <Image src={`/api/portal/profile-photo?userId=${u.id}`} alt={`${u.displayName ?? "Student"} passport photo`} width={40} height={48} unoptimized className="h-12 w-10 rounded object-cover" />}{u.displayName}</span>{u.role === "applicant" && <div className="max-w-xs text-xs opacity-65">{u.address ?? "Address missing"} · Next of kin: {u.nextOfKinName ?? "Not provided"} {u.nextOfKinPhone ?? ""} · {u.studyFormat?.replaceAll("_", " ") ?? "Format pending"} {u.studyDurationMonths ? `${u.studyDurationMonths} month(s)` : ""}</div>}</td>
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
                        <td className="p-3">{["student", "applicant"].includes(u.role) ? <AdminStudentPhotoControl userId={u.id} hasPhoto={Boolean(u.avatarStorageKey)} /> : "—"}</td>
                        <td className="p-3">{u.role === "student" ? <StudentDocumentStampControl studentId={u.id} stampedAt={u.documentStampedAt ? new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(u.documentStampedAt) : null} stamperName={u.documentStamperName} stamperTitle={u.documentStamperTitle} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </PortalShell>
  );
}