import { and, asc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { financeCashEntries, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createTextPdf } from "@/lib/pdf";

const weekdayDate = (value: string) => new Intl.DateTimeFormat("en-UG", {
  weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Kampala",
}).format(new Date(`${value}T12:00:00.000Z`));

export async function GET(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["finance", "admin", "super_admin"].includes(actor.role)) return NextResponse.json({ error: "Finance access required" }, { status: 403 });
  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Choose a valid month" }, { status: 400 });
  const start = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const entries = await db.select({ entry: financeCashEntries, recorder: users.displayName, email: users.email })
    .from(financeCashEntries).leftJoin(users, eq(financeCashEntries.recordedBy, users.id))
    .where(and(gte(financeCashEntries.entryDate, start), lte(financeCashEntries.entryDate, end), isNull(financeCashEntries.reversedAt)))
    .orderBy(asc(financeCashEntries.weekStart), asc(financeCashEntries.entryDate), asc(financeCashEntries.createdAt)).limit(5000);
  const totals = new Map<string, { income: number; expenses: number }>();
  const openingRows = await db.select({ currency: financeCashEntries.currency, amount: sql<number>`coalesce(sum(case when ${financeCashEntries.direction} = 'income' then ${financeCashEntries.amount} else -${financeCashEntries.amount} end), 0)` })
    .from(financeCashEntries).where(and(lt(financeCashEntries.entryDate, start), isNull(financeCashEntries.reversedAt))).groupBy(financeCashEntries.currency);
  const openingBalance = new Map<string, number>(openingRows.map((row) => [row.currency, Number(row.amount ?? 0)]));
  const lines = [`Reporting period: ${month}`, "Currency totals are kept separate.", ""];
  for (const { entry } of entries) {
    const currency = totals.get(entry.currency) ?? { income: 0, expenses: 0 };
    if (entry.direction === "income") currency.income += entry.amount;
    else currency.expenses += entry.amount;
    totals.set(entry.currency, currency);
  }
  lines.push("MONTH TOTALS");
  if (totals.size || openingBalance.size) for (const currency of new Set<string>([...openingBalance.keys(), ...totals.keys()])) {
    const total = totals.get(currency) ?? { income: 0, expenses: 0 };
    const opening = openingBalance.get(currency) ?? 0;
    lines.push(`${currency}: brought forward ${opening.toLocaleString()} | received ${total.income.toLocaleString()} | spent ${total.expenses.toLocaleString()} | closing ${(opening + total.income - total.expenses).toLocaleString()}`);
  }
  else lines.push("No entries were recorded for this month.");
  lines.push("", "WEEKLY DETAIL");
  const weeks = new Map<string, typeof entries>();
  for (const row of entries) {
    const group = weeks.get(row.entry.weekStart) ?? [];
    group.push(row);
    weeks.set(row.entry.weekStart, group);
  }
  const weekStarts = new Set<string>();
  for (let day = new Date(`${start}T00:00:00.000Z`); day <= new Date(`${end}T00:00:00.000Z`); day.setUTCDate(day.getUTCDate() + 1)) {
    const monday = new Date(day);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    weekStarts.add(monday.toISOString().slice(0, 10));
  }
  for (const week of [...weekStarts].sort()) {
    const rows = weeks.get(week) ?? [];
    const income: Record<string, number> = {};
    const expenses: Record<string, number> = {};
    const weekBoundary = week < start ? start : week;
    const opening = Object.fromEntries([...openingBalance].map(([currency, amount]) => [currency, amount]));
    if (weekBoundary !== start) {
      const carriedRows = await db.select({ currency: financeCashEntries.currency, amount: sql<number>`coalesce(sum(case when ${financeCashEntries.direction} = 'income' then ${financeCashEntries.amount} else -${financeCashEntries.amount} end), 0)` })
        .from(financeCashEntries).where(and(lt(financeCashEntries.entryDate, weekBoundary), isNull(financeCashEntries.reversedAt))).groupBy(financeCashEntries.currency);
      for (const row of carriedRows) opening[row.currency] = Number(row.amount ?? 0);
    }
    lines.push("", `Week beginning ${weekdayDate(week)} · reporting days ${weekdayDate(weekBoundary)} to ${weekdayDate(new Date(Math.min(Date.parse(`${end}T00:00:00Z`), Date.parse(`${week}T00:00:00Z`) + 6 * 86_400_000)).toISOString().slice(0, 10))}`);
    for (const { entry, recorder, email } of rows) {
      const target = entry.direction === "income" ? income : expenses;
      target[entry.currency] = (target[entry.currency] ?? 0) + entry.amount;
      lines.push(`${weekdayDate(entry.entryDate)} | ${entry.direction.toUpperCase()} | ${entry.currency} ${entry.amount.toLocaleString()} | ${entry.category} | ${entry.purpose} | recorded by ${recorder || email || "Staff"}`);
    }
    if (!rows.length) lines.push("No transactions recorded this week.");
    for (const currency of new Set([...Object.keys(opening), ...Object.keys(income), ...Object.keys(expenses)])) {
      const open = opening[currency] ?? 0;
      const received = income[currency] ?? 0;
      const spent = expenses[currency] ?? 0;
      lines.push(`${currency} balance: brought forward ${open.toLocaleString()} | received ${received.toLocaleString()} | spent ${spent.toLocaleString()} | closing ${ (open + received - spent).toLocaleString()}`);
    }
  }
  lines.push("", "Prepared from active, non-reversed entries in the DLA finance cashbook.", `Generated: ${new Intl.DateTimeFormat("en-UG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Kampala" }).format(new Date())}`);
  const pdf = createTextPdf(`DLA Weekly and Monthly Cash Report ${month}`, lines);
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="dla-cash-report-${month}.pdf"`, "Cache-Control": "private, no-store" } });
}
