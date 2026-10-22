import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";

export default function RegisterPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <GlassCard className="w-full max-w-md p-8" strong>
        <h1 className="display-font text-2xl font-bold mb-2">Accounts are issued by DLA</h1>
        <p className="text-sm opacity-70">
          For security, staff and student accounts and passwords are provided by a school administrator.
          Submit an application if you are applying to study at DLA.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/apply" className="text-[var(--brand-primary)]">Apply to DLA</Link>
          <Link href="/login" className="text-[var(--brand-primary)]">Sign in</Link>
        </div>
      </GlassCard>
    </main>
  );
}
