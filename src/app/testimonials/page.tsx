import { GlassCard } from "@/components/ui/glass";
import { getPublishedTestimonials } from "@/lib/public-content";

export const revalidate = 60;

export default async function TestimonialsPage() {
  const testimonials = await getPublishedTestimonials();
  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-2">Learner testimonials</h1>
      <p className="opacity-70 mb-6">Experiences shared by members of the DLA learning community.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {testimonials.map((testimonial) => (
          <GlassCard className="p-5" key={testimonial.id}>
            <div className="text-[var(--brand-primary)] mb-2">{"★".repeat(testimonial.rating ?? 5)}</div>
            <p className="text-sm opacity-80">“{testimonial.quote}”</p>
            <div className="mt-3 font-semibold">{testimonial.authorName}</div>
            {testimonial.role && <div className="text-sm opacity-60">{testimonial.role}</div>}
          </GlassCard>
        ))}
      </div>
      {!testimonials.length && <GlassCard className="p-5">New student stories will appear here as they are shared.</GlassCard>}
    </main>
  );
}
