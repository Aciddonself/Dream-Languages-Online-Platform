import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Window = `${number} ${"s" | "m" | "h"}`;
const limiters = new Map<string, Ratelimit>();
const memory = new Map<string, { count: number; resetAt: number }>();

function windowMs(window: Window) {
  const [n, unit] = window.split(" ");
  return Number(n) * (unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000);
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/**
 * Upstash-backed when UPSTASH_* is configured; otherwise a per-process in-memory fallback
 * (not shared across serverless instances, so configure Upstash in production).
 */
export async function rateLimit(bucket: string, key: string, limit: number, window: Window) {
  const id = `${bucket}:${key}`;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    let limiter = limiters.get(`${bucket}:${limit}:${window}`);
    if (!limiter) {
      limiter = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(limit, window), prefix: `dla:${bucket}` });
      limiters.set(`${bucket}:${limit}:${window}`, limiter);
    }
    const result = await limiter.limit(key);
    return { ok: result.success, retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)) };
  }
  const now = Date.now();
  const entry = memory.get(id);
  if (!entry || entry.resetAt <= now) {
    memory.set(id, { count: 1, resetAt: now + windowMs(window) });
    return { ok: true, retryAfter: 0 };
  }
  entry.count += 1;
  return { ok: entry.count <= limit, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
}

export function tooManyRequests(retryAfter: number) {
  return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  });
}
