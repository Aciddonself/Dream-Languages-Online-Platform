"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass";

const stats = [
  { label: "Finished Sessions", value: 1200, suffix: "+" },
  { label: "Enrolled Learners", value: 700, suffix: "+" },
  { label: "Languages & Programmes", value: 40, suffix: "+" },
  { label: "Satisfaction Rate", value: 100, suffix: "%" },
];

export function CountUpStats() {
  const sectionRef = useRef<HTMLElement>(null);
  const [counts, setCounts] = useState(() => stats.map(() => 0));

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let active = false;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !active) {
        active = true;
        setCounts(stats.map(() => 0));
        if (reduceMotion) {
          setCounts(stats.map((stat) => stat.value));
          return;
        }
        const startedAt = performance.now();
        const duration = 1500;
        const animate = (now: number) => {
          const progress = Math.min((now - startedAt) / duration, 1);
          const easedProgress = 1 - (1 - progress) ** 3;
          setCounts(stats.map((stat) => Math.floor(stat.value * easedProgress)));
          if (progress < 1) frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      } else if (!entry.isIntersecting && active) {
        active = false;
        cancelAnimationFrame(frame);
        setCounts(stats.map(() => 0));
      }
    }, { threshold: 0.35 });

    observer.observe(section);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} aria-label="Dream Languages Uganda at a glance" className="px-6 max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
      {stats.map((stat, index) => (
        <GlassCard key={stat.label} className="p-5 text-center">
          <div className="text-3xl font-bold text-[var(--brand-primary)]" aria-label={`${stat.value}${stat.suffix}`}>
            {counts[index].toLocaleString()}{stat.suffix}
          </div>
          <div className="text-sm opacity-70 mt-1">{stat.label}</div>
        </GlassCard>
      ))}
    </section>
  );
}
