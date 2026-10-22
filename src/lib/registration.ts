import { randomUUID } from "node:crypto";
import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export function createRegistrationNumber(date = new Date()) {
  const year = date.getFullYear();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return `DLA/${year}/REG/${suffix}`;
}

export async function ensureStudentRegistrationNumber(userId: string, currentNumber: string | null) {
  if (currentNumber) return currentNumber;

  const registrationNumber = createRegistrationNumber();
  const [updated] = await db
    .update(users)
    .set({ registrationNumber })
    .where(and(eq(users.id, userId), isNull(users.registrationNumber)))
    .returning({ registrationNumber: users.registrationNumber });
  if (updated?.registrationNumber) return updated.registrationNumber;

  const [existing] = await db.select({ registrationNumber: users.registrationNumber }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing?.registrationNumber) throw new Error("Could not assign a student registration number");
  return existing.registrationNumber;
}
