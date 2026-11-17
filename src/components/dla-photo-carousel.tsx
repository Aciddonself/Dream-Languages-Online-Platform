"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";

const photos = Array.from({ length: 21 }, (_, index) =>
  `/site-media/dla-photos/dla-community-${String(index + 1).padStart(2, "0")}.webp`,
);

export function DlaPhotoCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % photos.length), 6_000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const move = (direction: number) => setActive((current) => (current + direction + photos.length) % photos.length);

  return (
    <section className="dla-photo-section mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8" aria-label="Life at Dream Languages Uganda">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-secondary)]"><Images size={17} /> Life at DLA</p>
          <h2 className="m-0 text-3xl font-bold">Learning, growing and belonging</h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => move(-1)} aria-label="Previous photo" className="site-icon-button rounded-full p-3"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => move(1)} aria-label="Next photo" className="site-icon-button rounded-full p-3"><ChevronRight size={20} /></button>
        </div>
      </div>
      <div className="dla-photo-frame relative overflow-hidden rounded-3xl" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <Image src={photos[active]} alt={`Dream Languages Uganda community moment ${active + 1}`} fill sizes="(max-width: 768px) 100vw, 1200px" className="object-cover" priority={active === 0} />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/75 to-transparent px-5 pb-5 pt-12 text-white">
          <span className="font-bold">Dream Languages Uganda</span>
          <span className="text-sm font-semibold" aria-live="polite">{active + 1} / {photos.length}</span>
        </div>
      </div>
    </section>
  );
}
