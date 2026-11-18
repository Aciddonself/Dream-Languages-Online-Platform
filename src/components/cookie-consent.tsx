"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, GlassButton } from "@/components/ui/glass";

const STORAGE_KEY = "dla-cookie-consent";
const COOKIE_NAME = "dla_cookie_consent";
const CONSENT_EVENT = "dla:open-cookie-preferences";
type ConsentChoice = "accepted" | "rejected";

function readChoice(): ConsentChoice | null {
  let cookieChoice: string | undefined;
  try {
    cookieChoice = document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1);
  } catch {
    // Fall back to browser storage when cookies are disabled.
  }
  if (cookieChoice === "accepted" || cookieChoice === "rejected") return cookieChoice;

  try {
    const storedChoice = localStorage.getItem(STORAGE_KEY);
    return storedChoice === "accepted" || storedChoice === "rejected" ? storedChoice : null;
  } catch {
    return null;
  }
}

function saveChoice(choice: ConsentChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // The consent banner still works for the current page when browser storage is blocked.
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  try {
    document.cookie = `${COOKIE_NAME}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch {
    // Browser storage remains the fallback when cookies are disabled.
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const choice = readChoice();
    if (choice) {
      saveChoice(choice);
    } else {
      setVisible(true);
    }

    const openPreferences = () => setVisible(true);
    window.addEventListener(CONSENT_EVENT, openPreferences);
    return () => window.removeEventListener(CONSENT_EVENT, openPreferences);
  }, []);

  function choose(choice: ConsentChoice) {
    saveChoice(choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] md:left-auto md:right-4 md:max-w-md" role="dialog" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
      <GlassCard className="space-y-3 p-4">
        <div>
          <h2 id="cookie-consent-title" className="font-bold">Cookie preferences</h2>
          <p id="cookie-consent-description" className="text-sm">
            Essential cookies keep sign in and security working. Optional analytics and advertising cookies are currently disabled on this site.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <GlassButton variant="ghost" onClick={() => choose("rejected")}>Reject optional</GlassButton>
          <GlassButton variant="primary" onClick={() => choose("accepted")}>Accept optional</GlassButton>
        </div>
        <p className="text-xs opacity-60">
          <Link href="/cookie-policy" className="underline">Cookie Policy</Link>
        </p>
      </GlassCard>
    </div>
  );
}

export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="cookie-settings-button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_EVENT))}
    >
      Cookie settings
    </button>
  );
}
