import { NextResponse } from "next/server";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { departments, feeSchedules, payments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["finance", "admin", "super_admin"].includes(actor.role)) return NextResponse.json({ error: "Finance access required" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const departmentId = params.get("departmentId") ?? "";
  const category = params.get("category") ?? "all";
  if (!["all", "new", "continuing"].includes(category)) return NextResponse.json({ error: "Invalid student category" }, { status: 400 });

  const hasVerifiedPayment = sql`exists (
    select 1 from payments prior_payment
    where prior_payment.student_id = ${users.id}
      and prior_payment.status = 'verified'
  )`;
  const hasSchedule = sql`exists (select 1 from fee_schedules fs where fs.student_id = ${users.id})`;
  const hasOutstanding = sql`exists (select 1 from fee_schedules fs where fs.student_id = ${users.id} and fs.amount > fs.paid)`;
  const conditions = [
    eq(users.role, "student"),
    inArray(users.status, ["active", "registered"]),
    isNull(users.deletedAt),
    or(hasOutstanding, sql`not ${hasSchedule}`)!,
  ];
  if (departmentId === "unassigned") conditions.push(isNull(users.departmentId));
  else if (departmentId) conditions.push(eq(users.departmentId, departmentId));
  if (category === "new") conditions.push(sql`not ${hasVerifiedPayment}`);
  if (category === "continuing") conditions.push(hasVerifiedPayment);
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(
      ilike(users.registrationNumber, pattern),
      ilike(users.displayName, pattern),
      ilike(users.firstName, pattern),
      ilike(users.lastName, pattern),
      sql`concat_ws(' ', ${users.firstName}, ${users.lastName}) ilike ${pattern}`,
    )!);
  }

  const rows = await db.select({
    id: users.id,
    name: sql<string>`coalesce(nullif(${users.displayName}, ''), nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.email})`,
    registrationNumber: users.registrationNumber,
    department: departments.name,
    currency: feeSchedules.currency,
    balance: sql<number | null>`sum(greatest(${feeSchedules.amount} - ${feeSchedules.paid}, 0))::bigint`,
  }).from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(feeSchedules, and(eq(feeSchedules.studentId, users.id), sql`${feeSchedules.amount} > ${feeSchedules.paid}`))
    .where(and(...conditions))
    .groupBy(users.id, users.displayName, users.firstName, users.lastName, users.email, users.registrationNumber, departments.name, feeSchedules.currency)
    .orderBy(asc(departments.name), asc(users.displayName), asc(users.registrationNumber), asc(feeSchedules.currency))
    .limit(300);

  const studentIds: string[] = [...new Set<string>(rows.map((row) => row.id))];
  const priorPayers = studentIds.length ? await db.select({ studentId: payments.studentId }).from(payments)
    .where(and(eq(payments.status, "verified"), inArray(payments.studentId, studentIds)))
    .groupBy(payments.studentId) : [];
  const priorPayerIds = new Set(priorPayers.flatMap((row) => row.studentId ? [row.studentId] : []));
  const studentMap = new Map<string, {
    id: string;
    name: string;
    registrationNumber: string | null;
    department: string | null;
    category: "new" | "continuing";
    hasFeeSchedule: boolean;
    balances: Map<string, number>;
  }>();
  for (const row of rows) {
    const student = studentMap.get(row.id) ?? {
      id: row.id,
      name: row.name,
      registrationNumber: row.registrationNumber,
      department: row.department,
      category: priorPayerIds.has(row.id) ? "continuing" : "new",
      hasFeeSchedule: row.currency !== null,
      balances: new Map<string, number>(),
    };
    if (row.currency && row.balance !== null) student.balances.set(row.currency, Number(row.balance));
    studentMap.set(row.id, student);
  }
  return NextResponse.json({ students: [...studentMap.values()].map((student) => ({ ...student, balances: [...student.balances].map(([currency, amount]) => ({ currency, amount })) })) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
