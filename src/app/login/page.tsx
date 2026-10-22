"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard, GlassButton, GlassInput } from "@/components/ui/glass";
import { toast } from "sonner";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || "Sign in failed. Check your email and password.";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("Signed in successfully.");
      router.push(data.redirectTo || "/");
      router.refresh();
    } catch (error) {
      const message = error instanceof TypeError
        ? "Unable to reach the sign-in service. Check your connection and try again."
        : "The sign-in service returned an unexpected response. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <GlassCard className="w-full max-w-md p-8" strong>
        <h1 className="display-font text-2xl font-bold mb-1">Welcome back</h1>
        <p className="text-sm opacity-70 mb-6">Sign in to DLA Learning Hub</p>
        <form onSubmit={submit} className="space-y-4">
          <GlassInput type="text" placeholder="Email or username" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <GlassInput type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="text-sm text-[var(--danger)]">{error}</div>}
          <GlassButton type="submit" className="w-full" loading={loading}>{loading ? "Signing in..." : "Sign In"}</GlassButton>
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