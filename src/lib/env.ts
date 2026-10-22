import { z } from "zod";

// PUBLIC values are safe for the browser bundle. Everything in serverSchema must never be imported client-side.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = z.object({
  DATABASE_URL: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(32).optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_SENDER_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),
  MEET_LINK_ENCRYPTION_KEY: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema> & PublicEnv;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.merge(publicSchema).safeParse(process.env);
  if (!parsed.success) {
    // Only variable names are reported, never values.
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  if (process.env.NODE_ENV === "production" && !parsed.data.APP_URL.startsWith("https://")) {
    throw new Error("APP_URL must use HTTPS in production");
  }
  cached = parsed.data;
  return cached;
}

export function publicEnv(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
