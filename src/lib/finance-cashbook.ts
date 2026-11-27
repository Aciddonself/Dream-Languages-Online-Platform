import { financeCashEntries } from "@/db/schema";

function schoolDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function mondayOf(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export async function recordFeeIncome(tx: any, input: {
  paymentId: string;
  actorId: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  date?: Date;
}) {
  const entryDate = schoolDate(input.date ?? new Date());
  const entry = await tx.insert(financeCashEntries).values({
    direction: "income",
    entryDate,
    weekStart: mondayOf(entryDate),
    amount: input.amount,
    currency: input.currency,
    category: "Student fees",
    purpose: `Fee payment received by ${input.method.replaceAll("_", " ")}`,
    reference: input.reference || `PAYMENT:${input.paymentId}`,
    recordedBy: input.actorId,
  }).returning({ id: financeCashEntries.id });
  return entry[0]?.id as string | undefined;
}
