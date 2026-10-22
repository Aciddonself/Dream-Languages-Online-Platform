"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  Inbox,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { useTheme } from "@/components/theme-provider";

type NavItem = { href: string; label: string; icon?: string; group?: "Apps" | "Pages" };
type NotificationTab = "All" | "Following" | "Archive";

export function PortalShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<NotificationTab>("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const matchingNav = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();
    if (!normalizedQuery) return nav;
    return nav.filter((item) => item.label.toLowerCase().includes(normalizedQuery));
  }, [nav, searchValue]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setMobileOpen(false);
        setMenuOpen(false);
        setThemeMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const dashboardItems = nav.filter((item) => /dashboard/i.test(item.label));
  const pageItems = nav.filter((item) => item.group === "Pages");
  const appItems = nav.filter((item) => !/dashboard/i.test(item.label) && item.group !== "Pages");
  const activeLabel = nav.find((item) => pathname === item.href)?.label ?? title;

  function renderNavItems(items: NavItem[]) {
    return items.map((item) => {
      const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
      return (
        <Link
          key={item.href}
          href={item.href}
          className={`portal-nav-link${active ? " is-active" : ""}`}
          aria-current={active ? "page" : undefined}
          onClick={() => setMobileOpen(false)}
        >
          <span className="portal-nav-icon" aria-hidden="true">{item.icon || "•"}</span>
          <span className="portal-nav-label">{item.label}</span>
        </Link>
      );
    });
  }

  return (
    <div className={`portal-shell${collapsed ? " is-collapsed" : ""}`}>
      {mobileOpen && (
        <button
          className="portal-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`portal-sidebar${mobileOpen ? " is-open" : ""}`} aria-label="Main sidebar">
        <Link className="portal-brand" href={nav[0]?.href ?? "/"}>
          <span className="portal-brand-mark"><Image src="/dla-logo.png" alt="" width={33} height={33} /></span>
          <span className="portal-brand-copy">
            <strong>DLA Learning Hub</strong>
            <small>{title}</small>
          </span>
        </Link>
        <nav className="portal-sidebar-nav" aria-label={`${title} navigation`}>
          {dashboardItems.length > 0 && (
            <section className="portal-nav-group">
              <h2>Dashboards</h2>
              {renderNavItems(dashboardItems)}
            </section>
          )}
          {appItems.length > 0 && (
            <section className="portal-nav-group">
              <h2>Apps</h2>
              {renderNavItems(appItems)}
            </section>
          )}
          {pageItems.length > 0 && (
            <section className="portal-nav-group">
              <h2>Pages</h2>
              {renderNavItems(pageItems)}
            </section>
          )}
        </nav>
        <div className="portal-user-card">
          <div className="portal-avatar" aria-hidden="true">{title.slice(0, 1).toUpperCase()}</div>
          <div className="portal-user-copy">
            <strong>{title}</strong>
            <span>DLA account</span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="portal-content">
        <header className="portal-topbar">
          <div className="portal-topbar-leading">
            <button
              className="portal-icon-button portal-mobile-menu"
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={19} />
            </button>
            <button
              className="portal-icon-button portal-collapse-button"
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <span className="portal-breadcrumb">Pages <span>/</span> {activeLabel}</span>
          </div>

          <div className="portal-topbar-actions">
            <button
              className="portal-search-trigger"
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Open global search"
            >
              <Search size={17} />
              <span>Search</span>
              <kbd><Command size={11} /> K</kbd>
            </button>
            <Link className="portal-icon-button portal-inbox-button" href={nav.find((item) => /inbox|message/i.test(item.label))?.href ?? nav[0]?.href ?? "/"} aria-label="Inbox">
              <Inbox size={18} />
            </Link>
            <div className="portal-popover-anchor">
              <button
                className="portal-icon-button"
                type="button"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  setMenuOpen(false);
                  setThemeMenuOpen(false);
                }}
              >
                <Bell size={18} />
                <span className="portal-notification-dot" />
              </button>
            </div>
            <div className="portal-popover-anchor">
              <button
                className="portal-theme-trigger"
                type="button"
                aria-label={`Theme: ${theme}`}
                aria-expanded={themeMenuOpen}
                onClick={() => {
                  setThemeMenuOpen((value) => !value);
                  setNotificationsOpen(false);
                  setMenuOpen(false);
                }}
              >
                {resolvedTheme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
                <span>{theme === "system" ? "Auto" : theme === "dark" ? "Dark" : "Light"}</span>
                <ChevronDown size={14} />
              </button>
              {themeMenuOpen && (
                <div className="portal-popover portal-theme-menu" role="menu" aria-label="Theme">
                  {(["light", "dark", "system"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={theme === option}
                      onClick={() => {
                        setTheme(option);
                        setThemeMenuOpen(false);
                      }}
                    >
                      {option === "light" ? <Sun size={16} /> : option === "dark" ? <Moon size={16} /> : <span className="portal-auto-theme">A</span>}
                      {option === "system" ? "Auto" : option[0].toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="portal-popover-anchor">
              <button
                className="portal-profile-trigger"
                type="button"
                aria-label="Open account menu"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuOpen((value) => !value);
                  setNotificationsOpen(false);
                  setThemeMenuOpen(false);
                }}
              >
                <span className="portal-avatar">{title.slice(0, 1).toUpperCase()}</span>
                <span className="portal-profile-label">{title}</span>
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className="portal-popover portal-account-menu" role="menu">
                  <strong>{title}</strong>
                  <Link href={nav[0]?.href ?? "/"} role="menuitem" onClick={() => setMenuOpen(false)}>Home</Link>
                  <Link href={nav.find((item) => /inbox|message/i.test(item.label))?.href ?? nav[0]?.href ?? "/"} role="menuitem" onClick={() => setMenuOpen(false)}>Inbox</Link>
                  <Link href={nav.find((item) => /chat|community/i.test(item.label))?.href ?? nav[0]?.href ?? "/"} role="menuitem" onClick={() => setMenuOpen(false)}>Chat</Link>
                  <Link href={nav.find((item) => /activity/i.test(item.label))?.href ?? nav[0]?.href ?? "/"} role="menuitem" onClick={() => setMenuOpen(false)}>Activity</Link>
                  <Link href={nav.find((item) => /settings|profile/i.test(item.label))?.href ?? nav[0]?.href ?? "/"} role="menuitem" onClick={() => setMenuOpen(false)}>Account settings</Link>
                  <Link href="/contact" role="menuitem" onClick={() => setMenuOpen(false)}>Help &amp; support</Link>
                  <div className="portal-menu-logout"><LogoutButton /></div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="portal-main">{children}</main>
      </div>

      {notificationsOpen && (
        <div className="portal-drawer-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setNotificationsOpen(false);
        }}>
          <aside className="portal-notifications-drawer" aria-label="Notifications panel">
            <div className="portal-drawer-header">
              <div>
                <span className="portal-eyebrow">Updates</span>
                <h2>Notifications</h2>
              </div>
              <button className="portal-icon-button" type="button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}><X size={18} /></button>
            </div>
            <div className="portal-notification-tabs" role="tablist" aria-label="Notification filters">
              {(["All", "Following", "Archive"] as const).map((tab) => (
                <button key={tab} type="button" role="tab" aria-selected={notificationTab === tab} onClick={() => setNotificationTab(tab)}>{tab}</button>
              ))}
            </div>
            <div className="portal-notification-empty">
              <span className="portal-empty-icon"><CalendarDays size={20} /></span>
              <strong>{notificationTab === "All" ? "You’re all caught up" : `${notificationTab} notifications`}</strong>
              <p>New learning hub updates will appear here.</p>
            </div>
          </aside>
        </div>
      )}

      {searchOpen && (
        <div className="portal-search-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSearchOpen(false);
        }}>
          <section className="portal-search-dialog" role="dialog" aria-modal="true" aria-label="Global search">
            <div className="portal-search-input-row">
              <Search size={19} />
              <input
                autoFocus
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search this portal..."
                aria-label="Search this portal"
              />
              <button className="portal-icon-button" type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}><X size={17} /></button>
            </div>
            <div className="portal-search-results">
              <span className="portal-eyebrow">Pages</span>
              {matchingNav.length ? matchingNav.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setSearchOpen(false)}>
                  <span aria-hidden="true">{item.icon || <LayoutDashboard size={16} />}</span>
                  {item.label}
                  <ChevronRight size={15} />
                </Link>
              )) : <p>No matching pages in this portal.</p>}
            </div>
            <div className="portal-search-hint">Use <kbd>Ctrl</kbd> + <kbd>K</kbd> or <kbd>⌘</kbd> + <kbd>K</kbd> to search</div>
          </section>
        </div>
      )}
    </div>
  );
}
