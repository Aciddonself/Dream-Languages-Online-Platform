import type { Metadata } from "next";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";

export const metadata: Metadata = {
  title: "DLA Opportunities",
  description:
    "Explore how Dream Languages Uganda helps people prepare for international work and study, and helps partners grow their impact in Uganda.",
};

const opportunities = [
  {
    number: "01",
    eyebrow: "Prepare for your next career move",
    title: "Work opportunities abroad",
    description:
      "For qualified Ugandans looking beyond borders, DLA brings language learning together with practical career preparation. Build communication skills for your destination country, understand the requirements of roles you’re targeting, and get support preparing your CV, interviews, and applications. Where relevant employers, openings, or recruitment partners are available, we can help you explore the pathway and the next steps.",
    takeaway: "Feel more prepared to pursue international career pathways.",
  },
  {
    number: "02",
    eyebrow: "Turn your study goal into a plan",
    title: "Study abroad guidance",
    description:
      "For Ugandan students aiming to study internationally, we help turn a big goal into a clear application plan. Explore suitable courses and universities, prepare for language requirements, organize supporting documents, and understand admissions steps and timelines. We can also help you learn about common study-visa requirements and prepare questions for the relevant institution or authority.",
    takeaway: "Move from wondering where to start to knowing your next step.",
  },
  {
    number: "03",
    eyebrow: "Build meaningful growth together",
    title: "Partnerships that open doors in Uganda",
    description:
      "Are you an education provider, employer, institution, or organization looking to grow in Uganda? Work with Dream Languages to introduce and develop your services through local marketing, student and client recruitment, institutional partnerships, brand awareness, and business development. We’re open to discussing a local representative or strategic-partner role, with clear responsibilities and a transparent model for collaboration.",
    takeaway: "Connect your work with a trusted local learning community.",
  },
];

export default function DlaOpportunitiesPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <section
        aria-labelledby="opportunities-heading"
        className="rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow-glass)] sm:p-10 md:p-14"
      >
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary)]">
          Work · Study · Grow
        </p>
        <h1
          id="opportunities-heading"
          className="display-font max-w-4xl text-4xl font-bold leading-tight sm:text-5xl md:text-6xl"
        >
          Your next chapter can reach beyond borders.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--text-muted)] sm:text-xl">
          Dream Languages Uganda helps qualified Ugandans prepare for work and study abroad, while helping organizations connect with people and partners here at home. Bring us your ambition or your partnership idea. We’ll help you find a practical place to begin.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/contact"
            className="btn-glass btn-glass-primary inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
          >
            Talk to our team
          </Link>
          <Link
            href="/courses"
            className="btn-glass inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
          >
            Explore our courses
          </Link>
        </div>
        <p className="mt-5 text-sm text-[var(--text-muted)]">
          Language preparation · Practical guidance · Local understanding
        </p>
      </section>

      <section aria-labelledby="ways-heading" className="mt-14 sm:mt-16">
        <div className="mb-7 max-w-3xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
            Find your way forward
          </p>
          <h2 id="ways-heading" className="display-font text-3xl font-bold sm:text-4xl">
            Three ways DLA helps you move forward
          </h2>
          <p className="mt-3 text-[var(--text-muted)]">
            We’re interested in working across these three areas to create opportunities for Ugandans and help Dream Languages grow its international reach.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {opportunities.map((item) => (
            <GlassCard key={item.number} className="flex h-full flex-col p-6 sm:p-7">
              <span
                aria-hidden="true"
                className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] font-semibold text-[var(--brand-primary)]"
              >
                {item.number}
              </span>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
                {item.eyebrow}
              </p>
              <h3 className="display-font mt-2 text-2xl font-bold leading-snug">
                {item.title}
              </h3>
              <p className="mt-4 flex-1 leading-relaxed text-[var(--text-muted)]">
                {item.description}
              </p>
              <p className="mt-5 border-t border-[var(--border)] pt-4 font-semibold">
                {item.takeaway}
              </p>
            </GlassCard>
          ))}
        </div>
        <p className="mt-5 text-sm text-[var(--text-muted)]">
          We provide preparation and guidance. Employers, schools, and immigration authorities make their own hiring, admission, and visa decisions.
        </p>
      </section>

      <section aria-labelledby="partnership-heading" className="mt-12 sm:mt-16">
        <GlassCard className="p-6 sm:p-9">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
            A shared vision for growth
          </p>
          <h2 id="partnership-heading" className="display-font text-3xl font-bold sm:text-4xl">
            Let’s create opportunity and grow together.
          </h2>
          <p className="mt-4 max-w-4xl leading-relaxed text-[var(--text-muted)]">
            Our goal is a mutually beneficial partnership: opening new pathways for Ugandans while helping Dream Languages become a recognized, trusted name and expand its international footprint. We welcome conversations with people and organizations who share that vision.
          </p>
          <p className="mt-4 max-w-4xl leading-relaxed text-[var(--text-muted)]">
            Let’s talk about your goals, our partnership model, collaboration requirements, commission structures, and the possibility of representing or growing DLA services locally. We’ll agree on expectations and responsibilities together before any collaboration begins.
          </p>
        </GlassCard>
      </section>

      <GlassCard className="mt-12 flex flex-col items-start justify-between gap-6 p-6 sm:mt-16 sm:flex-row sm:items-center sm:p-9" strong>
        <div className="max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
            Let’s make a plan
          </p>
          <h2 className="display-font text-3xl font-bold sm:text-4xl">
            Your idea could be the start of something big.
          </h2>
          <p className="mt-3 text-[var(--text-muted)]">
            Tell us whether you’re exploring work abroad, planning to study, or ready to partner with DLA in Uganda. Let’s explore the next step together.
          </p>
        </div>
        <Link
          href="/contact"
          className="btn-glass btn-glass-primary inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl px-6 py-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
        >
          Start a conversation
        </Link>
      </GlassCard>
    </main>
  );
}
