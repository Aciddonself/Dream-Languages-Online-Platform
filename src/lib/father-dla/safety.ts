// Pure helpers for Father-DLA: safety filters, model routing, cost maths. No I/O so they can be unit-tested.
import { detectPhoneOrHandle } from "@/lib/phone-filter";

export type Category = "ok" | "phone" | "injection" | "private_data" | "meet_link" | "cheating" | "distress";

export type Screening =
  | { action: "allow"; category: "ok" | "distress" }
  | { action: "deflect"; category: "injection" | "private_data" | "meet_link" | "cheating"; reply: string }
  | { action: "block"; category: "phone"; reply: string };

const INJECTION = [
  /ignore (all |any |the |your )?(previous|prior|above|earlier)? ?(instructions|rules|prompt)/i,
  /disregard (all |any |the |your )?(previous|prior|above)? ?(instructions|rules)/i,
  /(reveal|show|print|repeat|tell me|display|leak|output|translate|summari[sz]e) (me )?(your|the) (system |initial |hidden |secret )?(prompt|instructions|configuration|rules)/i,
  /what (are|is|were) your (system |initial |hidden )?(prompt|instructions)/i,
  /\b(developer|dan|god|jailbreak|unrestricted) mode\b/i,
  /\byou are now\b.{0,40}\b(unfiltered|unrestricted|free|no rules)/i,
  /pretend (you have|there are) no (rules|restrictions|filters)/i,
  /(api|secret|service)[ _-]?key|GEMINI_API_KEY|GROQ_API_KEY|SUPABASE_SERVICE|env(ironment)? variables?/i,
  /<\s*\/?\s*(system|assistant)\s*>/i,
];

const MEET_LINK = [
  /(meet|zoom|teams)\.(google\.com|us)/i,
  /(google )?meet (link|url|code)|link (to|for) (the |my )?(live|online) class|live class link/i,
];

const PRIVATE_DATA = [
  /(another|other|someone else'?s?|his|her|their) (student'?s?|classmate'?s?|teacher'?s?) (grades?|results?|marks?|fees?|balance|password|email|address|records?)/i,
  /(grades?|results?|marks?|fee balance|fees|password|home address|email|records?) (of|for) (another|other|someone else|a classmate|my classmate|student|teacher|mr|mrs|ms)\b/i,
  /list (all )?(the )?(students|users|teachers)/i,
  /\b(admin|teacher|finance) password\b/i,
];

const CHEATING = [
  /(give|tell|send|show) me (all )?(the )?(answers?|solutions?) (to|for|of) (the |my |this |today'?s )?(exam|test|quiz)/i,
  /(i am|i'm|im) (currently )?(taking|writing|doing|in) (my |an |the )?(exam|test|quiz)( right now| now)?/i,
  /(leak|steal|get) (the )?(exam|test) (paper|questions|answers)/i,
  /help me cheat/i,
  /answers? (key|sheet) for (the |my )?(exam|test)/i,
];

const DISTRESS = [
  /\b(kill|hurt|harm) (myself|me)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bwant to die\b|\bend my life\b|\bno reason to live\b/i,
  /\bself[- ]?harm\b/i,
  /\b(being )?(abused|raped|assaulted)\b/i,
  /\b(someone|he|she) (is )?(hurting|beating|touching) me\b/i,
];

export const CANNED = {
  injection: "I can't share my instructions or settings, but I'm happy to keep helping with your language learning. What would you like to practise?",
  meet_link: "I can't give out class links. Open your student portal and press the Join button on your Active class card when your teacher starts the session.",
  private_data: "I can only talk about your own learning. For grades, fees or other people's information, please use your student portal or visit the DLA office.",
  cheating: "I can't help with answers during a test or exam, but I'd love to help you study. Tell me the topic and we can practise together before your next assessment.",
  phone: "For everyone's safety, phone numbers and outside contact details can't be shared here. Please keep chatting inside your DLA account. The school has been notified.",
  distress: "I'm really sorry you're going through this. You don't have to face it alone. Please talk to a trusted adult, a teacher, or the DLA office today. If you are in danger, call your local emergency number right away (in Uganda: 999 or 112).",
} as const;

export function screenInput(text: string): Screening {
  const phone = detectPhoneOrHandle(text);
  if (phone.blocked) return { action: "block", category: "phone", reply: CANNED.phone };
  if (INJECTION.some((p) => p.test(text))) return { action: "deflect", category: "injection", reply: CANNED.injection };
  if (MEET_LINK.some((p) => p.test(text))) return { action: "deflect", category: "meet_link", reply: CANNED.meet_link };
  if (PRIVATE_DATA.some((p) => p.test(text))) return { action: "deflect", category: "private_data", reply: CANNED.private_data };
  if (CHEATING.some((p) => p.test(text))) return { action: "deflect", category: "cheating", reply: CANNED.cheating };
  if (DISTRESS.some((p) => p.test(text))) return { action: "allow", category: "distress" };
  return { action: "allow", category: "ok" };
}

/** Removes markup and invisible characters from text we do not trust before it reaches the model. */
export function sanitizeUntrusted(text: string) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]{1,200}>/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}

export type OutputVerdict = { ok: true } | { ok: false; reason: "phone" | "leak" };

export function screenOutput(text: string, systemPrompt: string): OutputVerdict {
  if (detectPhoneOrHandle(text).blocked) return { ok: false, reason: "phone" };
  if (/sk-ant-[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|service_role/i.test(text)) return { ok: false, reason: "leak" };
  const probe = systemPrompt.slice(0, 80);
  if (probe.length > 40 && text.includes(probe)) return { ok: false, reason: "leak" };
  if (/(meet\.google\.com|zoom\.us)\/\S+/i.test(text)) return { ok: false, reason: "leak" };
  return { ok: true };
}

const HARD = /\b(essay|compare|contrast|analy[sz]e|lesson plan|exam|test questions?|rubric|why (is|does|do)|difference between|paragraph|proofread|subjunctive|conjugat|explain in detail|step by step)\b/i;

export function chooseModel(text: string, opts: { staff: boolean }): "fast" | "strong" {
  if (opts.staff && /\b(lesson plan|exam|test|rubric|quiz|marking)\b/i.test(text)) return "strong";
  if (text.length > 350 || HARD.test(text)) return "strong";
  return "fast";
}

export function estimateCostMicroUsd(
  pricing: { input: number; output: number },
  inputTokens: number,
  outputTokens: number,
  searches: number,
  searchCostUsd: number,
) {
  const usd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000 + searches * searchCostUsd;
  return Math.round(usd * 1_000_000);
}

export function normalizeQuestion(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export function isCefr(value: unknown): value is (typeof CEFR_LEVELS)[number] {
  return typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value);
}
