import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard, GlassButton } from "@/components/ui/glass";
import { AdminSessionCreate } from "@/components/admin-session-create";
import { db } from "@/db";
import { classes, departments, exams, timetableSessions, users } from "@/db/schema";
import { asc, count, eq, gt, or } from "drizzle-orm";
import Link from "next/link";

const nav = [
  { href: "/hoc", label: "Dashboard", icon: "🏠" },
  { href: "/hoc/live-classes", label: "Live Classes", icon: "🎥" },
  { href: "/hoc/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/hoc/community", label: "Class discussions", icon: "💬" },
];

export default async function HocDashboard() {
  await requireRole(["head_academics", "super_admin"]);
  const [teacherCount, classCount, approvalCount, pendingExams, allDepts, schoolClasses, teachers, applicants, upcomingSessions] = await Promise.all([
    db.select({ total: count() }).from(users).where(eq(users.role, "teacher")),
    db.select({ total: count() }).from(classes),
    db.select({ total: count() }).from(exams).where(eq(exams.published, false)),
    db.select().from(exams).where(eq(exams.published, false)).limit(10),
    db
      .select({ id: departments.id, name: departments.name, code: departments.code, flagEmoji: departments.flagEmoji })
      .from(departments)
      .where(eq(departments.isLanguage, true))
      .orderBy(asc(departments.name)),
    db.select({ id: classes.id, name: classes.name, departmentId: classes.departmentId }).from(classes).orderBy(asc(classes.name)),
    db.select({ id: users.id, name: users.displayName }).from(users).where(or(eq(users.role, "teacher"), eq(users.role, "head_academics"))),
    db.select({
      id: users.id,
      name: users.displayName,
      email: users.email,
      phone: users.phone,
      address: users.address,
      registrationNumber: users.registrationNumber,
      course: users.departmentId,
      studyFormat: users.studyFormat,
      nextOfKinName: users.nextOfKinName,
      nextOfKinPhone: users.nextOfKinPhone,
    }).from(users).where(eq(users.role, "applicant")).limit(50),
    db.select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
      classId: timetableSessions.classId,
      meetUrl: timetableSessions.meetUrl,
      liveStartedAt: timetableSessions.liveStartedAt,
      liveEndedAt: timetableSessions.liveEndedAt,
    }).from(timetableSessions).where(gt(timetableSessions.endsAt, new Date())).orderBy(asc(timetableSessions.startsAt)).limit(10),
  ]);

  const teacherOptions = teachers.map((t) => ({ id: t.id, name: t.name || "Teacher" }));

  return (
    <PortalShell title="Head of Academics & Languages" nav={nav}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="display-font text-3xl font-bold">Head of Languages & Academics</h1>
          <p className="text-sm opacity-60">Supervise language departments, schedule Google Meet live classes, and manage academic progress.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/hoc/live-classes">
            <GlassButton className="bg-red-600/80 text-white font-semibold">
              🎥 Live Classes Hub
            </GlassButton>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <GlassCard className="p-5">
          <div className="text-xs font-semibold opacity-60 uppercase">Language Teachers</div>
          <div className="text-3xl font-bold text-[var(--brand-primary)] mt-1">{teacherCount[0]?.total ?? 0}</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs font-semibold opacity-60 uppercase">Language Departments</div>
          <div className="text-3xl font-bold text-emerald-400 mt-1">{allDepts.length}</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs font-semibold opacity-60 uppercase">Active Classes</div>
          <div className="text-3xl font-bold text-[var(--brand-accent)] mt-1">{classCount[0]?.total ?? 0}</div>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="text-xs font-semibold opacity-60 uppercase">Pending Approvals</div>
          <div className="text-3xl font-bold text-[var(--warning)] mt-1">{approvalCount[0]?.total ?? 0}</div>
        </GlassCard>
      </div>

      {/* Schedule Live Class */}
      <GlassCard className="mt-5 p-6" strong>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎥</span>
            <h2 className="font-semibold text-lg">Schedule Live Class with Google Meet</h2>
          </div>
          <Link href="/hoc/live-classes" className="text-xs text-indigo-400 underline hover:text-indigo-300">
            View all live classes ↗
          </Link>
        </div>
        <p className="mb-4 text-sm opacity-70">
          Schedule language sessions in the school timetable. Automatically generate or add a Google Meet link so students can join directly.
        </p>
        <AdminSessionCreate
          departments={allDepts}
          classes={schoolClasses}
          teachers={teacherOptions}
        />
      </GlassCard>

      {/* Upcoming Live Sessions */}
      <GlassCard className="mt-5 p-6" strong>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Upcoming Sessions & Live Status</h2>
          <Link href="/hoc/live-classes" className="text-xs text-indigo-400 underline">
            Manage Live Sessions
          </Link>
        </div>
        {upcomingSessions.length ? (
          <ul className="space-y-2 text-sm">
            {upcomingSessions.map((session) => {
              const isLive = Boolean(session.liveStartedAt && !session.liveEndedAt);
              return (
                <li
                  key={session.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 border transition-colors ${
                    isLive ? "border-emerald-500 bg-emerald-950/20" : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isLive && (
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" title="Live Now" />
                    )}
                    <span>
                      {session.startsAt.toLocaleString()} · <strong>{session.title}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.meetUrl && (
                      <a
                        className="rounded-lg bg-emerald-600/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                        href={`/api/portal/sessions/${session.id}/join`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        🎥 {isLive ? "Join Live Meet" : "Launch Google Meet"}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm opacity-65">No upcoming sessions are scheduled.</p>
        )}
      </GlassCard>

      {/* Exam Approvals */}
      <GlassCard className="mt-5 p-6">
        <div className="font-semibold mb-3">Pending Exam Approvals</div>
        <ul className="space-y-2 text-sm">
          {pendingExams.length ? (
            pendingExams.map((exam) => (
              <li key={exam.id} className="glass px-3 py-2 flex items-center justify-between">
                <span>{exam.title}</span>
                <span className="text-xs opacity-60">Awaiting academic review</span>
              </li>
            ))
          ) : (
            <li className="glass px-3 py-2">No exams are awaiting review.</li>
          )}
        </ul>
      </GlassCard>

      {/* Applicant Overview */}
      <GlassCard className="mt-5 p-6" strong>
        <h2 className="mb-2 font-semibold">Applicant overview (view only)</h2>
        <p className="mb-3 text-sm opacity-65">The Head of Academics can view applications but cannot approve or admit applicants; admission approval remains with the school administrator.</p>
        {applicants.length ? (
          <ul className="space-y-2 text-sm">
            {applicants.map((applicant) => (
              <li key={applicant.id} className="rounded-xl bg-white/5 p-3">
                <strong>{applicant.name}</strong> · {applicant.registrationNumber} · {applicant.email} · {applicant.phone}
                <div className="mt-1 text-xs opacity-70">
                  {applicant.address} · Next of kin: {applicant.nextOfKinName} {applicant.nextOfKinPhone} · {applicant.studyFormat?.replaceAll("_", " ") ?? "Study format pending"}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-65">No applications awaiting review.</p>
        )}
      </GlassCard>
    </PortalShell>
  );
}
