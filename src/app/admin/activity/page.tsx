import Link from "next/link";
import { and, asc, desc, eq, gte, isNull, isNotNull, ne, or } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { announcements, classes, departments, timetableSessions, users } from "@/db/schema";
import { PORTAL_NAVS } from "@/lib/portal-nav";
import { formatSchoolDateTime } from "@/lib/school-time";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<{ departmentId?: string }> }) {
  await requireRole(["super_admin", "admin"]);
  const { departmentId = "" } = await searchParams;
  const departmentFilter = departmentId ? eq(classes.departmentId, departmentId) : undefined;
  const now = new Date();
  const [languageDepartments, sessions, applicants, recentAnnouncements] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments)
      .where(and(eq(departments.isLanguage, true), isNull(departments.deletedAt))).orderBy(asc(departments.name)),
    db.select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
      liveStartedAt: timetableSessions.liveStartedAt,
      liveEndedAt: timetableSessions.liveEndedAt,
      meetUrl: timetableSessions.meetUrl,
      className: classes.name,
      departmentId: classes.departmentId,
      departmentName: departments.name,
      teacherName: users.displayName,
    }).from(timetableSessions)
      .leftJoin(classes, eq(timetableSessions.classId, classes.id))
      .leftJoin(departments, eq(classes.departmentId, departments.id))
      .leftJoin(users, eq(timetableSessions.teacherId, users.id))
      .where(and(or(
        and(isNotNull(timetableSessions.liveStartedAt), isNull(timetableSessions.liveEndedAt)),
        gte(timetableSessions.startsAt, now),
      ), departmentFilter))
      .orderBy(asc(timetableSessions.startsAt)).limit(150),
    db.select({ id: users.id, displayName: users.displayName, firstName: users.firstName, lastName: users.lastName, email: users.email, createdAt: users.createdAt, departmentName: departments.name })
      .from(users).leftJoin(departments, eq(users.departmentId, departments.id))
      .where(and(eq(users.role, "applicant"), ne(users.status, "archived"), isNull(users.deletedAt), departmentId ? eq(users.departmentId, departmentId) : undefined))
      .orderBy(desc(users.createdAt)).limit(100),
    db.select({ id: announcements.id, title: announcements.title, audience: announcements.audience, publishedAt: announcements.publishedAt, departmentId: announcements.departmentId, departmentName: departments.name })
      .from(announcements).leftJoin(departments, eq(announcements.departmentId, departments.id))
      .where(departmentId ? eq(announcements.departmentId, departmentId) : undefined)
      .orderBy(desc(announcements.publishedAt)).limit(30),
  ]);
  const liveSessions = sessions.filter((session) => session.liveStartedAt && !session.liveEndedAt);
  const scheduledSessions = sessions.filter((session) => session.startsAt >= now && !(session.liveStartedAt && !session.liveEndedAt));
  const nav = PORTAL_NAVS.admin;

  return (
    <PortalShell title="Admin Console" nav={nav}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="display-font text-3xl font-bold">School activity</h1><p className="text-sm opacity-65">Live classes, upcoming schedules, new applications, and announcements across departments.</p></div>
        <form method="get" className="flex flex-wrap gap-2">
          <select name="departmentId" defaultValue={departmentId} className="glass rounded-xl px-3 py-2.5">
            <option value="">All language departments</option>
            {languageDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <button className="btn-glass px-4 py-2.5" type="submit">Filter</button>
        </form>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ActivityCard title="Live classes" count={liveSessions.length} empty="There are no classes live right now.">
          {liveSessions.map((session) => <ActivityRow key={session.id} title={session.title} detail={`${session.departmentName ?? "Whole school"}${session.className ? ` · ${session.className}` : ""} · ${session.teacherName ?? "Teacher not assigned"} · Started ${formatSchoolDateTime(session.liveStartedAt!)}`} badge="LIVE" href={session.meetUrl ?? undefined} />)}
        </ActivityCard>
        <ActivityCard title="Upcoming scheduled classes" count={scheduledSessions.length} empty="No classes are scheduled.">
          {scheduledSessions.map((session) => <ActivityRow key={session.id} title={session.title} detail={`${session.departmentName ?? "Whole school"}${session.className ? ` · ${session.className}` : ""} · ${session.teacherName ?? "Teacher not assigned"} · ${formatSchoolDateTime(session.startsAt)}`} badge="Scheduled" href={session.meetUrl ?? undefined} />)}
        </ActivityCard>
        <ActivityCard title="New student applications" count={applicants.length} empty="There are no applications waiting for review.">
          {applicants.map((applicant) => <ActivityRow key={applicant.id} title={applicant.displayName ?? (`${applicant.firstName ?? ""} ${applicant.lastName ?? ""}`.trim() || applicant.email)} detail={`${applicant.departmentName ?? "Department not selected"} · Applied ${formatSchoolDateTime(applicant.createdAt)}`} badge="Review" href="/admin/users?role=applicant" />)}
        </ActivityCard>
        <ActivityCard title="Recent announcements" count={recentAnnouncements.length} empty="No announcements have been published yet.">
          {recentAnnouncements.map((announcement) => <ActivityRow key={announcement.id} title={announcement.title} detail={`${announcement.audience === "all" ? "Whole school" : announcement.departmentName ?? (announcement.audience === "class" ? "Selected class" : "Language department")} · ${formatSchoolDateTime(announcement.publishedAt)}`} badge="Published" href="/admin/cms" />)}
        </ActivityCard>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/admin/calendar" className="btn-glass px-4 py-2.5">Open school calendar</Link>
        <Link href="/admin/users?role=applicant" className="btn-glass px-4 py-2.5">Review applications</Link>
        <Link href="/admin/cms" className="btn-glass px-4 py-2.5">Publish announcement</Link>
      </div>
    </PortalShell>
  );
}

function ActivityCard({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return <GlassCard className="p-5" strong>
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2><span className="rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-xs">{count}</span></div>
    {count ? <ul className="divide-y divide-[var(--border-strong)]">{children}</ul> : <p className="rounded-xl border border-[var(--border-strong)] p-4 text-sm opacity-65">{empty}</p>}
  </GlassCard>;
}

function ActivityRow({ title, detail, badge, href }: { title: string; detail: string; badge: string; href?: string }) {
  return <li className="flex flex-wrap items-center justify-between gap-3 py-3">
    <div><div className="font-medium">{title}</div><div className="text-sm opacity-65">{detail}</div></div>
    {href ? <Link href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="btn-glass px-3 py-1.5 text-xs">{badge === "LIVE" ? "Join" : badge}</Link> : <span className="rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-xs">{badge}</span>}
  </li>;
}
