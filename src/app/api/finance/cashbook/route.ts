import { and, asc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, financeCashEntries, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { clientIp } from "@/lib/rate-limit";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const entrySchema = z.object({
  direction: z.enum(["income", "expense"]),
  entryDate: dateSchema,
  amount: z.number().int().positive().max(2_000_000_000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3,8}$/).default("UGX"),
  category: z.string().trim().min(2).max(64),
  purpose: z.string().trim().min(3).max(500),
  reference: z.string().trim().max(160).optional().default(""),
}).strict();

function weekStart(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
function monthBounds(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const start = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 7) !== month) return null;
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
function mapSums(rows: Array<{ currency: string; amount: number | string }>) {
  return Object.fromEntries(rows.map((row) => [row.currency, Number(row.amount ?? 0)]));
}
function cashbookUnavailable(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error("Cashbook database operation failed", { code });
  return NextResponse.json({ error: "The cashbook could not reach its database tables. Confirm migration 0016 is applied to the Supabase database used by this service, then retry.", code: "CASHBOOK_DATABASE_UNAVAILABLE" }, { status: 503 });
}
async function balancesBefore(day: string) {
  const rows = await db.select({
    currency: financeCashEntries.currency,
    amount: sql<number>`coalesce(sum(case when ${financeCashEntries.direction} = 'income' then ${financeCashEntries.amount} else -${financeCashEntries.amount} end), 0)`,
  }).from(financeCashEntries).where(and(lt(financeCashEntries.entryDate, day), isNull(financeCashEntries.reversedAt)))
    .groupBy(financeCashEntries.currency);
  return mapSums(rows);
}

export async function GET(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["finance", "admin", "super_admin"].includes(actor.role)) return NextResponse.json({ error: "Finance access required" }, { status: 403 });
  const url = new URL(request.url);
  const selectedDate = dateSchema.safeParse(url.searchParams.get("week") ?? new Date().toISOString().slice(0, 10));
  const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const bounds = monthBounds(month);
  if (!selectedDate.success || !bounds) return NextResponse.json({ error: "Choose a valid week date and month" }, { status: 400 });
  const selectedStart = weekStart(selectedDate.data);
  try {
  const [selectedRows, monthRows, openingBalance, monthOpeningRows] = await Promise.all([
    db.select({ entry: financeCashEntries, recorder: users.displayName, email: users.email })
      .from(financeCashEntries).leftJoin(users, eq(financeCashEntries.recordedBy, users.id))
      .where(and(eq(financeCashEntries.weekStart, selectedStart), isNull(financeCashEntries.reversedAt)))
      .orderBy(asc(financeCashEntries.createdAt)).limit(300),
    db.select({ entry: financeCashEntries, recorder: users.displayName, email: users.email })
      .from(financeCashEntries).leftJoin(users, eq(financeCashEntries.recordedBy, users.id))
      .where(and(gte(financeCashEntries.entryDate, bounds.start), lte(financeCashEntries.entryDate, bounds.end), isNull(financeCashEntries.reversedAt)))
      .orderBy(asc(financeCashEntries.entryDate), asc(financeCashEntries.createdAt)).limit(5000),
    balancesBefore(selectedStart),
    balancesBefore(bounds.start),
  ]);
  const monthWeekStarts = new Set<string>();
  for (let date = new Date(`${bounds.start}T00:00:00.000Z`); date <= new Date(`${bounds.end}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + 1)) {
    monthWeekStarts.add(weekStart(date.toISOString().slice(0, 10)));
  }
  const weekStarts = [...monthWeekStarts].sort();
  const weeklyBalances = await Promise.all(weekStarts.map(async (start) => ({ start, opening: await balancesBefore(start < bounds.start ? bounds.start : start) })));
  const weeks = weekStarts.map((start) => {
    const entries = monthRows.map((row) => row.entry).filter((entry) => entry.weekStart === start);
    const income: Record<string, number> = {};
    const expenses: Record<string, number> = {};
    for (const entry of entries) {
      const totals = entry.direction === "income" ? income : expenses;
      totals[entry.currency] = (totals[entry.currency] ?? 0) + entry.amount;
    }
    const opening = weeklyBalances.find((value) => value.start === start)?.opening ?? {};
    const currencies = new Set([...Object.keys(opening), ...Object.keys(income), ...Object.keys(expenses)]);
    const closing = Object.fromEntries([...currencies].map((currency) => [currency, (opening[currency] ?? 0) + (income[currency] ?? 0) - (expenses[currency] ?? 0)]));
    return { weekStart: start, income, expenses, opening, closing, entryCount: entries.length };
  });
  const monthIncome: Record<string, number> = {};
  const monthExpenses: Record<string, number> = {};
  const monthOpening = monthOpeningRows;
  for (const row of monthRows) {
    const totals = row.entry.direction === "income" ? monthIncome : monthExpenses;
    totals[row.entry.currency] = (totals[row.entry.currency] ?? 0) + row.entry.amount;
  }
  return NextResponse.json({
    month,
    selectedWeekStart: selectedStart,
    selectedWeekEnd: (() => { const d = new Date(`${selectedStart}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); })(),
    openingBalance,
    entries: selectedRows.map(({ entry, recorder, email }) => ({ ...entry, recorder: recorder || email || "Staff" })),
    weeks,
    monthIncome,
    monthExpenses,
    monthOpening,
    monthClosing: Object.fromEntries([...new Set([...Object.keys(monthOpening), ...Object.keys(monthIncome), ...Object.keys(monthExpenses)])].map((currency) => [currency, (monthOpening[currency] ?? 0) + (monthIncome[currency] ?? 0) - (monthExpenses[currency] ?? 0)])),
  });
  } catch (error) {
    return cashbookUnavailable(error);
  }
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["finance", "admin", "super_admin"].includes(actor.role)) return NextResponse.json({ error: "Finance access required" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const parsedDate = new Date(`${input.entryDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.entryDate) return NextResponse.json({ error: "Enter a valid transaction date" }, { status: 400 });
  try {
  const [entry] = await db.insert(financeCashEntries).values({
    ...input,
    reference: input.reference || null,
    weekStart: weekStart(input.entryDate),
    recordedBy: actor.id,
  }).returning();
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "record_finance_cash_entry",
    entityType: "finance_cash_entry",
    entityId: entry.id,
    after: { direction: entry.direction, entryDate: entry.entryDate, amount: entry.amount, currency: entry.currency, category: entry.category, purpose: entry.purpose },
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true, entry }, { status: 201 });
  } catch (error) {
    return cashbookUnavailable(error);
  }
}

export async function DELETE(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["finance", "admin", "super_admin"].includes(actor.role)) return NextResponse.json({ error: "Finance access required" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = z.object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(300) }).strict().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
  const [entry] = await db.update(financeCashEntries).set({ reversedAt: new Date(), reversedBy: actor.id, reversalReason: parsed.data.reason })
    .where(and(eq(financeCashEntries.id, parsed.data.id), isNull(financeCashEntries.reversedAt))).returning();
  if (!entry) return NextResponse.json({ error: "Active cashbook entry not found" }, { status: 404 });
  await db.insert(auditLogs).values({ actorId: actor.id, action: "reverse_finance_cash_entry", entityType: "finance_cash_entry", entityId: entry.id, after: { amount: entry.amount, currency: entry.currency, reason: parsed.data.reason }, ip: clientIp(request), userAgent: request.headers.get("user-agent") });
  return NextResponse.json({ ok: true });
  } catch (error) {
    return cashbookUnavailable(error);
  }
}
