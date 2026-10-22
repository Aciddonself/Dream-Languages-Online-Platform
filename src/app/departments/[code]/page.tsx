import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard, GlassButton, Badge } from "@/components/ui/glass";
import { db } from "@/db";
import { classes, departments, levels, timetableSessions } from "@/db/schema";
import { eq, or, ilike, asc, and, gt, sql } from "drizzle-orm";
import { DEFAULT_DEPARTMENTS } from "@/lib/public-content";

export const revalidate = 60;

const CEFR_LEVELS = [
  { code: "A1", name: "Beginner", desc: "Basic greetings, everyday phrases, pronunciation, self-introduction, and numbers." },
  { code: "A2", name: "Elementary", desc: "Daily routines, shopping, travel, simple past tense, and family conversations." },
  { code: "B1", name: "Intermediate", desc: "Expressing opinions, professional writing, workplace communication, and storytelling." },
  { code: "B2", name: "Upper Intermediate", desc: "Complex texts, fluent debates, technical discussions, and professional certifications." },
  { code: "C1", name: "Advanced", desc: "Idiomatic fluency, academic research, nuanced diplomacy, and spontaneous expression." },
  { code: "C2", name: "Mastery", desc: "Complete native-like fluency, literary analysis, and professional translation/interpretation." },
];

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const searchCode = rawCode.trim().toLowerCase();

  // Find department from DB or fallback
  let department: typeof departments.$inferSelect | null = null;
  try {
    const [found] = await db
      .select()
      .from(departments)
      .where(
        or(
          ilike(departments.code, searchCode),
          ilike(departments.name, `%${searchCode}%`)
        )
      )
      .limit(1);
    department = found ?? null;
  } catch (err) {
    console.warn("DB lookup error for department:", err);
  }

  if (!department) {
    // Check fallback
    const fallback = DEFAULT_DEPARTMENTS.find(
      (d) => d.code.toLowerCase() === searchCode || d.name.toLowerCase().includes(searchCode)
    );
    if (fallback) {
      department = fallback as typeof departments.$inferSelect;
    } else {
      // Pick first department rather than crashing
      department = DEFAULT_DEPARTMENTS[0] as typeof departments.$inferSelect;
    }
  }

  // Fetch classes and upcoming live Google Meet sessions in this department
  let deptClasses: { id: string; name: string }[] = [];
  let liveSessions: { id: string; title: string; startsAt: Date; endsAt: Date; meetUrl: string | null }[] = [];

  try {
    deptClasses = await db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(eq(classes.departmentId, department.id))
      .orderBy(asc(classes.name));

    if (deptClasses.length > 0) {
      const classIds = deptClasses.map((c) => c.id);
      liveSessions = await db
        .select({
          id: timetableSessions.id,
          title: timetableSessions.title,
          startsAt: timetableSessions.startsAt,
          endsAt: timetableSessions.endsAt,
          meetUrl: timetableSessions.meetUrl,
        })
        .from(timetableSessions)
        .where(
          and(
            sql`${timetableSessions.classId} IN ${classIds}`,
            gt(timetableSessions.endsAt, new Date())
          )
        )
        .orderBy(asc(timetableSessions.startsAt))
        .limit(5);
    }
  } catch (err) {
    console.warn("Could not query department classes:", err);
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/departments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
        >
          <span>←</span>
          <span>Back to All Departments</span>
        </Link>
      </div>

      {/* Hero */}
      <GlassCard className="p-8 md:p-12 relative overflow-hidden" strong>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="text-5xl">{department.flagEmoji ?? "🌐"}</span>
              <Badge tone="primary">{department.code} Department</Badge>
            </div>
            <h1 className="display-font text-3xl md:text-5xl font-bold text-white">
              {department.name} Language Programme
            </h1>
            <p className="text-base opacity-80 leading-relaxed">
              {department.description ??
                `Master ${department.name} with certified language instructors, immersive speaking sessions, and live Google Meet classes at Dream Languages Uganda.`}
            </p>
            <div className="flex flex-wrap gap-3 pt-3">
              <Link href={`/apply?dept=${encodeURIComponent(department.id)}`}>
                <GlassButton className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold">
                  Apply for {department.name}
                </GlassButton>
              </Link>
              <Link href="/courses">
                <GlassButton variant="glass">View Fee Structure</GlassButton>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 p-5 min-w-[240px] space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider opacity-70">Programme Highlights</h3>
            <ul className="space-y-2 text-xs opacity-85">
              <li>✓ CEFR Certified Levels (A1 – C2)</li>
              <li>✓ Live Google Meet Interactive Video</li>
              <li>✓ Weekend, Evening &amp; Day Batches</li>
              <li>✓ 24/7 Father-DLA AI Study Companion</li>
              <li>✓ Official School Completion Certificate</li>
            </ul>
          </div>
        </div>
      </GlassCard>

      {/* CEFR Levels Roadmap */}
      <section className="space-y-4">
        <div>
          <h2 className="display-font text-2xl font-bold text-white">Curriculum &amp; Proficiency Levels</h2>
          <p className="text-sm opacity-70">Our curriculum aligns with the Common European Framework of Reference for Languages (CEFR).</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CEFR_LEVELS.map((lvl) => (
            <GlassCard key={lvl.code} className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-indigo-400">{lvl.code}</span>
                <span className="text-xs uppercase font-semibold opacity-60">{lvl.name}</span>
              </div>
              <p className="text-xs opacity-75 leading-relaxed">{lvl.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Available Classes & Live Google Meet Classes */}
      <section className="grid gap-6 md:grid-cols-2">
        <GlassCard className="p-6" strong>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📚</span>
            <h3 className="text-lg font-bold text-white">Active Classes &amp; Cohorts</h3>
          </div>
          {deptClasses.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {deptClasses.map((c) => (
                <li key={c.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <span className="font-semibold text-white">{c.name}</span>
                  <Link href={`/apply?dept=${encodeURIComponent(department.id)}`} className="text-xs text-indigo-400 hover:underline">
                    Enrol →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs opacity-70">
              New cohorts for {department.name} are enrolling now for Day, Evening, and Online formats.
            </p>
          )}
        </GlassCard>

        <GlassCard className="p-6" strong>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎥</span>
            <h3 className="text-lg font-bold text-white">Live Google Meet Classes</h3>
          </div>
          {liveSessions.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {liveSessions.map((s) => (
                <li key={s.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">{s.title}</div>
                    <div className="text-xs opacity-70">
                      {new Date(s.startsAt).toLocaleDateString()} · {new Date(s.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  {s.meetUrl && (
                    <a
                      href={`/api/portal/sessions/${s.id}/join`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                    >
                      Join Meet
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs opacity-70 space-y-2">
              <p>Online live sessions are scheduled regularly by our language instructors via Google Meet.</p>
              <p>Admitted students can view the full schedule on their private student timetable.</p>
            </div>
          )}
        </GlassCard>
      </section>

      {/* CTA Box */}
      <GlassCard className="p-8 text-center" strong>
        <h3 className="text-2xl font-bold text-white mb-2">Ready to Start Learning {department.name}?</h3>
        <p className="text-sm opacity-75 max-w-lg mx-auto mb-6">
          Submit your admission details in 2 minutes. Receive your student registration number and access your live Google Meet classes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/apply?dept=${encodeURIComponent(department.id)}`}>
            <GlassButton className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold">
              Submit Application for {department.name}
            </GlassButton>
          </Link>
          <Link href="/courses">
            <GlassButton variant="glass">Compare All Courses</GlassButton>
          </Link>
        </div>
      </GlassCard>
    </main>
  );
}
