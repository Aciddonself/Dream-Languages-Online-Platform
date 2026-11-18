"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { readCookiePreferences, type CookiePreferences } from "@/components/cookie-consent";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() ?? "";
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ?? "";
const CONSENT_CHANGE_EVENT = "dla:cookie-preferences-changed";
const DENIED = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;
const configuredIds = new Set<string>();
const lastTrackedPath = new Map<string, string>();

function isValidPreferences(value: unknown): value is CookiePreferences {
  return typeof value === "object" && value !== null
    && typeof (value as CookiePreferences).analytics === "boolean"
    && typeof (value as CookiePreferences).advertising === "boolean";
}

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

function ensureGoogleTag(firstId: string) {
  window.dataLayer ??= [];
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag("consent", "default", DENIED);
    window.gtag("js", new Date());
  }

  if (!document.querySelector('script[data-dla-google-tag="true"]')) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.dlaGoogleTag = "true";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(firstId)}`;
    document.head.appendChild(script);
  }
}

function clearCookies(prefixes: string[]) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=", 1)[0])
    .filter((name) => prefixes.some((prefix) => name === prefix || name.startsWith(`${prefix}_`)));
  const rootDomain = window.location.hostname.split(".").slice(-2).join(".");

  for (const name of names) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    if (rootDomain.includes(".")) {
      document.cookie = `${name}=; Path=/; Domain=.${rootDomain}; Max-Age=0; SameSite=Lax${secure}`;
    }
  }
}

function isPrivatePath(pathname: string) {
  return ["/admin", "/hoc", "/teacher", "/finance", "/student", "/applicant", "/login"]
    .some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function GoogleTracking() {
  const pathname = usePathname();
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    const saved = readCookiePreferences();
    if (saved) setPreferences(saved);

    const onPreferenceChange = (event: Event) => {
      const next = (event as CustomEvent<CookiePreferences>).detail;
      if (isValidPreferences(next)) setPreferences(next);
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, onPreferenceChange);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onPreferenceChange);
  }, []);

  useEffect(() => {
    if (!preferences) return;

    const useAnalytics = preferences.analytics && /^G-[A-Z0-9]+$/.test(GA4_ID);
    const useAds = preferences.advertising && /^AW-\d+$/.test(GOOGLE_ADS_ID);
    const enabledIds = [useAnalytics ? GA4_ID : "", useAds ? GOOGLE_ADS_ID : ""].filter(Boolean);

    if (GA4_ID) window[`ga-disable-${GA4_ID}`] = !useAnalytics;
    if (!useAnalytics) {
      clearCookies(["_ga", "_gid"]);
      if (GA4_ID) lastTrackedPath.delete(GA4_ID);
    }
    if (!useAds) {
      clearCookies(["_gcl", "_gac"]);
      if (GOOGLE_ADS_ID) lastTrackedPath.delete(GOOGLE_ADS_ID);
    }

    if (enabledIds.length === 0) {
      window.gtag?.("consent", "update", DENIED);
      return;
    }

    ensureGoogleTag(enabledIds[0]);
    window.gtag?.("consent", "update", {
      analytics_storage: useAnalytics ? "granted" : "denied",
      ad_storage: useAds ? "granted" : "denied",
      ad_user_data: useAds ? "granted" : "denied",
      ad_personalization: useAds ? "granted" : "denied",
    });

    for (const id of enabledIds) {
      if (configuredIds.has(id)) continue;
      window.gtag?.("config", id, { send_page_view: false });
      configuredIds.add(id);
    }

    if (!isPrivatePath(pathname)) {
      const freshDestinations = enabledIds.filter((id) => lastTrackedPath.get(id) !== pathname);
      if (freshDestinations.length > 0) {
        window.gtag?.("event", "page_view", {
          page_title: document.title,
          page_location: `${window.location.origin}${pathname}`,
          page_path: pathname,
          send_to: freshDestinations,
        });
        for (const id of freshDestinations) lastTrackedPath.set(id, pathname);
      }
    }
  }, [pathname, preferences]);

  return null;
}