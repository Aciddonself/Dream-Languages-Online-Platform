import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, timetableSessions } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export const revalidate = 60;

export default async function TimetablePage() {
  const sessions = await db
    .select({
      id: timetableSessions.id,
      title: timetableSessions.title,
      startsAt: timetableSessions.startsAt,
      endsAt: timetableSessions.endsAt,
      room: timetableSessions.room,
      className: classes.name,
    })
    .from(timetableSessions)
    .leftJoin(classes, eq(timetableSessions.classId, classes.id))
    .orderBy(asc(timetableSessions.startsAt));

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-2">Class Timetable</h1>
      <p className="opacity-70 mb-6">Upcoming learning sessions at Dream Languages Uganda.</p>
      {sessions.length ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <GlassCard className="p-5" key={session.id}>
              <div className="font-semibold">{session.title}</div>
              <div className="text-sm opacity-70 mt-1">{session.className ?? "School session"}</div>
              <div className="text-sm mt-2">{session.startsAt.toLocaleString()} – {session.endsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              {session.room && <div className="text-sm opacity-70 mt-1">{session.room}</div>}
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="p-6"><p className="opacity-70">No public class times have been scheduled yet. Contact DLA to ask about current language and skills intakes.</p></GlassCard>
      )}
    </main>
  );
}