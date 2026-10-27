import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, timetableSessions } from "@/db/schema";
import { asc, eq, gte } from "drizzle-orm";
import { LEVELS, MODES, SLOTS, range } from "@/lib/classes-2027";

export const revalidate = 60;

const TZ = "Africa/Kampala";
const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const clock = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

export default async function TimetablePage() {
  let sessions: Array<{ id: string; title: string; startsAt: Date; endsAt: Date; room: string | null; className: string | null }> = [];

  try {
    sessions = await db
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
      .where(gte(timetableSessions.endsAt, new Date()))
      .orderBy(asc(timetableSessions.startsAt))
      .limit(200);
  } catch (error) {
    console.warn("Timetable DB fetch error, using fallback:", error);
  }

  const days = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = dayLabel(s.startsAt);
    days.set(key, [...(days.get(key) ?? []), s]);
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-4xl mb-2">Class Timetable</h1>
        <p className="opacity-70">Upcoming learning sessions at Dream Languages Uganda. Times are East Africa Time(Uganda,Kenya & Tanzania).</p>
      </div>

      <section aria-labelledby="scheduled">
        <h2 id="scheduled" className="text-2xl mb-3">Scheduled sessions</h2>
        {days.size ? (
          <div className="space-y-6">
            {[...days].map(([day, list]) => (
              <div key={day}>
                <h3 className="text-lg font-semibold mb-2">{day}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {list.map((session) => (
                    <GlassCard className="p-5" key={session.id}>
                      <div className="font-semibold">{session.title}</div>
                      <div className="text-sm opacity-70 mt-1">{session.className ?? "School session"}</div>
                      <div className="text-sm mt-2">{clock(session.startsAt)} – {clock(session.endsAt)}</div>
                      {session.room && <div className="text-sm opacity-70 mt-1">{session.room}</div>}
                    </GlassCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <GlassCard className="p-6"><p className="opacity-70">No sessions are scheduled right now. The regular class times are below.</p></GlassCard>
        )}
      </section>

      <section aria-labelledby="regular">
        <h2 id="regular" className="text-2xl mb-3">Regular class times (Monday to Friday)</h2>
        <GlassCard className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-white/5"><th className="p-3">Level</th>{MODES.map((m) => <th key={m} className="p-3">{m}</th>)}</tr></thead>
            <tbody>
              {LEVELS.map((l) => (
                <tr key={l} className="border-t border-white/10">
                  <td className="p-3 font-semibold">{l}</td>
                  {MODES.map((m) => <td key={m} className="p-3">{range(SLOTS[m][l], SLOTS[m][l] + 120)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
        <p className="mt-3 text-sm opacity-75">
          See every intake, registration deadline and exam date on the <Link href="/classes-2027" className="liquid-link rounded-full border border-transparent px-3 py-1 font-semibold">Classes 2027</Link> page.
        </p>
      </section>
    </main>
  );
}
