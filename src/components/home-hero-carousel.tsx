"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const schoolPhotos = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 16, 18, 19].map((number) =>
  `/site-media/dla-photos/dla-community-${String(number).padStart(2, "0")}.webp`,
);

export function HomeHeroCarousel({ firstImage, firstAlt }: { firstImage: string; firstAlt: string }) {
  const slides = [{ src: firstImage, alt: firstAlt }, ...schoolPhotos.map((src, index) => ({ src, alt: `Dream Languages Uganda learners and school community, photo ${index + 1}` }))];
  const [active, setActive] = useState(0);
  const [heroImageIsLandscape, setHeroImageIsLandscape] = useState(false);

  useEffect(() => {
    const probe = new window.Image();
    probe.onload = () => {
      const ratio = probe.naturalWidth / probe.naturalHeight;
      setHeroImageIsLandscape(ratio > 1);
    };
    probe.onerror = () => setHeroImageIsLandscape(false);
    probe.src = firstImage;
    return () => { probe.onload = null; probe.onerror = null; };
  }, [firstImage]);

  const visibleSlides = heroImageIsLandscape ? slides : slides.slice(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % visibleSlides.length), 3_000);
    return () => window.clearInterval(timer);
  }, [visibleSlides.length]);

  const move = (direction: number) => setActive((current) => (current + direction + visibleSlides.length) % visibleSlides.length);

  useEffect(() => { setActive(0); }, [heroImageIsLandscape]);

  return (
    <div className="home-hero-carousel relative mx-auto my-6 w-full max-w-5xl overflow-hidden rounded-3xl" role="region" aria-label="Dream Languages school photos">
      <Image key={visibleSlides[active].src} src={visibleSlides[active].src} alt={visibleSlides[active].alt} fill priority={active === 0} sizes="(max-width: 900px) 100vw, 840px" className="dla-image-enter object-cover" unoptimized={visibleSlides[active].src.startsWith("https://")} />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-slate-950/70 to-transparent px-4 pb-4 pt-10 text-white sm:px-6">
        <span className="text-sm font-bold">Dream Languages Uganda</span>
        <span className="text-xs font-bold" aria-live="polite">Photo {active + 1} of {visibleSlides.length}</span>
      </div>
      <button type="button" onClick={() => move(-1)} aria-label="Previous school photo" className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-[#08264a]/75 text-white hover:bg-[#08264a]"><ChevronLeft /></button>
      <button type="button" onClick={() => move(1)} aria-label="Next school photo" className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-[#08264a]/75 text-white hover:bg-[#08264a]"><ChevronRight /></button>
    </div>
  );
}
