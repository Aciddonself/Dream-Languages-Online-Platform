"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, GlassButton } from "@/components/ui/glass";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("dla-cookie-consent");
    if (consent) return;
    let active = true;
    queueMicrotask(() => { if (active) setVisible(true); });
    return () => { active = false; };
  }, []);

  function accept() {
    localStorage.setItem("dla-cookie-consent", "accepted");
    setVisible(false);
  }

  function reject() {
    localStorage.setItem("dla-cookie-consent", "rejected");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] md:left-auto md:right-4 md:max-w-md">
      <GlassCard className="p-4 space-y-3">
        <p className="text-sm">
          We use cookies to improve your experience. Essential cookies are required; analytics cookies are optional.
        </p>
        <div className="flex gap-2 justify-end">
          <GlassButton variant="ghost" onClick={reject}>Reject</GlassButton>
          <GlassButton variant="primary" onClick={accept}>Accept</GlassButton>
        </div>
        <p className="text-xs opacity-60">
          <Link href="/cookie-policy" className="underline">Cookie Policy</Link>
        </p>
      </GlassCard>
    </div>
  );
}
