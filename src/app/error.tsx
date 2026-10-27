"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen grid place-items-center px-6 py-10">
      <GlassCard className="max-w-md p-8 text-center space-y-4">
        <h1 className="display-font text-2xl font-bold">Something went wrong</h1>
        <p className="text-sm opacity-75">Please try again. If the problem continues, contact DLA.</p>
        {process.env.NODE_ENV !== "production" && (
          <pre className="text-left text-xs whitespace-pre-wrap break-words opacity-80">{error.message}{error.digest ? `\ndigest: ${error.digest}` : ""}</pre>
        )}
        <div className="flex justify-center gap-3 text-sm font-semibold">
          <button type="button" className="underline" onClick={() => reset()}>Try again</button>
          <Link className="underline" href="/">Home</Link>
        </div>
      </GlassCard>
    </main>
  );
}
