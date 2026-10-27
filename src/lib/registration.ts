import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

type Executor = Pick<typeof db, "execute" | "update" | "select">;

/**
 * Next sequential registration number for the year: DLA/2026/REG/0001, 0002, ...
 * Must run inside a transaction: the advisory lock serialises allocation until the caller commits,
 * so two concurrent sign-ups can never receive the same number.
 */
export async function nextRegistrationNumber(tx: Executor, date = new Date()) {
  const year = date.getFullYear();
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('dla-registration-number'))`);
  const prefix = `DLA/${year}/REG/`;
  const result = await tx.execute(sql`
    select coalesce(max(cast(substring(registration_number from '[0-9]+$') as integer)), 0) + 1 as next
    from users
    where registration_number ~ ${`^DLA/${year}/REG/[0-9]+$`}
  `);
  const next = Number((result as { rows?: { next: number | string }[] }).rows?.[0]?.next ?? 1);
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function ensureStudentRegistrationNumber(userId: string, currentNumber: string | null) {
  if (currentNumber) return currentNumber;

  return db.transaction(async (tx: Executor) => {
    const registrationNumber = await nextRegistrationNumber(tx);
    const [updated] = await tx
      .update(users)
      .set({ registrationNumber })
      .where(and(eq(users.id, userId), isNull(users.registrationNumber)))
      .returning({ registrationNumber: users.registrationNumber });
    if (updated?.registrationNumber) return updated.registrationNumber;

    const [existing] = await tx.select({ registrationNumber: users.registrationNumber }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existing?.registrationNumber) throw new Error("Could not assign a student registration number");
    return existing.registrationNumber;
  });
}
