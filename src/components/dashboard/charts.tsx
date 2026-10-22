"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useTheme } from "@/components/theme-provider";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <div className="chart-skeleton" aria-hidden="true" />,
});

const PALETTE = ["#c99c3b", "#08264a", "#258873", "#174c7d", "#cf2e2e"];

type Kind = "bar" | "line" | "area" | "donut" | "radialBar";

export function DashChart({
  kind,
  series,
  categories,
  labels,
  height = 280,
}: {
  kind: Kind;
  series: ApexOptions["series"];
  categories?: string[];
  labels?: string[];
  height?: number;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const text = dark ? "#c9d4e4" : "#53667e";
  const axis = kind !== "donut" && kind !== "radialBar";
  const options: ApexOptions = {
    chart: {
      type: kind,
      toolbar: { show: false },
      background: "transparent",
      fontFamily: "inherit",
      animations: { enabled: typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches },
    },
    theme: { mode: dark ? "dark" : "light" },
    colors: PALETTE,
    labels,
    xaxis: axis ? { categories, labels: { style: { colors: text } } } : undefined,
    yaxis: axis ? { labels: { style: { colors: text } } } : undefined,
    grid: { borderColor: dark ? "#1f3556" : "#e4e6f2", strokeDashArray: 4 },
    stroke: { curve: "smooth", width: kind === "line" || kind === "area" ? 3 : 0 },
    plotOptions: {
      bar: { borderRadius: 6, columnWidth: "48%" },
      radialBar: { hollow: { size: "58%" }, dataLabels: { value: { color: text } } },
    },
    dataLabels: { enabled: false },
    legend: { labels: { colors: text }, position: "bottom" },
    tooltip: { theme: dark ? "dark" : "light" },
  };
  return <Chart type={kind} series={series} options={options} height={height} />;
}
