import Link from "next/link";
import { GlassCard, GlassButton, Badge } from "@/components/ui/glass";
import { CountUpStats } from "@/components/count-up-stats";
import {
  getPublicDepartments,
  getPublishedFaqs,
  getPublishedNews,
  getPublishedPartners,
  getPublishedTestimonials,
} from "@/lib/public-content";

export const revalidate = 60;

export default async function HomePage() {
  const [depts, tests, faqList, partnerList, news] = await Promise.all([
    getPublicDepartments(),
    getPublishedTestimonials(),
    getPublishedFaqs(),
    getPublishedPartners(),
    getPublishedNews(),
  ]);

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="px-6 pt-10 pb-16 max-w-6xl mx-auto">
        <GlassCard className="source-hero p-8 md:p-12" strong>
          <div className="max-w-3xl">
            <Badge tone="primary">Dream Languages Uganda</Badge>
            <h1 className="hero-heading mt-4">
              Lifelong Training <span>For All Ages</span>
            </h1>
            <p className="mt-4 text-lg opacity-80 max-w-xl">
              We are a premier language and adult education school offering high-quality education in languages and practical skills to students of all ages and backgrounds.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/apply"><GlassButton>Apply Now</GlassButton></Link>
              <Link href="/courses"><GlassButton variant="glass">Explore Courses</GlassButton></Link>
              <Link href="/login"><GlassButton variant="ghost">Login</GlassButton></Link>
            </div>
          </div>
        </GlassCard>
      </section>

      <CountUpStats />

      <section className="px-6 max-w-6xl mx-auto mb-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="display-font text-3xl font-bold mb-2">Learning at DLA</h2>
            <p className="opacity-70">Language training, adult literacy, and practical skills in a welcoming learning community.</p>
          </div>
          <Link href="/about" className="text-sm font-semibold text-[var(--brand-secondary-soft)] hover:underline">Learn about DLA →</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "German in 6 Months at DLA", image: "german-class.jpg", alt: "German language learners at DLA" },
            { title: "Dream Nurses Class 2024", image: "nursing-class.jpg", alt: "DLA nurses learning group" },
            { title: "Confusing German grammar made easy", image: "language-learning.jpg", alt: "Learners taking part in a language lesson" },
          ].map((item) => (
            <GlassCard className="overflow-hidden" key={item.image}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/site-media/${item.image}`} alt={item.alt} className="h-52 w-full object-cover" loading="lazy" />
              <div className="p-4 font-semibold">{item.title}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Departments */}
      <section className="px-6 max-w-6xl mx-auto mb-12">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="display-font text-3xl font-bold mb-1">Our Language Departments</h2>
            <p className="opacity-70">Accredited languages and programmes taught at DLA. Click any department to view curriculum &amp; live classes.</p>
          </div>
          <Link href="/departments" className="text-sm font-semibold text-[var(--brand-secondary-soft)] hover:underline">
            View All Departments →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {depts.map((d) => (
            <Link key={d.id} href={`/departments/${d.code.toLowerCase()}`} className="group block">
              <GlassCard className="p-4 text-center h-full transition-all duration-200 group-hover:scale-105 group-hover:border-indigo-400/50 group-hover:shadow-lg group-hover:shadow-indigo-500/10 cursor-pointer">
                <div className="text-3xl mb-1.5 transition-transform group-hover:scale-110">{d.flagEmoji ?? "🌐"}</div>
                <div className="font-semibold text-xs text-white group-hover:text-indigo-300">{d.name}</div>
                <div className="text-[10px] opacity-60 mt-0.5 font-mono">{d.code}</div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </section>

      {/* Why choose us */}
      <section className="px-6 max-w-6xl mx-auto mb-12">
        <GlassCard className="p-8">
          <h2 className="display-font text-3xl font-bold mb-3">Why Choose Us To Gain Knowledge!</h2>
          <p className="opacity-80 max-w-3xl">
            We offer an easy interactive study approach that allows our students to interact with native speakers. We also offer free learning materials, brand new effective teaching methods, a wide range of learning options and intensive classes.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {["Experienced Instructors", "Affordable Courses", "Efficient & Flexible"].map((t) => (
              <GlassCard key={t} className="p-4">
                <div className="font-semibold">{t}</div>
                <div className="text-sm opacity-70 mt-1">Quality education tailored to your schedule.</div>
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="px-6 max-w-6xl mx-auto mb-12">
        <GlassCard className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div>
            <h2 className="display-font text-2xl font-bold mb-2">Consultancy for growing businesses</h2>
            <p className="opacity-75">DLA offers consultancy support to clients looking to streamline business operations and build sustainable growth.</p>
          </div>
          <Link href="/contact"><GlassButton variant="glass">Talk to our team</GlassButton></Link>
        </GlassCard>
      </section>

      {/* Testimonials */}
      <section className="px-6 max-w-6xl mx-auto mb-12">
        <h2 className="display-font text-3xl font-bold mb-4">Reviews From Students</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {tests.map((t) => (
            <GlassCard key={t.id} className="p-5">
              <div className="text-[var(--brand-primary)] mb-2">{"★".repeat(t.rating ?? 5)}</div>
              <p className="text-sm opacity-80 italic">“{t.quote}”</p>
              <div className="mt-3 font-semibold text-sm">{t.authorName}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* News */}
      <section className="px-6 max-w-6xl mx-auto mb-12">
        <h2 className="display-font text-3xl font-bold mb-4">Checkout Our Blog</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {news.map((n) => (
            <GlassCard key={n.id} className="p-5">
              <div className="font-semibold">{n.title}</div>
              <p className="text-sm opacity-70 mt-1">{n.excerpt}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Partners */}
      <section className="px-6 max-w-6xl mx-auto mb-12">
        <h2 className="display-font text-3xl font-bold mb-4">Our Partners</h2>
        <div className="flex flex-wrap gap-4">
          {[
            { name: "Edu-Tours", image: "edu-tours.jpg" },
            { name: "Besten Technologies", image: "partner-besten.png" },
            { name: "Your Way", image: "partner-your-way.jpg" },
            { name: "Atrsy", image: "partner-atrsy.png" },
          ].map((partner) => (
            <GlassCard key={partner.name} className="grid min-h-24 min-w-40 place-items-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/site-media/${partner.image}`} alt={partner.name} className="max-h-16 max-w-36 object-contain" loading="lazy" />
            </GlassCard>
          ))}
          {partnerList.map((partner) => <GlassCard key={partner.id} className="px-6 py-4 font-semibold">{partner.name}</GlassCard>)}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 max-w-6xl mx-auto mb-16">
        <h2 className="display-font text-3xl font-bold mb-4">FAQs</h2>
        <div className="space-y-3">
          {faqList.map((f) => (
            <GlassCard key={f.id} className="p-5">
              <div className="font-semibold">{f.question}</div>
              <div className="text-sm opacity-70 mt-1">{f.answer}</div>
            </GlassCard>
          ))}
        </div>
      </section>

    </main>
  );
}