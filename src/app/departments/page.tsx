import Link from "next/link";
import { GlassCard, GlassButton, Badge } from "@/components/ui/glass";
import { getPublicDepartments } from "@/lib/public-content";

export const revalidate = 60;

export default async function DepartmentsPage() {
  const depts = await getPublicDepartments();

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <div className="mb-8">
        <Badge tone="primary">Academic & Language Departments</Badge>
        <h1 className="display-font text-4xl font-bold mt-2 mb-3">Language Departments &amp; Programmes</h1>
        <p className="text-base opacity-75 max-w-2xl">
          Dream Languages Uganda provides accredited language instruction, cultural immersion, and practical skills. Select a department to explore curriculum, study options, and live Google Meet sessions.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {depts.map((d) => (
          <Link
            key={d.id}
            href={`/departments/${d.code.toLowerCase()}`}
            className="group block"
          >
            <GlassCard
              className="dept-tile h-full p-6 flex flex-col justify-between"
              strong
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-4xl p-2 rounded-2xl bg-white/5 border border-white/10">
                    {d.flagEmoji ?? "🌐"}
                  </span>
                  <span className="text-xs font-mono font-bold tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300">
                    {d.code}
                  </span>
                </div>

                <h2 className="text-xl font-bold transition-colors">
                  {d.name}
                </h2>

                <p className="text-xs opacity-75 mt-2 line-clamp-3 leading-relaxed">
                  {d.description ?? "Comprehensive language training from beginner to advanced levels with certified instructors."}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-indigo-400 group-hover:text-indigo-300">
                <span>Explore Department</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>

      <div className="mt-12 text-center p-8 rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl">
        <h3 className="text-xl font-bold text-white mb-2">Can&apos;t find your language or study goal?</h3>
        <p className="text-sm opacity-75 max-w-xl mx-auto mb-4">
          We also offer customized private one-on-one tutoring, corporate staff training, and adult literacy programmes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/apply"><GlassButton>Apply for Admission</GlassButton></Link>
          <Link href="/contact"><GlassButton variant="glass">Talk with an Advisor</GlassButton></Link>
        </div>
      </div>
    </main>
  );
}
