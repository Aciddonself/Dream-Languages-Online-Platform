"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { PublicNav } from "@/components/public-nav";
import { SiteFooter } from "@/components/site-footer";

// These optional widgets belong to different route groups. Keep their code out
// of the shared shell bundle so public pages do not download the portal tutor.
const ContactChooser = dynamic(() => import("@/components/contact-chooser").then((mod) => mod.ContactChooser));
const FatherDla = dynamic(() => import("@/components/father-dla").then((mod) => mod.FatherDla));

const portalRoutes = ["/admin", "/applicant", "/finance", "/hoc", "/student", "/teacher", "/preview"];

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPortal = portalRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isAdminRecovery = pathname.startsWith("/admin/forgot-password");
  const hideNavigation = isPortal || pathname === "/login" || pathname === "/register" || isAdminRecovery;
  // Father-DLA is only available inside signed-in dashboards, never on the public website
  const allowFatherDla = isPortal && !isAdminRecovery;

  useEffect(() => {
    function track(event: PointerEvent) {
      const link = (event.target as Element | null)?.closest?.<HTMLElement>(".liquid-link, .site-menu-link, .site-footer a");
      if (!link) return;
      const box = link.getBoundingClientRect();
      link.style.setProperty("--lx", `${event.clientX - box.left}px`);
      link.style.setProperty("--ly", `${event.clientY - box.top}px`);
    }
    document.addEventListener("pointermove", track, { passive: true });
    return () => document.removeEventListener("pointermove", track);
  }, []);

  return (
    <>
      <div className="mesh-bg no-print" aria-hidden="true">
        <span className="ambient-word ambient-word-one">Karibu</span>
        <span className="ambient-word ambient-word-two">Welcome</span>
        <span className="ambient-word ambient-word-three">Bienvenue</span>
        <span className="ambient-word ambient-word-four">Guten Tag</span>
      </div>
      <div className="app-content-layer">
        {!hideNavigation && <PublicNav />}
        {!hideNavigation && <ContactChooser />}
        {children}
        {!hideNavigation && <SiteFooter />}
      </div>
      {allowFatherDla && <FatherDla />}
    </>
  );
}
