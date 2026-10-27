import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  enrolments,
  fatherDlaMessages,
  fatherDlaProfiles,
  fatherDlaUsage,
  incidents,
  settings,
} from "@/db/schema";
import baseConfig from "../../../config/father-dla.json";
import { streamGemini, type ModelMessage } from "./gemini";
import { streamGroq } from "./groq";
import { activeProvider } from "./provider";
import {
  CANNED,
  chooseModel,
  estimateCostMicroUsd,
  isCefr,
  normalizeQuestion,
  sanitizeUntrusted,
  screenInput,
  screenOutput,
} from "./safety";

export type FatherDlaConfig = typeof baseConfig;
export type Source = { title: string; url: string };
export type ClientEvent =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "source"; title: string; url: string }
  | { type: "replace"; text: string }
  | { type: "done"; messageId: string | null; model?: string }
  | { type: "error"; error: string };

export type Actor = { id: string; role: string; firstName: string | null } | null;

const STAFF_ROLES = ["teacher", "head_academics", "super_admin", "finance"];
const LOOKAHEAD = 24;
const CONFIG_KEY = "father_dla_config";

export async function getConfig(): Promise<FatherDlaConfig> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, CONFIG_KEY)).limit(1);
    const override = (row?.value ?? {}) as Partial<FatherDlaConfig>;
    return {
      ...baseConfig,
      ...override,
      models: { ...baseConfig.models, ...override.models },
      limits: { ...baseConfig.limits, ...override.limits },
    } as FatherDlaConfig;
  } catch {
    return baseConfig;
  }
}

export async function saveConfigOverride(patch: Partial<Pick<FatherDlaConfig, "systemPrompt" | "staffPrompt">> & { limits?: Partial<FatherDlaConfig["limits"]> }) {
  const current = (await db.select().from(settings).where(eq(settings.key, CONFIG_KEY)).limit(1))[0]?.value as Record<string, unknown> | undefined;
  const next = { ...(current ?? {}), ...patch, limits: { ...((current?.limits as object) ?? {}), ...Object.fromEntries(Object.entries(patch.limits ?? {}).filter(([, v]) => v !== undefined)) } };
  await db.insert(settings).values({ key: CONFIG_KEY, value: next }).onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function monthlySpendUsd() {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${fatherDlaUsage.costMicroUsd}), 0)` })
    .from(fatherDlaUsage)
    .where(gte(fatherDlaUsage.createdAt, monthStart()));
  return Number(row?.total ?? 0) / 1_000_000;
}

async function reportIncident(type: string, actorId: string | null, location: string, masked: string) {
  try {
    await db.insert(incidents).values({ type, actorId, location, maskedContent: masked });
  } catch (error) {
    console.error("Father-DLA incident could not be recorded", error instanceof Error ? error.message : error);
  }
}

async function budgetAlert(spend: number, config: FatherDlaConfig) {
  const cap = config.limits.monthlyBudgetUsd;
  if (spend < cap * config.limits.budgetAlertRatio) return;
  const [existing] = await db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.type, "ai_budget"), gte(incidents.createdAt, monthStart())))
    .limit(1);
  if (!existing) {
    await reportIncident("ai_budget", null, "father-dla", `Father-DLA spend is $${spend.toFixed(2)} of the $${cap} monthly cap`);
  }
}

// Short-lived cache of answers to common standalone questions that needed a web search.
const answerCache = new Map<string, { at: number; text: string; sources: Source[] }>();
const CACHE_TTL_MS = 10 * 60_000;

async function save(userId: string, role: "user" | "assistant", content: string, extra: Partial<typeof fatherDlaMessages.$inferInsert> = {}) {
  const [row] = await db.insert(fatherDlaMessages).values({ userId, role, content, ...extra }).returning({ id: fatherDlaMessages.id });
  return row?.id ?? null;
}

export async function loadHistory(userId: string, limit: number) {
  const rows = await db
    .select({ id: fatherDlaMessages.id, role: fatherDlaMessages.role, content: fatherDlaMessages.content, sources: fatherDlaMessages.sources })
    .from(fatherDlaMessages)
    .where(eq(fatherDlaMessages.userId, userId))
    .orderBy(desc(fatherDlaMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function clearHistory(userId: string) {
  await db.delete(fatherDlaMessages).where(eq(fatherDlaMessages.userId, userId));
}

export async function getProfile(userId: string) {
  const [profile] = await db.select().from(fatherDlaProfiles).where(eq(fatherDlaProfiles.userId, userId)).limit(1);
  return profile ?? { userId, cefrLevel: "A1", targetLanguage: null as string | null };
}

export async function setProfile(userId: string, cefrLevel: string, targetLanguage: string | null) {
  if (!isCefr(cefrLevel)) throw new Error("Invalid CEFR level");
  const language = targetLanguage ? sanitizeUntrusted(targetLanguage).slice(0, 40) : null;
  await db
    .insert(fatherDlaProfiles)
    .values({ userId, cefrLevel, targetLanguage: language })
    .onConflictDoUpdate({ target: fatherDlaProfiles.userId, set: { cefrLevel, targetLanguage: language, updatedAt: new Date() } });
}

async function buildContext(actor: Actor, level: string, language: string | null) {
  if (!actor) return "CONTEXT: anonymous website visitor. No personal data is available.";
  const lines = [`CONTEXT (trusted, from the school system; the only personal data you may use):`, `- Name: ${actor.firstName ?? "Learner"}`, `- Role: ${actor.role}`];
  if (!STAFF_ROLES.includes(actor.role)) {
    lines.push(`- CEFR level: ${level}`);
    if (language) lines.push(`- Learning: ${language}`);
    const [cls] = await db
      .select({ name: classes.name })
      .from(enrolments)
      .innerJoin(classes, eq(enrolments.classId, classes.id))
      .where(eq(enrolments.studentId, actor.id))
      .limit(1);
    if (cls) lines.push(`- Current class: ${cls.name}`);
  }
  return lines.join("\n");
}

export async function* runFatherDla(actor: Actor, rawMessage: string, signal?: AbortSignal): AsyncGenerator<ClientEvent> {
  const config = await getConfig();
  const message = sanitizeUntrusted(rawMessage).slice(0, config.limits.maxMessageChars);
  if (!message) {
    yield { type: "error", error: "Please type a message." };
    return;
  }
  const staff = !!actor && STAFF_ROLES.includes(actor.role);
  const systemPrompt = staff ? config.staffPrompt : config.systemPrompt;

  const screen = screenInput(message);
  if (screen.action !== "allow" || screen.category === "distress") {
    const reply = screen.action === "allow" ? CANNED.distress : screen.reply;
    const category = screen.category;
    let messageId: string | null = null;
    if (actor) {
      if (screen.action === "block") {
        await reportIncident("phone_share", actor.id, "father-dla", "Contact detail blocked in Father-DLA message");
      } else {
        await save(actor.id, "user", category === "distress" ? "[message withheld: safety flag]" : message, { flagged: true, flagReason: category });
      }
      messageId = await save(actor.id, "assistant", reply, { flagged: true, flagReason: category, model: "safety-filter" });
    }
    await db.insert(fatherDlaUsage).values({ userId: actor?.id ?? null, role: actor?.role ?? "guest", model: "safety-filter" }).catch(() => undefined);
    yield { type: "replace", text: reply };
    yield { type: "done", messageId, model: "safety-filter" };
    return;
  }

  const spend = await monthlySpendUsd();
  if (spend >= config.limits.monthlyBudgetUsd) {
    yield { type: "error", error: "Father-DLA has reached its monthly usage limit. Please try again next month or ask your teacher." };
    return;
  }
  await budgetAlert(spend, config);

  const profile = actor ? await getProfile(actor.id) : null;
  const history = actor ? await loadHistory(actor.id, config.limits.historyMessages) : [];
  const context = await buildContext(actor, profile?.cefrLevel ?? "A1", profile?.targetLanguage ?? null);
  const modelKey = chooseModel(message, { staff });
  const provider = activeProvider();
  if (!provider) {
    yield { type: "error", error: "Father-DLA is not configured yet. Ask the administrator to add the model key." };
    return;
  }
  const model = (provider === "groq" ? config.groqModels : config.models)[modelKey];
  const cacheKey = `${staff ? "s" : "l"}:${profile?.cefrLevel ?? "-"}:${normalizeQuestion(message)}`;

  if (actor) await save(actor.id, "user", message);

  const cached = history.length === 0 ? answerCache.get(cacheKey) : undefined;
  let full = "";
  const sources: Source[] = [];
  let usage = { inputTokens: 0, outputTokens: 0, searches: 0 };

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    full = cached.text;
    sources.push(...cached.sources);
    yield { type: "delta", text: full };
    for (const s of sources) yield { type: "source", ...s };
  } else {
    const messages: ModelMessage[] = [
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message },
    ];
    let emitted = 0;
    try {
      const stream = provider === "groq"
        ? streamGroq({ model, system: `${systemPrompt}\n\n${context}`, messages, maxTokens: config.limits.maxReplyTokens, signal })
        : streamGemini({
          model,
          system: `${systemPrompt}\n\n${context}`,
          messages,
          maxTokens: config.limits.maxReplyTokens,
          maxSearches: config.limits.maxSearchesPerAnswer,
          allowSearch: !!actor,
          signal,
        });
      for await (const event of stream) {
        if (event.type === "searching") yield { type: "status", text: event.query ? `Searching the web: ${event.query}` : "Searching the web..." };
        else if (event.type === "source") {
          if (/^https?:\/\//i.test(event.url) && sources.length < 6) {
            sources.push({ title: event.title, url: event.url });
            yield { type: "source", title: event.title, url: event.url };
          }
        } else if (event.type === "usage") usage = event;
        else if (event.type === "text") {
          full += event.text;
          const verdict = screenOutput(full, systemPrompt);
          if (!verdict.ok) {
            const replacement = verdict.reason === "phone" ? CANNED.phone : CANNED.injection;
            if (actor) {
              if (verdict.reason === "phone") await reportIncident("phone_share", actor.id, "father-dla-reply", "Contact detail blocked in Father-DLA reply");
              const id = await save(actor.id, "assistant", replacement, { flagged: true, flagReason: `output_${verdict.reason}`, model });
              yield { type: "replace", text: replacement };
              yield { type: "done", messageId: id, model };
            } else {
              yield { type: "replace", text: replacement };
              yield { type: "done", messageId: null, model };
            }
            return;
          }
          const safeEnd = full.length - LOOKAHEAD;
          if (safeEnd > emitted) {
            yield { type: "delta", text: full.slice(emitted, safeEnd) };
            emitted = safeEnd;
          }
        }
      }
    } catch (error) {
      console.error("Father-DLA model error", error instanceof Error ? error.message : error);
      yield { type: "error", error: "Father-DLA is having trouble right now. Please try again in a moment." };
      return;
    }
    if (emitted < full.length) yield { type: "delta", text: full.slice(emitted) };
    if (usage.searches > 0 && history.length === 0 && full) answerCache.set(cacheKey, { at: Date.now(), text: full, sources: [...sources] });
  }

  const messageId = actor ? await save(actor.id, "assistant", full, { sources: sources.length ? sources : null, model }) : null;
  const pricing = (config.pricingUsdPerMillionTokens as Record<string, { input: number; output: number }>)[model] ?? { input: 3, output: 15 };
  await db
    .insert(fatherDlaUsage)
    .values({
      userId: actor?.id ?? null,
      role: actor?.role ?? "guest",
      model: cached ? `${model} (cached)` : model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      searches: usage.searches,
      costMicroUsd: estimateCostMicroUsd(pricing, usage.inputTokens, usage.outputTokens, usage.searches, config.searchCostUsd),
      question: message.slice(0, 200),
    })
    .catch((error) => console.error("Father-DLA usage log failed", error instanceof Error ? error.message : error));
  yield { type: "done", messageId, model };
}
