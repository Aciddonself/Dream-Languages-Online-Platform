import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { PortalShell } from "@/components/portal-shell";
import { Badge, GlassButton, GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import {
  attendance,
  classes,
  communityGroups,
  examAttempts,
  exams,
  enrolments,
  feeSchedules,
  holds,
  materials,
  payments,
  results,
  supportTickets,
  timetableSessions,
  users,
} from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { portalSection } from "@/lib/portal-sections";
import { PORTAL_NAVS } from "@/lib/portal-nav";

const portalConfig = {
  admin: { title: "Admin Console", roles: ["super_admin"] },
  applicant: { title: "Applicant Portal", roles: ["applicant", "student", "super_admin"] },
  student: { title: "Student Portal", roles: ["student", "super_admin"] },
  teacher: { title: "Teacher Portal", roles: ["teacher", "head_academics", "super_admin"] },
  finance: { title: "Finance Portal", roles: ["finance", "super_admin"] },
  hoc: { title: "Head of Academics", roles: ["head_academics", "super_admin"] },
} as const;

type Row = { title: string; detail: string; status?: string };

function headingFromSlug(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function PortalSectionPage({
  params,
}: {
  params: Promise<{ portal: string; section: string[] }>;
}) {
  const { portal, section } = await params;
  const config = portalConfig[portal as keyof typeof portalConfig];
  if (!config || section.length !== 1) notFound();

  const user = await requireRole([...config.roles]);
  const currentSection = section[0];
  const nav = PORTAL_NAVS[portal];
  const title = nav.find((item) => item.href === `/${portal}/${currentSection}`)?.label ?? headingFromSlug(currentSection);
  let rows: Row[] = [];
  let description = `Your ${title.toLowerCase()} information and updates.`;
  const links: { href: string; label: string }[] = [];

  const extra = await portalSection(portal, currentSection, user);
  if (extra) {
    rows = extra.rows;
    description = extra.description;
    links.push(...(extra.links ?? []));
  } else if (portal === "student") {
    const enrolledClasses: Array<{ id: string; name: string }> = await db
      .select({ id: classes.id, name: classes.name })
      .from(enrolments)
      .innerJoin(classes, eq(enrolments.classId, classes.id))
      .where(eq(enrolments.studentId, user.id));
    const classIds = enrolledClasses.map((item: { id: string; name: string }) => item.id);

    if (currentSection === "exams" && classIds.length) {
      const records = await db.select().from(exams).where(and(inArray(exams.classId, classIds), eq(exams.published, true))).orderBy(desc(exams.createdAt));
      rows = records.map((exam: { title: string; startsAt?: Date | string | null; durationMinutes?: number | null }) => ({ title: exam.title, detail: `${exam.startsAt ? new Date(exam.startsAt).toLocaleString() : "Schedule to be announced"} · ${exam.durationMinutes ?? 60} minutes` }));
      description = "Published tests and examinations for your enrolled classes.";
    } else if (currentSection === "results") {
      const records = await db
        .select({ title: exams.title, score: results.score, grade: results.grade, comments: results.comments })
        .from(results)
        .leftJoin(exams, eq(results.examId, exams.id))
        .where(and(eq(results.studentId, user.id), eq(results.published, true)))
        .orderBy(desc(results.createdAt));
      rows = records.map((record: { title?: string | null; score?: number | string | null; grade?: string | null; comments?: string | null }) => ({ title: record.title ?? "Assessment", detail: `Score: ${record.score ?? "Pending"} · Grade: ${record.grade ?? "Not graded"}${record.comments ? ` · ${record.comments}` : ""}` }));
      description = "Results released by your academic team. Download the full exam and test statement below.";
      links.push({ href: "/api/portal/documents/results", label: "Download results PDF" });
    } else if (currentSection === "attendance") {
      const records = await db.select().from(attendance).where(eq(attendance.studentId, user.id)).orderBy(desc(attendance.markedAt)).limit(50);
      rows = records.map((record: { status: string; markedAt: Date | string; note?: string | null }) => ({ title: record.status, detail: `${new Date(record.markedAt).toLocaleString()}${record.note ? ` · ${record.note}` : ""}` }));
      description = "Your recorded attendance history.";
    } else if (currentSection === "materials" && classIds.length) {
      const records = await db.select().from(materials).where(inArray(materials.classId, classIds)).orderBy(desc(materials.createdAt));
      rows = records.map((record: { title: string; description?: string | null; type?: string | null }) => ({ title: record.title, detail: record.description ?? record.type ?? "Class learning material" }));
      description = "Learning materials shared with your classes.";
    } else if (currentSection === "fees") {
      const records = await db.select().from(feeSchedules).where(eq(feeSchedules.studentId, user.id)).orderBy(desc(feeSchedules.createdAt));
      rows = records.map((record: { status: string; paid: number; amount: number; dueDate?: Date | string | null }) => ({ title: record.status, detail: `UGX ${record.paid.toLocaleString()} paid of ${record.amount.toLocaleString()} · Due ${record.dueDate ? new Date(record.dueDate).toLocaleDateString() : "date not set"}` }));
      description = "Your fee schedule and payment progress.";
    } else if (currentSection === "community") {
      const records = classIds.length
        ? await db.select().from(communityGroups).where(inArray(communityGroups.classId, classIds))
        : [];
      rows = records.map((record: { name: string; description?: string | null; type?: string | null }) => ({ title: record.name, detail: record.description ?? `${record.type} learning group` }));
      description = "Learning groups for your class and programme.";
    } else {
      description = "Submit a request to the school and review its response here.";
      const records = await db.select().from(supportTickets).where(eq(supportTickets.userId, user.id)).orderBy(desc(supportTickets.createdAt));
      rows = records.map((record: { subject: string; body: string; status: string }) => ({ title: record.subject, detail: record.body, status: record.status }));
    }
  } else if (portal === "teacher") {
    if (currentSection === "classes") {
      const records = await db.select().from(classes).where(and(eq(classes.teacherId, user.id), isNull(classes.deletedAt)));
      rows = records.map((record: { name: string; capacity?: number | null }) => ({ title: record.name, detail: `Capacity: ${record.capacity ?? "Not set"}` }));
      description = "Classes assigned to your teacher account.";
    } else if (currentSection === "exams") {
      const records = await db.select().from(exams).where(eq(exams.teacherId, user.id)).orderBy(desc(exams.createdAt));
      rows = records.map((record: { title: string; published: boolean; durationMinutes?: number | null }) => ({ title: record.title, detail: `${record.published ? "Published" : "Awaiting review"} · ${record.durationMinutes ?? 60} minutes`, status: record.published ? "Published" : "Draft" }));
      description = "Your class assessments and publication state.";
    } else if (currentSection === "materials") {
      const records = await db.select().from(materials).where(eq(materials.teacherId, user.id)).orderBy(desc(materials.createdAt));
      rows = records.map((record: { title: string; description?: string | null; type?: string | null }) => ({ title: record.title, detail: record.description ?? record.type ?? "Learning material" }));
      description = "Materials shared with your classes.";
    } else if (currentSection === "live") {
      const records = await db.select().from(timetableSessions).where(eq(timetableSessions.teacherId, user.id)).orderBy(desc(timetableSessions.startsAt));
      rows = records.map((record: { title: string; startsAt: Date | string; meetUrl?: string | null }) => ({ title: record.title, detail: `${new Date(record.startsAt).toLocaleString()}${record.meetUrl ? " · Meet link ready" : " · Add a Google Meet link in Academic scheduling"}`, status: record.meetUrl ? "Meet ready" : "Scheduled" }));
      description = "Upcoming and previous live class sessions. Google Meet links are attached to scheduled sessions.";
      links.push({ href: "https://meet.google.com/new", label: "Create a Google Meet" });
    } else if (["attendance", "calendar"].includes(currentSection)) {
      const records = await db.select().from(timetableSessions).where(eq(timetableSessions.teacherId, user.id)).orderBy(desc(timetableSessions.startsAt));
      rows = records.map((record: { title: string; startsAt: Date | string }) => ({ title: record.title, detail: new Date(record.startsAt).toLocaleString() }));
      description = "Take and review attendance for your scheduled classes.";
    }
  } else if (portal === "finance") {
    if (currentSection === "holds") {
      const records = await db.select().from(holds).where(eq(holds.status, "active")).orderBy(desc(holds.placedAt));
      rows = records.map((record: { reason: string; studentId?: string | null; placedAt: Date | string; status: string }) => ({ title: record.reason, detail: `Student ID: ${record.studentId ?? "Not assigned"} · Since ${new Date(record.placedAt).toLocaleDateString()}`, status: record.status }));
      description = "Students currently placed on an account hold.";
    } else if (currentSection === "reports") {
      const records = await db.select().from(feeSchedules).orderBy(desc(feeSchedules.createdAt)).limit(100);
      rows = records.map((record: { currency: string; paid: number; amount: number; studentId?: string | null }) => ({ title: `${record.currency} ${record.paid.toLocaleString()} collected`, detail: `Student: ${record.studentId ?? "Unassigned"} · Balance: ${record.currency} ${Math.max(record.amount - record.paid, 0).toLocaleString()}` }));
      description = "Recent fee schedule and collection records.";
    } else if (["payments", "verification", "receipts"].includes(currentSection)) {
      const records = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(100);
      rows = records.map((record: { currency: string; amount: number; method: string; studentId?: string | null; createdAt: Date | string; status: string }) => ({ title: `${record.currency} ${record.amount.toLocaleString()} · ${record.method}`, detail: `Student: ${record.studentId ?? "Unassigned"} · ${new Date(record.createdAt).toLocaleDateString()}`, status: record.status }));
      description = "Payment records and verification statuses.";
    }
  } else if (portal === "hoc") {
    if (currentSection === "teachers") {
      const records = await db.select().from(users).where(eq(users.role, "teacher")).orderBy(users.firstName);
      rows = records.map((record: { displayName?: string | null; email: string; status: string }) => ({ title: record.displayName ?? record.email, detail: `${record.email} · ${record.status}` }));
      description = "Teacher directory and account status.";
    } else {
      const records = await db.select().from(exams).where(eq(exams.published, false)).orderBy(desc(exams.createdAt));
      rows = records.map((record: { title: string; teacherId?: string | null; createdAt: Date | string }) => ({ title: record.title, detail: `Teacher: ${record.teacherId ?? "Unassigned"} · Created ${new Date(record.createdAt).toLocaleDateString()}`, status: "Needs review" }));
      description = "Assessments awaiting academic approval.";
    }
  }

  return (
    <PortalShell title={config.title} nav={nav}>
      <div className="mb-6">
        <h1 className="display-font text-3xl font-bold">{title}</h1>
        <p className="text-sm opacity-65">{description}</p>
      </div>
      {links.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          {links.map((link) => (
            <Link href={link.href} key={link.href} target={link.href.startsWith("https:") ? "_blank" : undefined} rel={link.href.startsWith("https:") ? "noreferrer" : undefined}>
              <GlassButton variant="glass">{link.label}</GlassButton>
            </Link>
          ))}
        </div>
      )}
      <GlassCard className="p-5" strong>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold">{title} records</h2>
          <Badge tone={rows.length ? "info" : "warning"}>{rows.length} records</Badge>
        </div>
        {rows.length ? (
          <ul className="divide-y divide-[var(--border-strong)]">
            {rows.map((row, index) => (
              <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={`${row.title}-${index}`}>
                <div>
                  <div className="font-medium">{row.title}</div>
                  <div className="text-sm opacity-65">{row.detail}</div>
                </div>
                {row.status && <Badge tone={row.status.toLowerCase().includes("pending") || row.status.toLowerCase().includes("review") ? "warning" : "success"}>{row.status}</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-[var(--border-strong)] p-4 text-sm opacity-65">
            There are no {title.toLowerCase()} records to show yet. New school records will appear here when they are added.
          </p>
        )}
      </GlassCard>
    </PortalShell>
  );
}
