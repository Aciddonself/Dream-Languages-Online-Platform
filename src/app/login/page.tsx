"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const widget = useRef<HTMLDivElement>(null);

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
        const { res, data } = await post("/api/auth/login", { email, password, turnstileToken: captcha || undefined });
        if (!res.ok) return fail(data.error || "Sign in failed. Check your email and password.");
        if (data.mfa === "verify") return setStep({ kind: "verify", factorId: data.factorId });
        if (data.mfa === "enroll") {
          const enrol = await post("/api/auth/mfa", { action: "enroll" });
          if (!enrol.res.ok) return fail(enrol.data.error || "Could not start 2FA setup");
          return setStep({ kind: "enroll", factorId: enrol.data.factorId, qrCode: enrol.data.qrCode, secret: enrol.data.secret });
        }
        toast.success("Signed in successfully.");
        router.push(data.redirectTo || "/");
        router.refresh();
        return;
      }
      const { res, data } = await post("/api/auth/mfa", { action: "verify", factorId: step.factorId, code });
      if (!res.ok) return fail(data.error || "Invalid code");
      toast.success("Signed in successfully.");
      router.push(data.redirectTo || "/");
      router.refresh();
    } catch {
      fail("Unable to reach the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      {siteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />}
      <GlassCard className="w-full max-w-md p-8" strong>
        <h1 className="display-font text-2xl font-bold mb-1">{step.kind === "password" ? "Welcome back" : "Two-factor authentication"}</h1>
        <p className="text-sm opacity-70 mb-6">{step.kind === "password" ? "Sign in to DLA Learning Hub" : "Enter the 6-digit code from your authenticator app"}</p>
        <form onSubmit={submit} className="space-y-4">
          {step.kind === "password" ? (
            <>
              <GlassInput type="email" placeholder="DLA email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <GlassInput type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {siteKey && <div ref={widget} />}
            </>
          ) : (
            <>
              {step.kind === "enroll" && (
                <div className="space-y-2 text-sm">
                  <p>Scan this QR code with Google Authenticator, Microsoft Authenticator or similar, then enter the code.</p>
                  <Image src={step.qrCode} alt="2FA QR code" width={180} height={180} unoptimized className="bg-white p-2 rounded" />
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
          <p>Account credentials are issued by a DLA administrator.</p>
          <p className="mt-2"><Link href="/apply" className="text-[var(--brand-primary)]">Apply to study at DLA</Link></p>
          <p className="mt-2"><Link href="/admin/forgot-password" className="text-[var(--brand-primary)]">Administrator password recovery</Link></p>
        </div>
      </GlassCard>
    </main>
  );
}
