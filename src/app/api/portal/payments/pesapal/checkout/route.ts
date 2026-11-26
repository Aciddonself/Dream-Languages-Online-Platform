import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, feeSchedules, payments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createPesapalOrder, pesapalConfigured } from "@/lib/pesapal";

const schema = z.object({ amount: z.number().int().positive().max(100_000_000) }).strict();

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Sign in to your student account before paying online" }, { status: 401 });
  if (actor.role !== "student") return NextResponse.json({ error: "Student account required" }, { status: 403 });
  if (!pesapalConfigured()) return NextResponse.json({ error: "Pesapal checkout is awaiting the school merchant keys and registered IPN ID. Manual bank and mobile money payments remain available." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await db.transaction(async (tx: any) => {
    const [student] = await tx.select({ id: users.id, email: users.email, displayName: users.displayName, firstName: users.firstName, lastName: users.lastName, phone: users.phone })
      .from(users).where(eq(users.id, actor.id)).for("update").limit(1);
    if (!student) return { error: "Student account not found", status: 404 as const };
    const schedules = await tx.select().from(feeSchedules).where(and(eq(feeSchedules.studentId, actor.id), eq(feeSchedules.currency, "UGX"), sql`${feeSchedules.paid} < ${feeSchedules.amount}`))
      .orderBy(asc(feeSchedules.dueDate), asc(feeSchedules.createdAt)).for("update");
    const balance = schedules.reduce((sum: number, fee: { amount: number; paid: number }) => sum + Math.max(fee.amount - fee.paid, 0), 0);
    if (balance === 0) return { error: "No outstanding UGX fee balance is available for online payment", status: 409 as const };
    if (parsed.data.amount > balance) return { error: `Amount exceeds the outstanding UGX ${balance.toLocaleString()} balance`, status: 400 as const };
    const reference = `DLA-${randomUUID()}`;
    const [payment] = await tx.insert(payments).values({ studentId: actor.id, amount: parsed.data.amount, currency: "UGX", method: "pesapal", reference, status: "pending" }).returning({ id: payments.id });
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "start_pesapal_payment", entityType: "payment", entityId: payment.id, after: { reference, amount: parsed.data.amount, currency: "UGX" } });
    return { paymentId: payment.id, reference, student };
  });
  if ("error" in created) return NextResponse.json({ error: created.error }, { status: created.status });

  try {
    const origin = new URL(request.url).origin;
    const order = await createPesapalOrder({
      reference: created.reference,
      amount: parsed.data.amount,
      origin,
      email: created.student.email,
      phone: created.student.phone,
      firstName: created.student.firstName || created.student.displayName || "DLA",
      lastName: created.student.lastName || "Student",
    });
    return NextResponse.json({ checkoutUrl: order.redirectUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await db.update(payments).set({ status: "rejected" }).where(and(eq(payments.id, created.paymentId), eq(payments.status, "pending")));
    const code = error instanceof Error ? error.message : "";
    console.error("Pesapal order creation failed", code);
    return NextResponse.json({ error: "Pesapal could not open checkout. No payment was taken. Try again or use the manual payment instructions." }, { status: 502 });
  }
}
