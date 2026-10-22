import { CalendarPage } from "@/components/calendar-page";
import { PortalShell } from "@/components/portal-shell";
import { db } from "@/db";
import { timetableSessions } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { asc } from "drizzle-orm";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "⌂" },
  { href: "/admin/calendar", label: "Calendar", icon: "▦" },
  { href: "/admin/academic", label: "Academic structure", icon: "◇" },
];

export default async function AdminCalendar() {
  await requireRole(["super_admin"]);
  const sessions = await db
    .select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
      room: timetableSessions.room,
    })
    .from(timetableSessions)
    .orderBy(asc(timetableSessions.startsAt))
    .limit(500);

  return (
    <PortalShell title="Admin Console" nav={nav}>
      <CalendarPage events={sessions.map((session) => ({
        ...session,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
      }))} />
    </PortalShell>
  );
}
