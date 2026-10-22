import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { getAuthSecret } from "@/lib/auth-config";
import { ensureStudentRegistrationNumber } from "@/lib/registration";

const COOKIE = "dla_session";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string, meta?: { ip?: string; userAgent?: string }) {
  const secret = getAuthSecret();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return token;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;

  let userId: string;
  const secret = getAuthSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== "string") return null;
    userId = payload.sub;
  } catch {
    return null;
  }

  const [session] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.token, token), eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!session) return null;

  let [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.deletedAt || !["active", "registered", "applicant"].includes(user.status)) return null;
  if (user.role === "student" && !user.registrationNumber) {
    const registrationNumber = await ensureStudentRegistrationNumber(user.id, user.registrationNumber);
    user = { ...user, registrationNumber };
  }
  return { token, user };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  cookieStore.delete(COOKIE);
}

export async function getCurrentUser() {
  const s = await getSession();
  return s?.user ?? null;
}