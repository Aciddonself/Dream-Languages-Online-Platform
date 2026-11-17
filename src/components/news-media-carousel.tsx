"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type NewsMediaSlide = { title: string; url: string; excerpt?: string | null };

export function NewsMediaCarousel({ slides }: { slides: NewsMediaSlide[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (slides.length < 2 || isVideo(slides[index]?.url)) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % slides.length), 6_000);
    return () => window.clearInterval(timer);
  }, [index, slides]);
  if (!slides.length) return null;
  const slide = slides[index];
  const video = isVideo(slide.url);
  const move = (direction: number) => setIndex((value) => (value + direction + slides.length) % slides.length);
  return (
    <section aria-label="DLA news and community stories" className="news-carousel relative mb-8 overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-strong)] shadow-[0_8px_30px_rgba(8,38,74,.12)]">
      <div className="relative aspect-[16/8] min-h-64 max-h-[36rem] w-full bg-[var(--brand-secondary)] sm:aspect-[16/7]">
        {video
          ? <video key={slide.url} src={slide.url} controls playsInline className="h-full w-full object-contain" onEnded={() => move(1)} aria-label={slide.title} />
          : <img key={slide.url} src={slide.url} alt={slide.title} className="h-full w-full object-cover" />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#061a31]/95 via-[#061a31]/55 to-transparent px-5 pb-5 pt-16 text-white sm:px-8 sm:pb-7">
          <h2 className="text-xl font-bold text-white sm:text-3xl">{slide.title}</h2>
          {slide.excerpt && <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-white/90 sm:text-base">{slide.excerpt}</p>}
        </div>
        {slides.length > 1 && <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-3">
          <button type="button" onClick={() => move(-1)} aria-label="Previous story" className="grid h-11 w-11 place-items-center rounded-full border border-white/50 bg-[#08264a]/75 text-white hover:bg-[#08264a]"><ChevronLeft /></button>
          <button type="button" onClick={() => move(1)} aria-label="Next story" className="grid h-11 w-11 place-items-center rounded-full border border-white/50 bg-[#08264a]/75 text-white hover:bg-[#08264a]"><ChevronRight /></button>
        </div>}
        {slides.length > 1 && <div className="absolute bottom-2 right-4 flex gap-1.5" aria-label={`Slide ${index + 1} of ${slides.length}`}>
          {slides.map((item, number) => <button key={`${item.url}-${number}`} aria-label={`Show story ${number + 1}`} aria-current={index === number} onClick={() => setIndex(number)} className={`h-2.5 rounded-full border border-white/70 transition-all ${index === number ? "w-7 bg-white" : "w-2.5 bg-white/40"}`} />)}
        </div>}
      </div>
    </section>
  );
}

export function isVideo(url: string) { return /\.(mp4|webm|mov)(\?|$)/i.test(url); }
