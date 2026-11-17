"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { intakes, MONTHS } from "@/lib/classes-2027";

type Countdown = { month: string; date: Date; days: number };

function getNextIntake(): Countdown | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = intakes.find((intake) => intake.start >= today);
  if (!next) return null;
  const start = new Date(next.start.getFullYear(), next.start.getMonth(), next.start.getDate());
  return { month: MONTHS[next.month], date: start, days: Math.max(0, Math.ceil((start.getTime() - today.getTime()) / 86_400_000)) };
}

export function IntakeCountdownPopup() {
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [open, setOpen] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const refresh = () => setCountdown(getNextIntake());
    refresh();
    const daily = window.setInterval(refresh, 60_000);
    const popup = window.setInterval(() => { refresh(); setOpen(true); setCycle((value) => value + 1); }, 30_000);
    return () => { window.clearInterval(daily); window.clearInterval(popup); };
  }, []);

  if (!open || !countdown) return null;
  return (
    <aside key={cycle} aria-live="polite" aria-label="Next DLA intake reminder" className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-4 shadow-xl sm:left-auto sm:right-6 sm:bottom-6">
      <button type="button" onClick={() => setOpen(false)} aria-label="Close intake reminder" className="absolute right-3 top-3 rounded-full p-1 hover:bg-[var(--surface)]"><X size={18} /></button>
      <p className="pr-8 text-sm font-bold text-[var(--brand-secondary)]">The {countdown.month} intake is coming up</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{countdown.days === 0 ? "Classes start today" : `${countdown.days} ${countdown.days === 1 ? "day" : "days"} left`} · {countdown.date.toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" })}</p>
      <Link href="/apply?intake=next" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[var(--brand-secondary)] px-4 py-2 font-bold text-white hover:opacity-90">Book the next intake</Link>
    </aside>
  );
}
