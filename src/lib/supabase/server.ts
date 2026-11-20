import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/** Cookie-bound client acting as the signed-in user (RLS applies). */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(items) {
        try {
          for (const { name, value, options } of items) {
            cookieStore.set(name, value, { ...options, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
          }
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Route handlers attach Supabase session updates directly to their JSON response. */
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  const pending = new Map<string, { value: string; options: CookieOptions }>();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(items) {
        for (const { name, value, options } of items) pending.set(name, { value, options });
      },
    },
  });
  return {
    supabase,
    applyAuthCookies<T extends NextResponse>(response: T): T {
      for (const [name, cookie] of pending) {
        response.cookies.set(name, cookie.value, {
          ...cookie.options,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: cookie.options.path ?? "/",
        });
      }
      return response;
    },
  };
}

/** Service-role client. Bypasses RLS: server-only, use for admin user management and trusted jobs. */
export function createSupabaseAdminClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
