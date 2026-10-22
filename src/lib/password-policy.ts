import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";

export const passwordSchema = z.string().min(10, "Use at least 10 characters").max(256);

/** Have I Been Pwned k-anonymity range check: only the first 5 SHA-1 hex chars leave the server. Fails open on network errors. */
export async function isBreachedPassword(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.split("\n").some((line) => {
      const [hash, count] = line.trim().split(":");
      return hash === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export async function validateNewPassword(password: string): Promise<string | null> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return parsed.error.issues[0].message;
  if (await isBreachedPassword(password)) return "This password appears in known data breaches. Choose a different one.";
  return null;
}
