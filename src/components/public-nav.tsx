"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "Home", detail: "Back to the learning hub" },
  { href: "/departments", label: "Departments", detail: "Explore language departments & curriculum" },
  { href: "/courses", label: "Courses & fees", detail: "Compare languages, study formats, and fees" },
  { href: "/volunteer", label: "Teach with us", detail: "Apply to teach or volunteer with DLA" },
  { href: "/about", label: "About DLA", detail: "Meet the school and its mission" },
  { href: "/faqs", label: "FAQs", detail: "Answers for learners and families" },
  { href: "/blog", label: "News & stories", detail: "Read updates from our learning community" },
  { href: "/timetable", label: "Timetable", detail: "See upcoming classes and schedules" },
  { href: "/classes-2027", label: "Classes 2027", detail: "2027 intakes, class times and exam dates" },
  { href: "/testimonials", label: "Reviews", detail: "What our students say about DLA" },
  { href: "/contact", label: "Contact", detail: "Talk with our team" },
  { href: "/apply", label: "Apply for admission", detail: "Start your DLA journey" },
  { href: "/login", label: "Sign in", detail: "Student, teacher, HOC, finance & applicant sign in" },
];

export function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 12);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="site-nav-wrap">
      <header className={`site-nav${scrolled ? " site-nav-scrolled" : ""}`} data-open={open}>
        <div className="site-nav-top">
          <Link href="/" className="site-brand" aria-label="DLA Learning Hub home" onClick={() => setOpen(false)}>
            <span className="site-brand-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dla-logo.png" alt="" />
            </span>
            <span className="site-brand-copy">
              <strong>Dream Languages Uganda</strong>
              <small>LEARN · GROW · BELONG</small>
            </span>
          </Link>
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
        <nav className="site-menu-panel" id="dla-main-navigation" aria-label="Main navigation">
          <div className="site-menu-links">
            {links.map((link, index) => {
              const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
              return (
                <Link
                  className={`site-menu-link${active ? " is-active" : ""}`}
                  href={link.href}
                  key={link.href}
                  onClick={() => setOpen(false)}
                  title={link.detail}
                >
                  <span className="site-menu-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="site-menu-label">
                    <strong>{link.label}</strong>
                    <small>{link.detail}</small>
                  </span>
                  <ArrowUpRight className="site-menu-arrow" size={20} />
                </Link>
              );
            })}
          </div>
          <div className="site-menu-footer">
            <span>A little progress, every day.</span>
            <span className="site-menu-language">Karibu · Welcome · Bienvenue</span>
          </div>
        </nav>
      </header>
    </div>
  );
}
