"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
  // Enable Father-DLA across the entire learning hub and public website (except admin recovery)
  const allowFatherDla = !isAdminRecovery;

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
