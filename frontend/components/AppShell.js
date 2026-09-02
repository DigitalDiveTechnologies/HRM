'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  clearSession,
  getToken,
  getUser,
  hasSession,
  homeForRole,
  normalizeRole,
} from '../lib/auth';
import { canAccessPath, isNavActive, navForRole } from '../lib/nav';
import { BRAND } from '../lib/brand';
import ThemeToggle from './ThemeToggle';
import { usePortalAlerts } from './usePortalAlerts';

export default function AppShell({ title, subtitle, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // User chip alone is not enough — JWT must exist or API calls return 401.
    if (!hasSession()) {
      clearSession();
      router.replace('/');
      return;
    }
    const u = getUser();
    const token = getToken();
    if (!u || !token) {
      clearSession();
      router.replace('/');
      return;
    }
    const role = normalizeRole(u);
    if (!canAccessPath(pathname, role)) {
      router.replace(homeForRole(u));
      return;
    }
    setUser(u);
    setReady(true);
  }, [pathname, router]);

  const { badgeFor, menuCategories, toast, dismissToast } = usePortalAlerts(pathname, ready && Boolean(user));

  if (!ready || !user) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="muted">Loading…</div>
      </div>
    );
  }

  const role = normalizeRole(user);
  const filteredNav = navForRole(role);

  function logout() {
    clearSession();
    router.replace('/');
  }

  return (
    <>
      <div className={`backdrop${menuOpen ? ' show' : ''}`} onClick={() => setMenuOpen(false)} />
      <div className="app-shell">
        <aside className={`sidebar${menuOpen ? ' open' : ''}`} id="sidebar">
          <div className="sidebar-top">
            <div>
              <div className="logo">
                {BRAND.sidebarTitle} <span>{BRAND.sidebarAccent}</span>
              </div>
              <div className="tag">{BRAND.sidebarTag}</div>
            </div>
            <button
              type="button"
              className="sidebar-close"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"
                />
              </svg>
            </button>
          </div>
          {filteredNav.map((group) => (
            <div className="nav-group" key={group.title}>
              <h4>{group.title}</h4>
              <div className="nav">
                {group.links.map((l) => {
                  const badge = badgeFor(l.href);
                  return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={isNavActive(pathname, l.href) ? 'active' : ''}
                    aria-current={isNavActive(pathname, l.href) ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="nav-link-label">{l.label}</span>
                    {badge > 0 ? (
                      <span className="nav-alert-badge" aria-label={`${badge} alerts`}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : null}
                  </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <button className="btn logout-btn block" type="button" onClick={logout} style={{ marginTop: 12 }}>
            Logout
          </button>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="topbar-left">
              <span className="menu-btn-wrap">
                <button
                  className="menu-btn"
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setMenuOpen(true)}
                >
                  <svg className="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M2 5h20v2.5H2V5zm0 5.75h20v2.5H2v-2.5zm0 5.75h20V19H2v-2.5z" />
                  </svg>
                </button>
                {menuCategories > 0 ? (
                  <span className="nav-alert-badge menu-alert-badge" aria-label={`${menuCategories} sections with alerts`}>
                    {menuCategories > 99 ? '99+' : menuCategories}
                  </span>
                ) : null}
              </span>
              <div>
                <h2>{title}</h2>
                <p>{subtitle || ''}</p>
              </div>
            </div>
            <div className="topbar-right">
              <ThemeToggle />
              <div className="user-chip">
                {user.fullName || user.full_name || user.email} · {role}
              </div>
            </div>
          </div>
          <div id="content">{children}</div>
        </main>
      </div>
      {toast ? (
        <button
          type="button"
          className="portal-alert-toast"
          role="status"
          aria-live="polite"
          onClick={() => {
            const path = toast.path;
            dismissToast();
            if (path) {
              setMenuOpen(false);
              router.push(path);
            }
          }}
        >
          <span>{toast.message}</span>
          <span
            className="portal-alert-toast-close"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              dismissToast();
            }}
          >
            ×
          </span>
        </button>
      ) : null}
    </>
  );
}

export function Badge({ status }) {
  const s = String(status || '').toLowerCase();
  let cls = '';
  if (['approved', 'done', 'present', 'valid', 'active', 'ok', 'true'].includes(s)) cls = 'ok';
  else if (['pending', 'onboarding', 'late', 'false'].includes(s)) cls = 'pending';
  else if (['expiring', 'warn', 'inactive'].includes(s)) cls = 'warn';
  else if (['rejected', 'danger', 'leave', 'exited'].includes(s)) cls = 'danger';
  return <span className={`badge ${cls}`}>{status || '-'}</span>;
}
