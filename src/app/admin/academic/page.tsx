import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { AdminSessionCreate } from "@/components/admin-session-create";
import { db } from "@/db";
import { classes, timetableSessions } from "@/db/schema";
import { desc, isNull } from "drizzle-orm";

const nav = [{ href: "/admin", label: "Dashboard", icon: "🏠" }, { href: "/admin/academic", label: "Academic", icon: "🎓" }];

export default async function AdminAcademic() {
  await requireRole(["super_admin"]);
  const [schoolClasses, sessions] = await Promise.all([
    db.select({ id: classes.id, name: classes.name }).from(classes).where(isNull(classes.deletedAt)).orderBy(classes.name),
    db.select().from(timetableSessions).orderBy(desc(timetableSessions.startsAt)).limit(50),
  ]);
  return (
    <PortalShell title="Academic Structure" nav={nav}>
      <h1 className="display-font text-2xl font-bold mb-4">Academic Structure</h1>
      <div className="grid gap-4">
        <GlassCard className="p-6" strong>
          <h2 className="font-semibold mb-2">Schedule a class or online lesson</h2>
          <p className="text-sm opacity-70 mb-4">Add the Google Meet link created for the session so enrolled students can join from their portal.</p>
          <AdminSessionCreate classes={schoolClasses} />
        </GlassCard>
        <GlassCard className="p-6" strong>
          <h2 className="font-semibold mb-3">Scheduled sessions</h2>
          {sessions.length ? (
            <ul className="divide-y divide-[var(--border-strong)]">
              {sessions.map((session: { id: string; title: string; startsAt: Date | string; endsAt: Date | string; meetUrl?: string | null }) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium">{session.title}</div>
                    <div className="text-sm opacity-65">{new Date(session.startsAt).toLocaleString()} – {new Date(session.endsAt).toLocaleString()}</div>
                  </div>
                  {session.meetUrl ? (
                    <a className="text-sm font-semibold text-[var(--brand-secondary-soft)] underline-offset-4 hover:underline" href={session.meetUrl} target="_blank" rel="noreferrer">Open Google Meet</a>
                  ) : <span className="text-sm opacity-60">No Meet link added</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm opacity-70">No class sessions have been scheduled yet.</p>}
        </GlassCard>
        <GlassCard className="p-6">
          <h2 className="font-semibold mb-2">Academic structure</h2>
          <p className="opacity-70">Manage departments, programmes, levels, terms, classes, and the timetable using the school records above.</p>
        </GlassCard>
      </div>
    </PortalShell>
  );
}