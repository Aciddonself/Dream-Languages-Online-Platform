import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, schoolHolidays, timetableSessions } from "@/db/schema";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { LEVELS, MODES, SLOTS, range } from "@/lib/classes-2027";
import { expectedMuslimHolidays } from "@/lib/muslim-holidays";

export const dynamic = "force-dynamic";

const TZ = "Africa/Kampala";
const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const clock = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

export default async function TimetablePage() {
  let sessions: Array<{ id: string; title: string; startsAt: Date; endsAt: Date; room: string | null; className: string | null }> = [];
  let approvedHolidays: Array<{ id: string; title: string; startsOn: string; endsOn: string | null; details: string | null }> = [];

  try {
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    [sessions, approvedHolidays] = await Promise.all([db
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
      .limit(200),
      db.select({
        id: schoolHolidays.id,
        title: schoolHolidays.title,
        startsOn: schoolHolidays.startsOn,
        endsOn: schoolHolidays.endsOn,
        details: schoolHolidays.details,
      }).from(schoolHolidays)
        .where(and(
          eq(schoolHolidays.status, "approved"),
          sql`COALESCE(${schoolHolidays.endsOn}, ${schoolHolidays.startsOn}) >= ${today}::date`,
        ))
        .orderBy(asc(schoolHolidays.startsOn))
        .limit(100),
    ]);
  } catch (error) {
    console.warn("Timetable DB fetch error, using fallback:", error);
  }

  const days = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = dayLabel(s.startsAt);
    days.set(key, [...(days.get(key) ?? []), s]);
  }
  const publishedEidNames = approvedHolidays.map((holiday) => holiday.title.toLowerCase());
  const upcomingMuslimHolidays = expectedMuslimHolidays.filter((holiday) => {
    const inFuture = holiday.startsOn >= new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
    const alreadyPublished = publishedEidNames.some((title) => title.includes(holiday.matchTitle.toLowerCase()));
    return inFuture && !alreadyPublished;
  });

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
                      <div className="text-sm mt-2">{clock(session.startsAt)} to {clock(session.endsAt)}</div>
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

      <section aria-labelledby="holidays">
        <h2 id="holidays" className="text-2xl mb-3">Upcoming holidays and observances</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {approvedHolidays.map((holiday) => (
            <GlassCard className="p-5" key={holiday.id}>
              <h3 className="font-bold">{holiday.title}</h3>
              <p className="mt-1 text-sm">{dayLabel(new Date(`${holiday.startsOn}T12:00:00+03:00`))}{holiday.endsOn && holiday.endsOn !== holiday.startsOn ? ` to ${dayLabel(new Date(`${holiday.endsOn}T12:00:00+03:00`))}` : ""}</p>
              {holiday.details && <p className="mt-2 text-sm">{holiday.details}</p>}
            </GlassCard>
          ))}
          {upcomingMuslimHolidays.map((holiday) => (
            <GlassCard className="p-5" key={holiday.title}>
              <h3 className="font-bold">{holiday.title}</h3>
              <p className="mt-1 text-sm">Expected {dayLabel(new Date(`${holiday.startsOn}T12:00:00+03:00`))}</p>
              <p className="mt-2 text-sm">Estimated date. The final date may shift with the moon sighting and Uganda Government announcement.</p>
            </GlassCard>
          ))}
        </div>
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
