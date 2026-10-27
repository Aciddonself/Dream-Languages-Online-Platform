import Link from "next/link";
import { AdminPasswordRecoveryForm } from "@/components/admin-password-recovery-form";
import { GlassCard } from "@/components/ui/glass";

export default async function AdminForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <GlassCard className="w-full max-w-md p-8" strong>
        <h1 className="display-font text-2xl font-bold mb-2">
          {token ? "Reset administrator password" : "Administrator password recovery"}
        </h1>
        <p className="text-sm opacity-70 mb-6">
          Recovery is available only for school administrator accounts. Links expire after 30 minutes and work once.
        </p>
        <AdminPasswordRecoveryForm token={token} />
        <p className="mt-5 text-sm"><Link href="/admin/login" className="text-[var(--brand-primary)]">Back to administrator sign in</Link></p>
      </GlassCard>
    </main>
  );
}
