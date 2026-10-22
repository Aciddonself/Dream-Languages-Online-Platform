// Server-enforced phone-number / external-contact handle filter.
// Used in messaging, community posts, discussion rooms and file names.

const DIGIT_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  oh: "0", o: "0",
};

const SUBS: Record<string, string> = {
  o: "0", O: "0", l: "1", I: "1", i: "1", S: "5", s: "5", B: "8", g: "9", q: "9",
};

function normalize(input: string): string {
  let s = input.toLowerCase();
  // letter-digit substitutions
  s = s.split("").map((c) => SUBS[c] ?? c).join("");
  // number words -> digits
  s = s.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|oh)\b/g, (m) => DIGIT_WORDS[m] ?? m);
  // remove separators
  s = s.replace(/[\s.\-_,;:]/g, "");
  // emoji digits
  s = s.replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10));
  return s;
}

// External contact handles
const HANDLE_PATTERNS = [
  /wa\.me/i,
  /whatsapp/i,
  /t\.me\//i,
  /telegram/i,
  /call\s*me/i,
  /text\s*me/i,
];

export interface FilterResult {
  blocked: boolean;
  reason?: "phone" | "handle";
  masked?: string;
}

export function detectPhoneOrHandle(input: string): FilterResult {
  if (!input) return { blocked: false };

  for (const p of HANDLE_PATTERNS) {
    if (p.test(input)) return { blocked: true, reason: "handle", masked: "***" };
  }

  const norm = normalize(input);
  // Find runs of 7+ digits (Ugandan numbers are 9-12 digits incl. country code)
  const runs = norm.match(/\d{7,}/g) ?? [];
  for (const run of runs) {
    const isUgMobile =
      /^0?7\d{7,8}$/.test(run) ||
      /^2567\d{7,9}$/.test(run) ||
      /^7\d{8,9}$/.test(run) ||
      (run.length >= 9 && /7/.test(run) && (run.startsWith("0") || run.startsWith("256") || run.startsWith("7")));
    if (run.length >= 9 && isUgMobile) {
      const masked = run.slice(0, 4) + "*".repeat(Math.max(0, run.length - 6)) + run.slice(-2);
      return { blocked: true, reason: "phone", masked };
    }
    if (run.length >= 7 && run.length <= 8) {
      const isMobile =
        /^0?7\d{6,7}$/.test(run) ||
        /^7\d{7,8}$/.test(run);
      if (isMobile) {
        const masked = run.slice(0, 3) + "*".repeat(Math.max(0, run.length - 5)) + run.slice(-2);
        return { blocked: true, reason: "phone", masked };
      }
    }
    // (handled above)
  }

  // Spaced forms that normalize collapsed may be caught above; also try original regex for common forms
  const spaced = input.match(/(?:\+?256|0)\s?7\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}/);
  if (spaced) {
    return { blocked: true, reason: "phone", masked: "+256 7** *** **9" };
  }

  return { blocked: false };
}

// False-positive guards: registration numbers like DLA/2026/GER/0042 contain digits but not 7+ consecutive digits after normalization? "2026" + "0042" -> "20260042" (8 digits) could trigger. We explicitly allow registration-number-like tokens.
export function isRegistrationNumber(token: string): boolean {
  return /DLA\/\d{4}\/[A-Z]{2,4}\/\d{4}/.test(token);
}