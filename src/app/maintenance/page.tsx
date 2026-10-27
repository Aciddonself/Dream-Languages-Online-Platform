import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";

export const metadata = { title: "Maintenance" };

export default function MaintenancePage() {
  return (
    <main className="min-h-screen grid place-items-center px-6 py-10">
      <GlassCard className="max-w-md p-8 text-center space-y-4">
        <h1 className="display-font text-2xl font-bold">We&apos;ll be right back</h1>
        <p className="text-sm opacity-75">DLA Learning Hub is undergoing scheduled maintenance. Please check back shortly.</p>
        <Link className="underline text-sm font-semibold" href="/">Try the home page</Link>
      </GlassCard>
    </main>
  );
}
