import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, invoices, payments, receipts, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createTextPdf } from "@/lib/pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { paymentId } = await params;
  const [payment] = await db.select({
    id: payments.id,
    studentId: payments.studentId,
    amount: payments.amount,
    currency: payments.currency,
    method: payments.method,
    reference: payments.reference,
    status: payments.status,
    paidAt: payments.createdAt,
    studentName: users.displayName,
    firstName: users.firstName,
    lastName: users.lastName,
    registrationNumber: users.registrationNumber,
    invoiceNumber: invoices.number,
  }).from(payments)
    .leftJoin(users, eq(payments.studentId, users.id))
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!payment) return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
  if (actor.role === "student" && payment.studentId !== actor.id) {
    return NextResponse.json({ error: "You can only download your own receipts" }, { status: 403 });
  }
  if (!["student", "finance", "super_admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Finance portal access required" }, { status: 403 });
  }
  if (payment.status !== "verified" || !payment.studentId) {
    return NextResponse.json({ error: "A receipt is available after payment verification" }, { status: 409 });
  }

  let [receipt] = await db.select().from(receipts).where(eq(receipts.paymentId, payment.id)).limit(1);
  if (!receipt) {
    const receiptNumber = `DLA-RCPT-${payment.paidAt.getFullYear()}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const [created] = await db.insert(receipts).values({ paymentId: payment.id, number: receiptNumber }).onConflictDoNothing().returning();
    receipt = created ?? (await db.select().from(receipts).where(eq(receipts.paymentId, payment.id)).limit(1))[0];
    if (!receipt) return NextResponse.json({ error: "Receipt could not be issued" }, { status: 500 });
    if (created) {
      await db.insert(auditLogs).values({
        actorId: actor.id,
        action: "issue_payment_receipt",
        entityType: "payment",
        entityId: payment.id,
        after: { receiptNumber: receipt.number },
      });
    }
  }

  const name = payment.studentName ?? ([payment.firstName, payment.lastName].filter(Boolean).join(" ") || "Student");
  const pdf = createTextPdf("Dream Languages Uganda Payment Receipt", [
    "Official school payment receipt",
    "",
    `Receipt number: ${receipt.number}`,
    `Student: ${name}`,
    `Registration number: ${payment.registrationNumber ?? "Not assigned"}`,
    `Invoice: ${payment.invoiceNumber ?? "Not linked"}`,
    `Amount paid: ${payment.currency} ${payment.amount.toLocaleString()}`,
    `Payment method: ${payment.method}`,
    `Payment reference: ${payment.reference ?? "Not provided"}`,
    `Payment verified: ${payment.paidAt.toISOString().slice(0, 10)}`,
    `Receipt issued: ${receipt.issuedAt.toISOString().slice(0, 10)}`,
  ]);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receipt.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
