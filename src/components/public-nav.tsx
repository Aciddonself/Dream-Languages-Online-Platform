"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/services", label: "Services" },
  { href: "/dla-opportunities", label: "DLA_Opportunities" },
  { href: "/apply", label: "Apply" },
  { href: "/contact", label: "Contact" },
];

const secondaryLinks = [
  { href: "/departments", label: "Departments" },
  { href: "/about", label: "About DLA" },
  { href: "/faqs", label: "FAQs" },
  { href: "/blog", label: "News" },
  { href: "/timetable", label: "Timetable" },
  { href: "/classes-2027", label: "Classes 2027" },
  { href: "/apply?intake=next", label: "Book next intake" },
  { href: "/testimonials", label: "Reviews" },
  { href: "/volunteer", label: "Teach with us" },
];

export function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [logo, setLogo] = useState({ src: "/dla-logo.png", alt: "DLA Logo" });

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 12);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/public/site-logo", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active && typeof data?.src === "string") setLogo({ src: data.src, alt: typeof data.alt === "string" ? data.alt : "DLA Logo" }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <div className="site-nav-wrap">
      <header className={`site-nav${scrolled ? " site-nav-scrolled" : ""}`} data-open={open}>
        {/* Row 1: Logo + 5 primary links */}
        <div className="site-nav-top">
          <Link href="/" className="site-brand" aria-label="DLA Learning Hub home" onClick={() => setOpen(false)}>
            <span className="site-brand-mark">
            <Image src={logo.src} alt={logo.alt} width={136} height={104} loading="eager" quality={90} unoptimized={logo.src.startsWith("https://") && !logo.src.includes("dreamlanguagesug.online")} />
            </span>
            <span className="site-brand-copy">
              <strong>Dream Languages Uganda</strong>
              <small>LEARN · GROW · BELONG</small>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 bg-[var(--surface)]/60 backdrop-blur-md rounded-xl px-2 py-1.5 border border-[var(--border)] shadow-sm hover:shadow-lg hover:bg-[var(--surface)]/80 hover:border-[var(--brand-primary)]/40 transition-all duration-300" aria-label="Primary navigation">
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${isActive(link.href) ? "bg-[var(--brand-primary)] text-[var(--text-on-primary)] shadow-md" : "text-[var(--text)] hover:bg-[var(--brand-primary)]/10 hover:text-[var(--brand-primary)] hover:scale-105"}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="site-nav-actions">
            <button
              className={`site-icon-button site-menu-button${open ? " is-open" : ""}`}
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="dla-main-navigation"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
        {/* Row 2: Remaining links (desktop only) */}
        <div className="hidden md:block border-t-2 border-[var(--brand-primary)]/50 mx-4 my-1.5" />
        <nav className="hidden md:flex items-center justify-center gap-1 px-4 py-2 flex-wrap" aria-label="Secondary navigation">
          {secondaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all duration-200 ${link.href.includes("intake=next") ? "site-nav-booking" : isActive(link.href) ? "bg-[var(--brand-primary)] text-[var(--text-on-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 hover:scale-105"}`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {/* Mobile menu */}
        {open && (
        <nav className="site-menu-panel md:hidden" id="dla-main-navigation" aria-label="Main navigation">
          <div className="site-menu-links">
            {[...primaryLinks, ...secondaryLinks].map((link, index) => {
              const active = isActive(link.href);
              return (
                <Link
                  className={`site-menu-link${active ? " is-active" : ""}`}
                  href={link.href}
                  key={link.href}
                  onClick={() => setOpen(false)}
                >
                  <span className="site-menu-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className={`site-menu-label${link.href.includes("intake=next") ? " site-menu-booking-label" : ""}`}>
                    <strong>{link.label}</strong>
                  </span>
                  <ArrowUpRight className="site-menu-arrow" size={20} />
                </Link>
              );
            })}
          </div>
        </nav>
        )}
      </header>
    </div>
  );
}
