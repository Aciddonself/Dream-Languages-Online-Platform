import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clearHistory, getConfig, getProfile, loadHistory, runFatherDla, setProfile, type Actor } from "@/lib/father-dla/service";
import { CEFR_LEVELS } from "@/lib/father-dla/safety";
import { activeProvider } from "@/lib/father-dla/provider";

export const dynamic = "force-dynamic";

async function currentActor(): Promise<Actor> {
  try {
    const user = await getCurrentUser();
    return user ? { id: user.id, role: user.role, firstName: user.firstName ?? null } : null;
  } catch {
    return null;
  }
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function GET() {
  const actor = await currentActor();
  const config = await getConfig();
  const configured = !!activeProvider();
  if (!actor) return json({ configured, signedIn: false, history: [], levels: CEFR_LEVELS });
  const [profile, history] = await Promise.all([getProfile(actor.id), loadHistory(actor.id, config.limits.historyMessages)]);
  return json({ configured, signedIn: true, role: actor.role, level: profile.cefrLevel, language: profile.targetLanguage, history, levels: CEFR_LEVELS });
}

const messageSchema = z.object({ message: z.string().trim().min(1) }).strict();

export async function POST(request: Request) {
  const actor = await currentActor();
  const config = await getConfig();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Please type a message." }, 400);
  if (parsed.data.message.length > config.limits.maxMessageChars) {
    return json({ error: `Messages can be at most ${config.limits.maxMessageChars} characters.` }, 413);
  }
  if (!activeProvider()) return json({ error: "Father-DLA is not configured yet. Ask the administrator to add the model key." }, 503);

  const key = actor?.id ?? clientIp(request);
  const hourly = await rateLimit(actor ? "fdla-hour" : "fdla-guest", key, actor ? config.limits.messagesPerHour : config.limits.guestMessagesPerHour, "1 h");
  if (!hourly.ok) return tooManyRequests(hourly.retryAfter);
  if (actor) {
    const daily = await rateLimit("fdla-day", key, config.limits.messagesPerDay, "24 h");
    if (!daily.ok) return tooManyRequests(daily.retryAfter);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runFatherDla(actor, parsed.data.message, request.signal)) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", error: "Father-DLA is having trouble right now." })}\n`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

export async function DELETE() {
  const actor = await currentActor();
  if (!actor) return json({ error: "Sign in required" }, 401);
  await clearHistory(actor.id);
  return json({ ok: true });
}

const profileSchema = z.object({ level: z.enum(CEFR_LEVELS), language: z.string().trim().max(40).nullable().optional() }).strict();

export async function PUT(request: Request) {
  const actor = await currentActor();
  if (!actor) return json({ error: "Sign in required" }, 401);
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Choose a valid level" }, 400);
  await setProfile(actor.id, parsed.data.level, parsed.data.language ?? null);
  return json({ ok: true });
}
