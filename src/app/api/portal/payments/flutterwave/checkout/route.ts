import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, feeSchedules, payments, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ amount: z.number().int().positive().max(100_000_000) }).strict();

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Sign in to your student account before paying online" }, { status: 401 });
  if (actor.role !== "student") return NextResponse.json({ error: "Student account required" }, { status: 403 });
  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Online card and mobile money payments are not configured yet. Use the bank or mobile money instructions and submit your payment reference for Finance review." }, { status: 503 });
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
    const txRef = `dla_${randomUUID()}`;
    const [payment] = await tx.insert(payments).values({ studentId: actor.id, amount: parsed.data.amount, currency: "UGX", method: "flutterwave", reference: txRef, status: "pending" }).returning({ id: payments.id });
    await tx.insert(auditLogs).values({ actorId: actor.id, action: "start_flutterwave_payment", entityType: "payment", entityId: payment.id, after: { txRef, amount: parsed.data.amount, currency: "UGX" } });
    return { paymentId: payment.id, txRef, student };
  });
  if ("error" in created) return NextResponse.json({ error: created.error }, { status: created.status });

  const origin = new URL(request.url).origin;
  let response: Response;
  try {
    response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: created.txRef,
        amount: parsed.data.amount,
        currency: "UGX",
        redirect_url: `${origin}/api/portal/payments/flutterwave/callback`,
        payment_options: "card,mobilemoneyuganda",
        customer: {
          email: created.student.email,
          name: created.student.displayName || [created.student.firstName, created.student.lastName].filter(Boolean).join(" ") || "DLA Student",
          phonenumber: created.student.phone || undefined,
        },
        customizations: { title: "Dream Languages Uganda", description: "Student fee payment" },
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    await db.update(payments).set({ status: "rejected" }).where(and(eq(payments.id, created.paymentId), eq(payments.status, "pending")));
    return NextResponse.json({ error: "The online payment service could not be reached. No money was charged. Try again or use the manual payment instructions." }, { status: 502 });
  }
  let data: { status?: string; data?: { link?: string } } = {};
  try { data = await response.json(); } catch { /* handled below */ }
  const checkoutUrl = data.data?.link;
  if (!response.ok || data.status !== "success" || !checkoutUrl || !checkoutUrl.startsWith("https://checkout.flutterwave.com/")) {
    await db.update(payments).set({ status: "rejected" }).where(and(eq(payments.id, created.paymentId), eq(payments.status, "pending")));
    return NextResponse.json({ error: "Online checkout could not be created. Use the manual payment options or try again later." }, { status: 502 });
  }
  return NextResponse.json({ checkoutUrl }, { headers: { "Cache-Control": "no-store" } });
}
