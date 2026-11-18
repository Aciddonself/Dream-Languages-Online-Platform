"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, GlassButton } from "@/components/ui/glass";

const STORAGE_KEY = "dla-cookie-consent";
const COOKIE_NAME = "dla_cookie_consent";
const CONSENT_EVENT = "dla:open-cookie-preferences";
const CONSENT_CHANGE_EVENT = "dla:cookie-preferences-changed";

export type CookiePreferences = { analytics: boolean; advertising: boolean };

function parseChoice(value?: string | null): CookiePreferences | null {
  if (value === "all") return { analytics: true, advertising: true };
  if (value === "accepted" || value === "analytics") return { analytics: true, advertising: false };
  if (value === "analytics") return { analytics: true, advertising: false };
  if (value === "advertising") return { analytics: false, advertising: true };
  if (value === "essential" || value === "rejected") return { analytics: false, advertising: false };
  return null;
}

function serializeChoice(preferences: CookiePreferences) {
  if (preferences.analytics && preferences.advertising) return "all";
  if (preferences.analytics) return "analytics";
  if (preferences.advertising) return "advertising";
  return "essential";
}

export function readCookiePreferences(): CookiePreferences | null {
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
  const fromCookie = parseChoice(cookieChoice);
  if (fromCookie) return fromCookie;

  try {
    return parseChoice(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function savePreferences(preferences: CookiePreferences) {
  const choice = serializeChoice(preferences);
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // The cookie remains the persistent preference when browser storage is blocked.
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  try {
    document.cookie = `${COOKIE_NAME}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch {
    // Browser storage remains the fallback when cookies are disabled.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: preferences }));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({ analytics: false, advertising: false });

  useEffect(() => {
    const saved = readCookiePreferences();
    if (saved) {
      setPreferences(saved);
      savePreferences(saved);
    } else {
      setVisible(true);
    }

    const openPreferences = () => {
      const current = readCookiePreferences();
      if (current) setPreferences(current);
      setVisible(true);
    };
    window.addEventListener(CONSENT_EVENT, openPreferences);
    return () => window.removeEventListener(CONSENT_EVENT, openPreferences);
  }, []);

  function save() {
    savePreferences(preferences);
    setVisible(false);
  }

  function rejectOptional() {
    const essentialOnly = { analytics: false, advertising: false };
    setPreferences(essentialOnly);
    savePreferences(essentialOnly);
    setVisible(false);
  }

  function acceptAll() {
    const allOptional = { analytics: true, advertising: true };
    setPreferences(allOptional);
    savePreferences(allOptional);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] md:left-auto md:right-4 md:max-w-md" role="dialog" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
      <GlassCard className="space-y-3 p-4">
        <div>
          <h2 id="cookie-consent-title" className="font-bold">Cookie preferences</h2>
          <p id="cookie-consent-description" className="text-sm">
            Essential cookies keep sign in and security working. Choose separately whether to allow Google Analytics and Google Ads tracking. The Google Tag Manager container loads only after you allow either optional category.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={preferences.analytics} onChange={(event) => setPreferences((current) => ({ ...current, analytics: event.target.checked }))} />
            <span>Google Analytics 4, to understand website usage</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={preferences.advertising} onChange={(event) => setPreferences((current) => ({ ...current, advertising: event.target.checked }))} />
            <span>Google Ads, to measure and improve advertising</span>
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <GlassButton variant="ghost" onClick={rejectOptional}>Reject optional</GlassButton>
          <GlassButton variant="ghost" onClick={save}>Save choices</GlassButton>
          <GlassButton variant="primary" onClick={acceptAll}>Accept all</GlassButton>
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
