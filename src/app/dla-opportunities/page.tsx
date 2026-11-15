import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/glass";

export const metadata: Metadata = {
  title: "DLA Opportunities",
  description: "Partnership and collaboration opportunities with Dream Languages in Uganda.",
};

const opportunities = [
  {
    title: "Work Abroad Opportunities",
    description:
      "Connecting qualified Ugandans with international employment opportunities through language training, recruitment support, and career pathways.",
  },
  {
    title: "Study Abroad Opportunities",
    description:
      "Helping Ugandan students access international education through language preparation, university placements, admissions guidance, and study visa support.",
  },
  {
    title: "Strategic Partnership & Market Penetration",
    description:
      "Partnering with Dream Languages to introduce, promote, and grow services in Uganda through local marketing, student and client recruitment, institutional partnerships, brand awareness, and business development.",
  },
];

export default function DlaOpportunitiesPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <GlassCard className="p-6 sm:p-10 md:p-14" strong>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary)]">
          Writing
        </p>
        <h1 className="display-font text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
          Partnership &amp; Collaboration Opportunities with Dream Languages in Uganda
        </h1>

        <div className="mt-8 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 sm:p-6">
          <h2 className="text-lg font-bold text-[var(--brand-primary)] sm:text-xl">
            Subject: Exploring Partnership Opportunities – Work, Study Abroad &amp; Market Expansion in Uganda
          </h2>
          <div className="mt-5 space-y-5 leading-relaxed">
            <p>Dear Dream Languages Team,</p>
            <p>
              We would like to explore exciting opportunities to collaborate with Dream Languages through a strategic partnership aimed at expanding your reach and establishing a strong presence in the Ugandan market.
            </p>
            <p>We are interested in working together in three key areas:</p>
            <ol className="list-decimal space-y-4 pl-6 marker:font-semibold marker:text-[var(--brand-primary)]">
              {opportunities.map((item) => (
                <li className="pl-1" key={item.title}>
                  <strong>{item.title}:</strong> {item.description}
                </li>
              ))}
            </ol>
            <p>
              Our goal is to build a mutually beneficial partnership that creates opportunities for Ugandans while helping Dream Languages expand its international footprint.
            </p>
            <p>
              We would appreciate the opportunity to discuss your partnership model, collaboration requirements, commission structures, and the possibility of becoming your local representative or strategic partner in Uganda.
            </p>
            <p>
              We look forward to exploring how we can work together to make Dream Languages a recognized and trusted brand in Uganda.
            </p>
            <div className="border-t border-[var(--border)] pt-5">
              <p>Kind regards,</p>
              <p className="mt-4 font-bold">[Your Name / Company Name]</p>
              <p>Uganda</p>
              <p className="font-bold">Partnership &amp; Business Development</p>
            </div>
          </div>
        </div>
      </GlassCard>
    </main>
  );
}
