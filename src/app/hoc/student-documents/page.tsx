import Image from "next/image";
import { and, asc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { StudentDocumentStampControl } from "@/components/student-document-stamp-control";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import type { NavItem } from "@/lib/portal-nav";

const nav: NavItem[] = [
  { href: "/hoc", label: "Dashboard", icon: "🏠" },
  { href: "/hoc/student-documents", label: "Student IDs and document stamps", icon: "🪪" },
];

export default async function StudentDocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(["head_academics", "super_admin"]);
  const { q = "" } = await searchParams;
  const term = q.trim().slice(0, 80);
  const students = await db.select({
    id: users.id,
    name: users.displayName,
    registrationNumber: users.registrationNumber,
    status: users.status,
    avatarStorageKey: users.avatarStorageKey,
    documentStampedAt: users.documentStampedAt,
    documentStamperName: users.documentStamperName,
    documentStamperTitle: users.documentStamperTitle,
  }).from(users)
    .where(and(
      eq(users.role, "student"),
      inArray(users.status, ["active", "registered"]),
      isNull(users.deletedAt),
      term ? or(
        ilike(users.displayName, `%${term}%`),
        ilike(users.email, `%${term}%`),
        ilike(users.registrationNumber, `%${term}%`),
      ) : undefined,
    ))
    .orderBy(asc(users.registrationNumber), asc(users.createdAt))
    .limit(100);

  return (
    <PortalShell title="Student Documents" nav={nav}>
      <h1 className="display-font mb-2 text-3xl font-bold">Student IDs and report-card stamps</h1>
      <p className="mb-5 text-sm opacity-70">Stamping saves your name, role and current Uganda date to the student record. Students can then download the official digital ID and report cards. Search by name, email or registration number; at most 100 matches are shown.</p>
      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={term} placeholder="Search students" className="glass min-w-0 flex-1 px-4 py-2.5 outline-none" />
        <button type="submit" className="glass rounded-xl px-4 py-2.5 font-semibold">Search</button>
        {term && <Link href="/hoc/student-documents" className="glass rounded-xl px-4 py-2.5">Clear</Link>}
      </form>
      <div className="grid gap-3">
        {students.length ? students.map((student) => (
          <GlassCard key={student.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              {student.avatarStorageKey ? (
                <Image src={`/api/portal/profile-photo?userId=${student.id}`} alt={`${student.name ?? "Student"} passport photo`} width={48} height={60} unoptimized className="h-[60px] w-12 rounded-lg object-cover" />
              ) : (
                <div className="grid h-[60px] w-12 place-items-center rounded-lg bg-white/10 text-xs">No photo</div>
              )}
              <div>
                <h2 className="font-semibold">{student.name ?? "Student"}</h2>
                <p className="font-mono text-xs opacity-70">{student.registrationNumber ?? "Registration number pending"} · {student.status}</p>
                {!student.avatarStorageKey && <p className="text-xs text-[var(--warning)]">Student must upload a passport photo before downloading an ID.</p>}
              </div>
            </div>
            <StudentDocumentStampControl
              studentId={student.id}
              stampedAt={student.documentStampedAt ? new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeZone: "Africa/Kampala" }).format(student.documentStampedAt) : null}
              stamperName={student.documentStamperName}
              stamperTitle={student.documentStamperTitle}
            />
          </GlassCard>
        )) : (
          <GlassCard className="p-5 text-sm opacity-70">No active or registered students are available to stamp yet.</GlassCard>
        )}
      </div>
    </PortalShell>
  );
}
