"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PublicNav } from "@/components/public-nav";
import { ContactChooser } from "@/components/contact-chooser";
import { FatherDla } from "@/components/father-dla";
import { SiteFooter } from "@/components/site-footer";

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
