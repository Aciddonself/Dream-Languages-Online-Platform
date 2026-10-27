import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-6 py-10">
      <GlassCard className="max-w-md p-8 text-center space-y-4">
        <p className="text-5xl font-bold">404</p>
        <h1 className="display-font text-2xl font-bold">Page not found</h1>
        <p className="text-sm opacity-75">The page you are looking for does not exist or has moved.</p>
        <div className="flex justify-center gap-3 text-sm font-semibold">
          <Link className="underline" href="/">Home</Link>
          <Link className="underline" href="/courses">Courses</Link>
          <Link className="underline" href="/login">Sign in</Link>
        </div>
      </GlassCard>
    </main>
  );
}
