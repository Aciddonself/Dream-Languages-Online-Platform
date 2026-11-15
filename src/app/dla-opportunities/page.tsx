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
      "Build the language and career readiness to pursue work beyond Uganda. We help you strengthen practical communication for your target country, understand role requirements, prepare your CV and interview skills, and plan your next steps. When relevant opportunities or recruitment partners are available, we can help you explore them and understand how to apply.",
    takeaway: "Feel more prepared to pursue international career pathways.",
  },
  {
    number: "02",
    eyebrow: "Turn your study goal into a plan",
    title: "Study abroad guidance",
    description:
      "Make your study plans clearer and more achievable. We can help you explore courses and institutions that match your goals, prepare for language requirements, organize application documents, and understand each stage of the admissions process. We also help you prepare questions and learn about common visa requirements, so you can approach the relevant institutions with confidence.",
    takeaway: "Move from wondering where to start to knowing your next step.",
  },
  {
    number: "03",
    eyebrow: "Build meaningful growth together",
    title: "Partnerships that open doors in Uganda",
    description:
      "Are you an education provider, employer, institution, or community organization? Partner with DLA to reach learners and clients in Uganda through local outreach, student recruitment, institutional connections, brand awareness, and business development. We’ll discuss shared goals, responsibilities, and a transparent collaboration model before moving forward.",
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
          Dream Languages Uganda helps people prepare for international work and study—and helps organizations build a stronger local presence. Bring us your ambition. We’ll help you find a practical place to begin.
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
            Start with the goal that matters to you. We’ll help you understand the options and take the next step with confidence.
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

      <GlassCard className="mt-12 flex flex-col items-start justify-between gap-6 p-6 sm:mt-16 sm:flex-row sm:items-center sm:p-9" strong>
        <div className="max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
            Let’s make a plan
          </p>
          <h2 className="display-font text-3xl font-bold sm:text-4xl">
            Tell us where you want to go.
          </h2>
          <p className="mt-3 text-[var(--text-muted)]">
            Share your work, study, or partnership goal with our team. We’ll help you explore the right next step.
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
