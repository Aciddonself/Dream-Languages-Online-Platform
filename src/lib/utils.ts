import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });
}

export function formatMoney(amount: number, currency = "UGX") {
  return new Intl.NumberFormat("en-UG").format(amount) + " " + currency;
}