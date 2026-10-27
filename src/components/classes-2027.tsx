"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass";
import {
  LEVELS, MODES, MONTHS, SLOTS, YEAR, dateLong, dateShort, dayKey, daysBetween, holidays, intakes, nextIntakeIndex,
  range, relative, shareText, upcomingEvents, type Level, type Mode,
} from "@/lib/classes-2027";

const hue = (month: number) => `hsl(${(month * 30 + 205) % 360} 55% 36%)`;

function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

const legend = [
  { cls: "bg-rose-500/80 text-white", label: "Registration closes" },
  { cls: "bg-amber-500/80 text-white", label: "Exam registration closes" },
  { cls: "bg-sky-500/80 text-white", label: "Mock exam" },
  { cls: "bg-violet-600/80 text-white", label: "Final exams" },
  { cls: "bg-emerald-600/80 text-white", label: "Classes start" },
  { cls: "bg-slate-500/50 text-white", label: "Public holiday" },
];

export function Classes2027() {
  const [today, setToday] = useState<Date | null>(null);
  const [mode, setMode] = useState<Mode>("Physical");
  const [level, setLevel] = useState<Level | "All">("All");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      const now = startOfToday();
      setToday(now);
      setSelected(nextIntakeIndex(now));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const intake = intakes[selected];
  const upcoming = useMemo(() => (today ? upcomingEvents(today) : []), [today]);
  const levels = level === "All" ? LEVELS : [level];

  const alerts = useMemo(() => {
    if (!today) return { urgent: false, lines: [] as string[] };
    let urgent = false;
    const lines: string[] = [];
    for (const i of intakes) {
      if (today >= i.regOpens && today <= i.regCloses) {
        const gap = daysBetween(i.regCloses, today);
        if (gap <= 7) urgent = true;
        lines.push(`Registration is open for the ${MONTHS[i.month]} intake. It closes ${dateLong(i.regCloses)} (${relative(gap)}).`);
      }
    }
    for (const event of upcoming.slice(0, 3)) {
      const gap = daysBetween(event.date, today);
      if (gap <= 7) urgent = true;
      lines.push(`${event.label}: ${dateLong(event.date)} (${relative(gap)})`);
    }
    if (!lines.length) lines.push(`All ${YEAR} dates have passed.`);
    return { urgent, lines };
  }, [today, upcoming]);

  const shareUrl = typeof window === "undefined" ? "" : window.location.href;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(shareText(intake, shareUrl))}`;

  const marks = useMemo(() => {
    const map = new Map<string, string>();
    for (const [key] of holidays) map.set(key, legend[5].cls);
    for (const i of intakes) {
      map.set(dayKey(i.regCloses), legend[0].cls);
      map.set(dayKey(i.examRegCloses), legend[1].cls);
      map.set(dayKey(i.mock), legend[2].cls);
      map.set(dayKey(i.finalOne), legend[3].cls);
      map.set(dayKey(i.finalTwo), legend[3].cls);
      map.set(dayKey(i.start), legend[4].cls);
    }
    return map;
  }, []);

  return (
    <div className="space-y-8">
      <GlassCard className="p-5 md:p-7" strong>
        <h1 className="text-3xl md:text-4xl">DLA Language Classes {YEAR}</h1>
        <p className="mt-2 opacity-80">
          German, English and French · levels A1 to B2 · a new intake starts every month · each course lasts 2 months · Monday to Friday, 2 hours a day.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={whatsapp} target="_blank" rel="noreferrer" className="liquid-link inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 font-semibold">
            <MessageCircle size={18} aria-hidden="true" /> Share on WhatsApp
          </a>
          <Link href="/apply" className="liquid-link inline-flex items-center rounded-full border border-white/30 px-4 py-2 font-semibold">Apply now</Link>
        </div>
      </GlassCard>

      <GlassCard className={`p-5 ${alerts.urgent ? "border-orange-500/60" : ""}`}>
        <h2 className="text-2xl mb-2">{alerts.urgent ? "Deadline coming up" : "Coming up"}</h2>
        <ul className="list-disc pl-5 space-y-1" aria-live="polite">
          {alerts.lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </GlassCard>

      <section aria-labelledby="timetable-heading">
        <h2 id="timetable-heading" className="text-2xl mb-3">Class times</h2>
        <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Study mode">
          {MODES.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              className={`liquid-link rounded-full border px-4 py-1.5 font-semibold ${mode === m ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/20" : "border-white/20"}`}>
              {m}
            </button>
          ))}
          <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value as Level | "All")} className="glass px-3 py-1.5">
            <option value="All">All levels</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <GlassCard className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-white/5"><th className="p-3">Level</th><th className="p-3">{mode} class (Mon – Fri)</th></tr></thead>
            <tbody>
              {levels.map((l) => (
                <tr key={l} className="border-t border-white/10"><td className="p-3 font-semibold">{l}</td><td className="p-3">{range(SLOTS[mode][l], SLOTS[mode][l] + 120)}</td></tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </section>

      <section aria-labelledby="intake-heading">
        <h2 id="intake-heading" className="text-2xl mb-3">Intake details</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {MONTHS.map((name, i) => (
            <button key={name} type="button" onClick={() => setSelected(i)} aria-pressed={selected === i}
              className={`liquid-link rounded-full border px-3 py-1 text-sm font-semibold ${selected === i ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/20" : "border-white/20"}`}>
              {name.slice(0, 3)}
            </button>
          ))}
        </div>
        <GlassCard className="p-5" >
          <h3 className="text-2xl" style={{ color: hue(intake.month) }}>{MONTHS[intake.month]} intake</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Registration", `${dateShort(intake.regOpens)} to ${dateLong(intake.regCloses)}`],
              ["Classes start", dateLong(intake.start)],
              ["Exam registration closes", dateLong(intake.examRegCloses)],
              ["Mock exam", dateLong(intake.mock)],
              ["Final exams", `${dateShort(intake.finalOne)} and ${dateLong(intake.finalTwo)}`],
            ].map(([term, value]) => (
              <div key={term}><dt className="text-sm opacity-70">{term}</dt><dd className="font-semibold">{value}</dd></div>
            ))}
          </dl>
        </GlassCard>
      </section>

      <section aria-labelledby="calendar-heading">
        <h2 id="calendar-heading" className="text-2xl mb-3">{YEAR} calendar</h2>
        <div className="flex flex-wrap gap-2 mb-3 text-sm">
          {legend.map((item) => <span key={item.label} className={`rounded-full px-3 py-1 ${item.cls}`}>{item.label}</span>)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MONTHS.map((name, m) => {
            const first = (new Date(YEAR, m, 1).getDay() + 6) % 7;
            const days = new Date(YEAR, m + 1, 0).getDate();
            return (
              <GlassCard key={name} className={`p-4 ${today && nextIntakeIndex(today) === m ? "ring-2 ring-[var(--brand-accent)]" : ""}`}>
                <button type="button" onClick={() => setSelected(m)} className="mb-1 text-left">
                  <h3 className="text-xl" style={{ color: hue(m) }}>{name}</h3>
                </button>
                <p className="text-sm opacity-70 mb-2">Classes start {dateLong(intakes[m].start)}</p>
                <div className="grid grid-cols-7 gap-1 text-center text-sm">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <b key={i} className="opacity-60">{d}</b>)}
                  {Array.from({ length: first }, (_, i) => <i key={`b${i}`} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const date = new Date(YEAR, m, i + 1);
                    const mark = marks.get(dayKey(date));
                    const weekend = date.getDay() === 0 || date.getDay() === 6;
                    return <i key={i} title={holidays.get(dayKey(date))} className={`rounded not-italic ${mark ?? (weekend ? "opacity-45" : "")}`}>{i + 1}</i>;
                  })}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl mb-3">Registration</h2>
          <GlassCard className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-white/5"><th className="p-3">Intake</th><th className="p-3">Register</th><th className="p-3">Classes start</th></tr></thead>
              <tbody>
                {intakes.map((i) => (
                  <tr key={i.month} className="border-t border-white/10">
                    <td className="p-3 font-semibold" style={{ color: hue(i.month) }}>{MONTHS[i.month]}</td>
                    <td className="p-3">{dateShort(i.regOpens)} to {dateLong(i.regCloses)}</td>
                    <td className="p-3">{dateLong(i.start)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </div>
        <div>
          <h2 className="text-2xl mb-3">Exams</h2>
          <GlassCard className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-white/5"><th className="p-3">Intake</th><th className="p-3">Exam registration closes</th><th className="p-3">Mock</th><th className="p-3">Finals</th></tr></thead>
              <tbody>
                {intakes.map((i) => (
                  <tr key={i.month} className="border-t border-white/10">
                    <td className="p-3 font-semibold" style={{ color: hue(i.month) }}>{MONTHS[i.month]}</td>
                    <td className="p-3">{dateLong(i.examRegCloses)}</td>
                    <td className="p-3">{dateLong(i.mock)}</td>
                    <td className="p-3">{dateShort(i.finalOne)} and {dateLong(i.finalTwo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </div>
      </section>

      <section>
        <h2 className="text-2xl mb-3">Exam day schedule</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LEVELS.flatMap((l) => MODES.map((m) => {
            const s = SLOTS[m][l];
            return (
              <GlassCard key={`${l}-${m}`} className="p-4">
                <h3 className="text-lg">{l}, {m}</h3>
                <p className="text-sm mt-2"><b>Thu</b> Reading {range(s, s + 65)}</p>
                <p className="text-sm">Listening {range(s + 75, s + 115)}</p>
                <p className="text-sm"><b>Fri</b> Writing {range(s, s + 60)}</p>
                <p className="text-sm">Speaking, in pairs {range(s + 60, s + 120)}</p>
              </GlassCard>
            );
          }))}
        </div>
      </section>
    </div>
  );
}
