import { GlassCard } from "@/components/ui/glass";
import Link from "next/link";
import { getPublicDepartments } from "@/lib/public-content";

export const revalidate = 60;

export default async function CoursesPage() {
  const depts = await getPublicDepartments();
  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-2">Courses &amp; Fees</h1>
      <p className="opacity-70 mb-6">Choose a language or practical skills programme and a study format that fits your goals.</p>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {depts.map((d) => (
          <GlassCard key={d.id} className="p-5 flex flex-col justify-between hover:border-indigo-400/50 transition-all" strong>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">{d.flagEmoji ?? "🌐"}</span>
                <span className="text-xs font-mono font-semibold opacity-60 bg-white/10 px-2 py-0.5 rounded">{d.code}</span>
              </div>
              <div className="font-bold text-lg text-white">{d.name}</div>
              <div className="text-xs opacity-75 mt-1.5 leading-relaxed">{d.description ?? "Accredited language and skills programme."}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-semibold">
              <Link href={`/departments/${d.code.toLowerCase()}`} className="text-indigo-400 hover:text-indigo-300">
                View Curriculum →
              </Link>
              <Link href={`/apply?dept=${encodeURIComponent(d.id)}`} className="text-[var(--brand-primary)] hover:underline">
                Apply Now →
              </Link>
            </div>
          </GlassCard>
        ))}
      </div>
      <section className="mt-10">
        <h2 className="display-font text-2xl font-bold mb-2">Language courses &amp; fees</h2>
        <p className="mb-4 text-sm opacity-70">All local fees are in Uganda Shillings. Regular and intensive classes are 2 hours per session; super intensive classes are 3 hours per session.</p>
        <GlassCard className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-white/10"><tr><th className="p-3">Study format</th><th className="p-3">Session length</th><th className="p-3">1 month</th><th className="p-3">2 months</th></tr></thead>
            <tbody>
              <tr className="border-t border-white/10"><th className="p-3">Regular</th><td className="p-3">2 hours</td><td className="p-3">UGX 500,000</td><td className="p-3">UGX 800,000</td></tr>
              <tr className="border-t border-white/10"><th className="p-3">Intensive</th><td className="p-3">2 hours</td><td className="p-3">UGX 1,000,000</td><td className="p-3">UGX 1,800,000</td></tr>
              <tr className="border-t border-white/10"><th className="p-3">Super intensive</th><td className="p-3">3 hours</td><td className="p-3">UGX 1,500,000</td><td className="p-3">UGX 2,500,000</td></tr>
            </tbody>
          </table>
        </GlassCard>
        <GlassCard className="mt-4 overflow-x-auto p-5">
          <h3 className="font-semibold mb-2">International students outside Uganda</h3>
          <table className="w-full text-left text-sm"><thead><tr><th className="py-2">Duration</th><th className="py-2">Tuition</th></tr></thead><tbody>
            <tr className="border-t border-white/10"><td className="py-2">1 month</td><td className="py-2">USD $200</td></tr>
            <tr className="border-t border-white/10"><td className="py-2">2 months</td><td className="py-2">USD $350</td></tr>
          </tbody></table>
          <p className="mt-2 text-xs opacity-65">International rates are for language study. Contact admissions to confirm the course schedule and payment method.</p>
        </GlassCard>
        <div className="mt-4"><Link href="/apply" className="btn-glass btn-glass-primary inline-flex rounded-xl px-5 py-3 font-semibold">Choose a language and apply</Link></div>
      </section>
      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <GlassCard className="p-6">
          <h2 className="display-font text-2xl font-bold mb-2">Communication skills</h2>
          <p className="text-sm opacity-75">Build confidence for everyday and professional communication. Learners practise listening, clear speaking, vocabulary, pronunciation, reading comprehension, writing, presentations, and respectful conversation in guided activities.</p>
          <p className="mt-3 text-sm opacity-70">Contact admissions for current intake dates, study format, and fees.</p>
        </GlassCard>
        <GlassCard className="p-6">
          <h2 className="display-font text-2xl font-bold mb-2">Basic computer studies — MS Office</h2>
          <p className="text-sm opacity-75">A practical three-month programme: Month 1, computer fundamentals and file management; Month 2, Microsoft Word and PowerPoint; Month 3, Microsoft Excel, internet safety, and useful digital workflows.</p>
          <p className="mt-3 font-semibold">UGX 500,000 per month · UGX 1,500,000 for three months</p>
          <p className="mt-2 text-sm opacity-70">Available in-person or online. Online learners need a computer or laptop (not a phone), stable internet, and a quiet study environment.</p>
        </GlassCard>
        <GlassCard className="p-6 md:col-span-2">
          <h2 className="display-font text-2xl font-bold mb-2">Web development, design &amp; programming</h2>
          <p className="text-sm opacity-75">Learn to build and style websites, create responsive interfaces, and develop programming foundations through practical projects. Topics include HTML, CSS, JavaScript, React, and Python. Contact admissions to discuss the right pathway, schedule, and fees.</p>
          <div className="mt-4 flex flex-wrap gap-2">{["HTML", "CSS", "JavaScript", "React", "Python", "Web design"].map((skill) => <span key={skill} className="rounded-full border border-white/15 px-3 py-1 text-sm">{skill}</span>)}</div>
          <p className="mt-3 text-sm opacity-70">Online classes require a computer or laptop, stable internet, and a quiet learning space.</p>
        </GlassCard>
      </section>
      <section className="mt-12">
        <GlassCard className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div><h2 className="display-font text-2xl font-bold mb-2">One-on-one &amp; home study tutoring</h2>
            <p className="text-sm opacity-75">Get personal support from a DLA tutor at home or through private one-on-one study. We can tailor lesson times and learning activities to your goals, current level, and preferred language.</p>
          </div>
          <div className="flex flex-col gap-2">
            <a className="btn-glass btn-glass-primary rounded-xl px-5 py-3 text-center font-semibold" href="https://wa.me/256742259976?text=Hello%20DLA%2C%20I%27m%20inquiring%20about%20one-on-one%20or%20home%20study%20tutoring." target="_blank" rel="noreferrer">WhatsApp DLA about private tutoring</a>
            <a className="text-center text-sm font-semibold underline" href="https://wa.me/256775566832?text=Hello%20DLA%2C%20I%27m%20inquiring%20about%20one-on-one%20or%20home%20study%20tutoring." target="_blank" rel="noreferrer">Message the second DLA office</a>
          </div>
        </GlassCard>
      </section>
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          ["German in 6 Months at DLA", "german-class.jpg"],
          ["Dream Nurses Class 2024", "nursing-class.jpg"],
          ["Confusing German grammar made easy", "language-learning.jpg"],
        ].map(([title, image]) => (
          <GlassCard className="overflow-hidden" key={title}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/site-media/${image}`} alt={title} className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-4">
              <div className="font-semibold">{title}</div>
              <Link href="/apply" className="mt-3 inline-block text-sm font-semibold text-[var(--brand-secondary-soft)] hover:underline">Ask about enrolment →</Link>
            </div>
          </GlassCard>
        ))}
      </section>
    </main>
  );
}