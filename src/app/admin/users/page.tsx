import Link from "next/link";
import Image from "next/image";
import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { AdminUserCreate } from "@/components/admin-user-create";
import { AdminUserArchiveOthers } from "@/components/admin-user-archive-others";
import { AdminApplicantPromote } from "@/components/admin-applicant-promote";
import { AdminUserStatus } from "@/components/admin-user-status";
import { AdminUserCredentials } from "@/components/admin-user-credentials";
import { AdminUserMfaReset } from "@/components/admin-user-mfa-reset";
import { AdminStudentPhotoControl } from "@/components/admin-student-photo-control";
import { StudentDocumentStampControl } from "@/components/student-document-stamp-control";
import { AdminUserClassAssignment } from "@/components/admin-user-class-assignment";
import { AdminUserEdit } from "@/components/admin-user-edit";
import { AdminUserArchiveButton, AdminUserPermanentDelete } from "@/components/admin-user-delete-actions";
import { and, asc, eq, ilike, inArray, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { classes, departments, enrolments, users } from "@/db/schema";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/users", label: "Users", icon: "👥" },
];

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; archived?: string; departmentId?: string }> }) {
  const actor = await requireRole(["super_admin", "admin"]);
  const { q = "", role = "", archived, departmentId = "" } = await searchParams;
  const includeArchived = archived === "1";
  const term = q.trim().slice(0, 80);
  const languageDepartments = await db.select({ id: departments.id, name: departments.name }).from(departments)
    .where(and(isNull(departments.deletedAt), eq(departments.isLanguage, true))).orderBy(asc(departments.name));
  const activeClasses = await db.select({
    id: classes.id,
    name: classes.name,
    departmentId: classes.departmentId,
    departmentName: departments.name,
    teacherId: classes.teacherId,
  }).from(classes)
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .where(isNull(classes.deletedAt))
    .orderBy(asc(departments.name), asc(classes.name));
  const assignedTeacherIds: string[] = Array.from(new Set(activeClasses.flatMap((schoolClass) => schoolClass.teacherId ? [schoolClass.teacherId] : [])));
  const activeTeacherRows = assignedTeacherIds.length
    ? await db.select({ id: users.id }).from(users).where(and(
      inArray(users.id, assignedTeacherIds), eq(users.role, "teacher"), ne(users.status, "archived"), isNull(users.deletedAt),
    ))
    : [];
  const activeTeacherIds = new Set(activeTeacherRows.map((teacher) => teacher.id));
  const classOptions = activeClasses.map((schoolClass) => ({
    ...schoolClass,
    teacherId: schoolClass.teacherId && activeTeacherIds.has(schoolClass.teacherId) ? schoolClass.teacherId : null,
  }));
  const classByTeacher = new Map<string, (typeof classOptions)[number]>(classOptions.filter((schoolClass) => schoolClass.teacherId)
    .map((schoolClass) => [schoolClass.teacherId as string, schoolClass] as const));
  const filters = [
    includeArchived ? undefined : isNull(users.deletedAt),
    term ? or(ilike(users.registrationNumber, `%${term}%`), ilike(users.displayName, `%${term}%`), ilike(users.email, `%${term}%`)) : undefined,
    role ? eq(users.role, role as typeof users.$inferSelect.role) : undefined,
    departmentId === "unassigned" ? isNull(users.departmentId) : departmentId ? eq(users.departmentId, departmentId) : undefined,
    includeArchived ? undefined : ne(users.status, "archived"),
  ].filter(Boolean);
  const all = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      departmentName: departments.name,
      departmentId: users.departmentId,
      email: users.email,
      role: users.role,
      status: users.status,
      registrationNumber: users.registrationNumber,
      address: users.address,
      nextOfKinName: users.nextOfKinName,
      nextOfKinPhone: users.nextOfKinPhone,
      studyFormat: users.studyFormat,
      studyDurationMonths: users.studyDurationMonths,
      requestedIntake: users.requestedIntake,
      avatarStorageKey: users.avatarStorageKey,
      documentStampedAt: users.documentStampedAt,
      documentStamperName: users.documentStamperName,
      documentStamperTitle: users.documentStamperTitle,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(users.registrationNumber), asc(users.createdAt));
  const studentIds = all.filter((account) => account.role === "student").map((account) => account.id);
  const studentEnrollments = studentIds.length
    ? await db.select({ studentId: enrolments.studentId, classId: enrolments.classId })
      .from(enrolments).innerJoin(classes, eq(enrolments.classId, classes.id))
      .where(and(inArray(enrolments.studentId, studentIds), eq(enrolments.status, "active"), isNull(classes.deletedAt)))
    : [];
  const classByStudent = new Map(studentEnrollments.map((enrollment) => [enrollment.studentId, enrollment.classId]));
  return (
    <PortalShell title="User Management" nav={nav}>
      <h1 className="display-font text-2xl font-bold mb-4">User accounts</h1>
      <GlassCard className="p-4 mb-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">{all.length} {includeArchived ? "account" : "active account"}{all.length === 1 ? "" : "s"}{term || role || departmentId ? " matching your filter" : ""}</p>
          <Link href={includeArchived ? "/admin/users" : "/admin/users?archived=1"} className="font-semibold underline underline-offset-4">
            {includeArchived ? "Hide archived accounts" : "Show archived accounts"}
          </Link>
        </div>
        <div className="rounded-xl border border-[var(--border-strong)] p-4">
          <h2 className="mb-2 font-bold">Account access reset</h2>
          <p className="mb-3 text-sm">Only the super admin can archive all other accounts. Archived accounts cannot sign in, and their learning, payment, and attendance history is retained.</p>
          {actor.role === "super_admin" && <AdminUserArchiveOthers />}
        </div>
        <form method="get" className="flex flex-wrap gap-2">
          {includeArchived && <input type="hidden" name="archived" value="1" />}
          <input name="q" defaultValue={term} placeholder="Search registration no. (e.g. DLA/2026/REG/0001), name or email" className="glass min-w-0 flex-1 px-4 py-2.5 outline-none" />
          <select name="role" defaultValue={role} className="glass px-3 py-2.5">
            <option value="">All roles</option>
            <option value="student">Student</option>
            <option value="applicant">Applicant</option>
            <option value="teacher">Teacher</option>
            <option value="finance">Finance</option>
            <option value="head_academics">Head of Academics</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <select name="departmentId" defaultValue={departmentId} className="glass min-w-48 px-3 py-2.5">
            <option value="">All language departments</option>
            <option value="unassigned">Department unassigned</option>
            {languageDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <button type="submit" className="glass px-4 py-2.5 font-semibold">Filter</button>
          {(term || role || departmentId) && <Link href={includeArchived ? "/admin/users?archived=1" : "/admin/users"} className="glass px-4 py-2.5">Clear filters</Link>}
        </form>
        <AdminUserCreate
          canCreateAdmin={actor.role === "super_admin"}
          departments={languageDepartments}
          classes={classOptions}
        />
      </GlassCard>
      <GlassCard className="overflow-hidden">
        <p className="px-4 pt-3 text-xs opacity-70">Scroll the table horizontally to reach password, authenticator, admission, photo, and document controls.</p>
        <div className="admin-user-create-scroll w-full overflow-x-auto px-3 pb-3" role="region" aria-label="User account table. Scroll horizontally to see all controls." tabIndex={0}>
          <table className="w-full min-w-[2200px] text-sm">
          <thead className="bg-white/5">
            <tr><th className="text-left p-3">Name / photo</th><th className="text-left p-3">Registration no.</th><th className="text-left p-3">Language department</th><th className="text-left p-3">Assigned class</th><th className="text-left p-3">Email / login</th><th className="text-left p-3">Role held</th><th className="text-left p-3">Status</th><th className="text-left p-3">Edit / delete</th><th className="min-w-[240px] text-left p-3">Issue credentials</th><th className="text-left p-3">Authenticator</th><th className="text-left p-3">Admission</th><th className="text-left p-3">Passport photo</th><th className="text-left p-3">Official student documents</th></tr>
          </thead>
          <tbody>
            {all.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="p-3"><span className="flex items-center gap-2">{["student", "applicant"].includes(u.role) && u.avatarStorageKey && <Image src={`/api/portal/profile-photo?userId=${u.id}`} alt={`${u.displayName ?? "Student"} passport photo`} width={40} height={48} unoptimized className="h-12 w-10 rounded object-cover" />}{u.displayName}</span>{u.role === "applicant" && <div className="max-w-xs text-xs opacity-65">{u.requestedIntake ? `Requested intake: ${u.requestedIntake} · ` : ""}{u.address ?? "Address missing"} · Next of kin: {u.nextOfKinName ?? "Not provided"} {u.nextOfKinPhone ?? ""} · {u.studyFormat?.replaceAll("_", " ") ?? "Format pending"} {u.studyDurationMonths === 0 ? "Full level" : u.studyDurationMonths ? `${u.studyDurationMonths} month(s)` : ""}</div>}</td>
                <td className="p-3 font-mono text-xs">{u.registrationNumber ?? "Not assigned"}</td>
                <td className="p-3">{u.departmentName ?? <span className="opacity-50">Not assigned</span>}</td>
                <td className="p-3">{(u.role === "teacher" || u.role === "student") && u.status !== "archived"
                  ? <AdminUserClassAssignment userId={u.id} role={u.role} departmentId={u.departmentId} assignedClassId={u.role === "teacher" ? classByTeacher.get(u.id)?.id ?? "" : classByStudent.get(u.id) ?? ""} departments={languageDepartments} classes={classOptions} />
                  : <span className="opacity-50">Not applicable</span>}</td>
                <td className="p-3 opacity-70">{u.email}</td>
                        <td className="p-3">
                          {u.status === "archived" && ["teacher", "finance", "head_academics"].includes(u.role)
                            ? <><strong>Gone {u.role === "head_academics" ? "Academic worker" : u.role === "finance" ? "Finance worker" : "Teacher"}</strong><div className="text-xs opacity-65">Previous role: {u.role}</div></>
                            : u.role}
                        </td>
                        <td className="p-3"><AdminUserStatus userId={u.id} status={u.status} isSelf={u.id === actor.id} /></td>
                        <td className="p-3"><div className="grid min-w-64 gap-2"><AdminUserEdit user={{ id: u.id, firstName: u.firstName, lastName: u.lastName, phone: u.phone, departmentId: u.departmentId }} departments={languageDepartments} departmentLocked={["student", "teacher"].includes(u.role)} disabled={u.id === actor.id || (actor.role === "admin" && ["admin", "super_admin"].includes(u.role))} /><AdminUserArchiveButton userId={u.id} name={u.displayName ?? u.email} isSelf={u.id === actor.id} archived={u.status === "archived"} />{includeArchived && <AdminUserPermanentDelete userId={u.id} email={u.email} canDelete={actor.role === "super_admin" || (actor.role === "admin" && !["admin", "super_admin"].includes(u.role))} />}</div></td>
                        <td className="p-3">{u.id === actor.id ? "Use administrator recovery" : <AdminUserCredentials userId={u.id} />}</td>
                        <td className="p-3">{u.id !== actor.id && <AdminUserMfaReset userId={u.id} />}</td>
                <td className="p-3">{u.role === "applicant" ? <AdminApplicantPromote userId={u.id} /> : "Not applicable"}</td>
                        <td className="p-3">{["student", "applicant"].includes(u.role) ? <AdminStudentPhotoControl userId={u.id} hasPhoto={Boolean(u.avatarStorageKey)} /> : "Not applicable"}</td>
                        <td className="p-3">{u.role === "student" ? <StudentDocumentStampControl studentId={u.id} stampedAt={u.documentStampedAt ? new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(u.documentStampedAt) : null} stamperName={u.documentStamperName} stamperTitle={u.documentStamperTitle} /> : "Not applicable"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </GlassCard>
    </PortalShell>
  );
}


