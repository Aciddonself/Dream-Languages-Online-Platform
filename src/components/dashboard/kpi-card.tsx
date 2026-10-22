import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function KpiCard({
  label,
  value,
  change,
  icon,
  hint = "vs last term",
}: {
  label: string;
  value: string | number;
  change: number;
  icon?: ReactNode;
  hint?: string;
}) {
  const up = change >= 0;
  return (
    <article className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon ? <span className="kpi-icon" aria-hidden="true">{icon}</span> : null}
      </div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-change ${up ? "is-up" : "is-down"}`}>
        {up ? <ArrowUpRight size={15} aria-hidden="true" /> : <ArrowDownRight size={15} aria-hidden="true" />}
        <strong>{up ? "+" : ""}{change}%</strong>
        <span>{hint}</span>
      </div>
    </article>
  );
}
