import { GlassCard } from "@/components/ui/glass";
import { DashChart } from "@/components/dashboard/charts";

export type AttendanceMonth = { month: string; percent: number; sessions: number };

export function AttendanceTrendChart({ title, months }: { title: string; months: AttendanceMonth[] }) {
  const hasSessions = months.some((item) => item.sessions > 0);
  const average = hasSessions
    ? Math.round(months.reduce((sum, item) => sum + item.percent * item.sessions, 0) / Math.max(1, months.reduce((sum, item) => sum + item.sessions, 0)))
    : 0;
  return (
    <GlassCard className="mb-5 p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-semibold">{title}</h2><p className="text-sm opacity-65">Monthly attendance from teacher-confirmed completed sessions.</p></div>
        <div className="text-right"><strong className="text-2xl">{hasSessions ? `${average}%` : "—"}</strong><div className="text-xs opacity-65">weighted six-month average</div></div>
      </div>
      {hasSessions ? (
        <DashChart kind="area" height={220} categories={months.map((item) => item.month)} series={[{ name: "Attendance", data: months.map((item) => item.percent) }]} />
      ) : <p className="rounded-xl border border-white/10 p-4 text-sm opacity-65">Attendance charts will appear after completed classes have confirmed records.</p>}
      <ul className="sr-only" aria-label="Monthly attendance percentages">{months.map((item) => <li key={item.month}>{item.month}: {item.sessions ? `${item.percent}%` : "no completed classes"}</li>)}</ul>
    </GlassCard>
  );
}
