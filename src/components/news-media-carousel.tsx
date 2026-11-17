"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type NewsMediaSlide = { title: string; url: string; excerpt?: string | null };

export function NewsMediaCarousel({ slides }: { slides: NewsMediaSlide[] }) {
  const [index, setIndex] = useState(0);
  const [landscapeUrls, setLandscapeUrls] = useState<Set<string>>(new Set());
  const [imagesChecked, setImagesChecked] = useState(false);

  const slideSignature = slides.map((slide) => slide.url).join("|");
  useEffect(() => {
    let cancelled = false;
    const imageSlides = slides.filter((slide) => !isVideo(slide.url));
    if (!imageSlides.length) {
      setLandscapeUrls(new Set());
      setImagesChecked(true);
      return () => { cancelled = true; };
    }
    setImagesChecked(false);
    Promise.all(imageSlides.map((slide) => new Promise<boolean>((resolve) => {
      const image = new window.Image();
      image.onload = () => {
        const ratio = image.naturalWidth / image.naturalHeight;
        resolve(ratio > 1);
      };
      image.onerror = () => resolve(false);
      image.src = slide.url;
    }))).then((results) => {
      if (cancelled) return;
      setLandscapeUrls(new Set(imageSlides.filter((_, index) => results[index]).map((slide) => slide.url)));
      setImagesChecked(true);
      setIndex(0);
    });
    return () => { cancelled = true; };
  }, [slideSignature]);

  const visibleSlides = slides.filter((slide) => isVideo(slide.url) || landscapeUrls.has(slide.url));
  useEffect(() => {
    if (visibleSlides.length < 2 || isVideo(visibleSlides[index]?.url)) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % visibleSlides.length), 3_000);
    return () => window.clearInterval(timer);
  }, [index, visibleSlides]);
  if (!imagesChecked || !visibleSlides.length) return null;
  const slide = visibleSlides[index % visibleSlides.length];
  const video = isVideo(slide.url);
  const move = (direction: number) => setIndex((value) => (value + direction + visibleSlides.length) % visibleSlides.length);
  return (
    <section aria-label="DLA news and community stories" className="news-carousel relative mb-8 overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-strong)] shadow-[0_8px_30px_rgba(8,38,74,.12)]">
      <div className="relative aspect-[3/2] min-h-56 max-h-[35rem] w-full bg-[var(--surface)]">
        {video
          ? <video key={slide.url} src={slide.url} controls playsInline className="h-full w-full object-contain" onEnded={() => move(1)} aria-label={slide.title} />
          : <img key={slide.url} src={slide.url} alt={slide.title} className="dla-image-enter h-full w-full object-cover" />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#061a31]/95 via-[#061a31]/55 to-transparent px-5 pb-5 pt-16 text-white sm:px-8 sm:pb-7">
          <h2 className="text-xl font-bold text-white sm:text-3xl">{slide.title}</h2>
          {slide.excerpt && <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-white/90 sm:text-base">{slide.excerpt}</p>}
        </div>
        {visibleSlides.length > 1 && <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-3">
          <button type="button" onClick={() => move(-1)} aria-label="Previous story" className="grid h-11 w-11 place-items-center rounded-full border border-white/50 bg-[#08264a]/75 text-white hover:bg-[#08264a]"><ChevronLeft /></button>
          <button type="button" onClick={() => move(1)} aria-label="Next story" className="grid h-11 w-11 place-items-center rounded-full border border-white/50 bg-[#08264a]/75 text-white hover:bg-[#08264a]"><ChevronRight /></button>
        </div>}
        {visibleSlides.length > 1 && <div className="absolute bottom-2 right-4 flex gap-1.5" aria-label={`Slide ${index + 1} of ${visibleSlides.length}`}>
          {visibleSlides.map((item, number) => <button key={`${item.url}-${number}`} aria-label={`Show story ${number + 1}`} aria-current={index === number} onClick={() => setIndex(number)} className={`h-2.5 rounded-full border border-white/70 transition-all ${index === number ? "w-7 bg-white" : "w-2.5 bg-white/40"}`} />)}
        </div>}
      </div>
    </section>
  );
}

export function isVideo(url: string) { return typeof url === "string" && /\.(mp4|webm|mov)(\?|$)/i.test(url); }
