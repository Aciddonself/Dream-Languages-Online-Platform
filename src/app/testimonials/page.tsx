import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";
import { getPublishedTestimonials, getTeacherRatingSummaries } from "@/lib/public-content";

export const revalidate = 60;

export default async function TestimonialsPage() {
  const [testimonials, teachers] = await Promise.all([getPublishedTestimonials(), getTeacherRatingSummaries()]);
  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <h1 className="text-4xl mb-2">Learner testimonials</h1>
      <p className="opacity-70 mb-2">Experiences shared by members of the DLA learning community.</p>
      <p className="text-sm opacity-70 mb-6">
        Are you a DLA student? <Link href="/student/reviews" className="liquid-link rounded-full border border-transparent px-3 py-1 font-semibold">Share your review</Link> from your dashboard. Reviews are published after administrator approval.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {testimonials.map((testimonial) => (
          <GlassCard className="review-card p-5" key={testimonial.id}>
            <div className="text-[var(--brand-primary)] mb-2">{"★".repeat(testimonial.rating ?? 5)}</div>
            <p className="review-quote">“{testimonial.quote}”</p>
            <div className="mt-3 font-semibold">{testimonial.authorName}</div>
            {testimonial.role && <div className="text-sm opacity-60">{testimonial.role}</div>}
          </GlassCard>
        ))}
      </div>
      {!testimonials.length && <GlassCard className="p-5">New student stories will appear here as they are shared.</GlassCard>}
      {teachers.length > 0 && (
        <section className="mt-10" aria-labelledby="teacher-ratings">
          <h2 id="teacher-ratings" className="text-3xl mb-4">Our teachers, rated by students</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {teachers.map((t) => (
              <GlassCard className="p-5" key={t.teacherId}>
                <div className="font-semibold text-lg">{t.name}</div>
                <div className="text-[var(--brand-primary)]" aria-label={`${t.average} out of 5`}>{"★".repeat(Math.round(t.average))}{"☆".repeat(5 - Math.round(t.average))} <span className="text-sm opacity-70">{t.average.toFixed(1)} ({t.count})</span></div>
                {t.latest && <p className="review-quote mt-2 text-sm">“{t.latest}”</p>}
              </GlassCard>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
