"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassCard, GlassButton, GlassInput } from "@/components/ui/glass";
import { toast } from "sonner";
import Link from "next/link";
import Script from "next/script";
import Image from "next/image";

type Step =
  | { kind: "password" }
  | { kind: "verify"; factorId: string }
  | { kind: "enroll"; factorId: string; qrCode: string; secret: string };

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const roleOptions = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "head_academics", label: "Head of Academics" },
  { value: "finance", label: "Finance" },
  { value: "applicant", label: "Applicant" },
];

export function LoginForm({ mode = "public" }: { mode?: "public" | "admin" }) {
  return (
    <Suspense fallback={null}>
      <LoginPanel mode={mode} />
    </Suspense>
  );
}

function LoginPanel({ mode }: { mode: "public" | "admin" }) {
  const isAdmin = mode === "admin";
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInAs, setSignInAs] = useState("student");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const widget = useRef<HTMLDivElement>(null);
  const authNotConfigured = search.get("error") === "auth_not_configured";

  // Deep link only if it stays inside the role's own portal; otherwise use the server-chosen home.
  function destination(home?: string) {
    const next = search.get("next");
    const base = home || "/";
    if (next && next.startsWith(base) && base !== "/" && !next.startsWith("//") && !next.includes("\\")) return next;
    return base;
  }

  useEffect(() => {
    const w = window as unknown as { turnstile?: { render: (el: HTMLElement, o: object) => void } };
    const timer = setInterval(() => {
      if (siteKey && widget.current && w.turnstile && !widget.current.hasChildNodes()) {
        w.turnstile.render(widget.current, { sitekey: siteKey, callback: setCaptcha });
        clearInterval(timer);
      }
    }, 300);
    return () => clearInterval(timer);
  }, []);

  async function post(url: string, payload: object) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function fail(message: string) {
    setError(message);
    toast.error(message);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (step.kind === "password") {
        const { res, data } = await post("/api/auth/login", { email, password, turnstileToken: captcha || undefined, portal: mode, ...(isAdmin ? {} : { as: signInAs }) });
        if (!res.ok) return fail(data.error || "Sign in failed. Check your email and password.");
        if (data.mfa === "verify") return setStep({ kind: "verify", factorId: data.factorId });
        if (data.mfa === "enroll") {
          const enrol = await post("/api/auth/mfa", { action: "enroll" });
          if (!enrol.res.ok) return fail(enrol.data.error || "Could not start 2FA setup");
          return setStep({ kind: "enroll", factorId: enrol.data.factorId, qrCode: enrol.data.qrCode, secret: enrol.data.secret });
        }
        toast.success("Signed in successfully.");
        router.replace(destination(data.redirectTo));
        return;
      }
      const { res, data } = await post("/api/auth/mfa", { action: "verify", factorId: step.factorId, code });
      if (!res.ok) return fail(data.error || "Invalid code");
      toast.success("Signed in successfully.");
      router.replace(destination(data.redirectTo));
    } catch {
      fail("Unable to reach the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-8 md:px-8">
      {siteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />}
      <GlassCard className="login-split w-full max-w-5xl overflow-hidden" strong>
        <div className="login-split-form p-8 md:p-12">
        <h1 className="text-3xl mb-1">{step.kind !== "password" ? "Two-factor authentication" : isAdmin ? "Administrator sign in" : "Welcome back"}</h1>
        <p className="text-sm opacity-70 mb-6">{step.kind === "password" ? (isAdmin ? "Restricted access for DLA administrators" : "Sign in to DLA Learning Hub") : "Enter the 6-digit code from your authenticator app"}</p>
        {authNotConfigured && (
          <div role="alert" className="mb-4 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
            Authentication is not configured yet. Add Supabase URL and anon key in your local environment before signing in.
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          {step.kind === "password" ? (
            <>
              {!isAdmin && (
                <label className="block text-sm">
                  <span className="mb-1 block opacity-80">Sign in as</span>
                  <select className="glass px-4 py-2.5 w-full outline-none focus:ring-2 focus:ring-[var(--brand-accent)]" value={signInAs} onChange={(e) => setSignInAs(e.target.value)}>
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <GlassInput type="email" placeholder="DLA email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <GlassInput type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {siteKey && <div ref={widget} />}
            </>
          ) : (
            <>
              {step.kind === "enroll" && (
                <div className="space-y-2 text-sm">
                  <p>Scan this QR code with Google Authenticator, Microsoft Authenticator or similar, then enter the code.</p>
                  <Image src={step.qrCode.trimEnd()} alt="2FA QR code" width={180} height={180} unoptimized className="bg-white p-2 rounded" />
                  <p className="opacity-70 break-all">Manual key: {step.secret}</p>
                </div>
              )}
              <GlassInput inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="123456" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
            </>
          )}
          {error && <div role="alert" className="text-sm text-[var(--danger)]">{error}</div>}
          <GlassButton type="submit" className="w-full" loading={loading}>{loading ? "Please wait..." : step.kind === "password" ? "Sign In" : "Verify"}</GlassButton>
        </form>
        <div className="mt-4 text-sm opacity-70">
          {isAdmin ? (
            <p><Link href="/admin/forgot-password" className="text-[var(--brand-primary)]">Administrator password recovery</Link></p>
          ) : (
            <>
              <p>Account credentials are issued by a DLA administrator.</p>
              <p className="mt-2"><Link href="/apply" className="text-[var(--brand-primary)]">Apply to study at DLA</Link></p>
            </>
          )}
        </div>
        </div>
        <div className="login-split-image" aria-hidden={false}>
          <Image src="/site-media/teacher-joseph-mabadiliko.jpg" alt="Mr Joseph Mabadiliko, DLA teacher" fill priority sizes="(min-width: 768px) 480px, 0px" className="object-cover" />
          <div className="login-split-caption">
            <strong>Mr Joseph Mabadiliko</strong>
            <span>Dream Languages Uganda</span>
          </div>
        </div>
      </GlassCard>
    </main>
  );
}
