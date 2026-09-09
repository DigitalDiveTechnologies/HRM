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
import { canAccessPath, isNavActive, navForRole, navGroupTitle, navLabel } from '../lib/nav';
import { BRAND } from '../lib/brand';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { usePortalAlerts } from './usePortalAlerts';
import { useLocale } from '../lib/i18n/LocaleContext';

export default function AppShell({ title, subtitle, actions, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
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

  // Preserve sidebar scroll position and ensure active tab is vertically centered
  useEffect(() => {
    if (typeof window === 'undefined' || !ready) return;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const onScroll = () => {
      sessionStorage.setItem('gocs_sidebar_scroll', String(sidebar.scrollTop));
    };
    sidebar.addEventListener('scroll', onScroll, { passive: true });

    const timer = setTimeout(() => {
      const activeLink = sidebar.querySelector('a.active');
      if (activeLink) {
        activeLink.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      sidebar.removeEventListener('scroll', onScroll);
    };
  }, [pathname, ready]);

  const { badgeFor, clearBadge, menuCategories, toast, dismissToast } = usePortalAlerts(pathname, ready && Boolean(user));

  if (!ready || !user) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="muted">{t('loading')}</div>
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
              aria-label={t('closeMenu')}
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
            <div className="nav-group" key={group.titleKey || group.title}>
              <h4>{navGroupTitle(group, t)}</h4>
              <div className="nav">
                {group.links.map((l) => {
                  const badge = badgeFor(l.href);
                  const isParentActive = isNavActive(pathname, l.href);
                  const isAnyChildActive = Boolean(l.children && l.children.some((c) => isNavActive(pathname, c.href)));
                  const isExpanded = isParentActive || isAnyChildActive || (pathname && pathname.startsWith(l.href));
                  const label = navLabel(l, t);

                  if (l.disabled) {
                    return (
                      <div key={l.href} style={{ display: 'flex', flexDirection: 'column', cursor: 'not-allowed' }} title="Temporarily disabled">
                        <div className="nav-disabled-link">
                          <span className="nav-link-label">{label}</span>
                          {badge > 0 ? (
                            <span className="nav-alert-badge" aria-label={`${badge} alerts`}>
                              {badge > 99 ? '99+' : badge}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={l.href} style={{ display: 'flex', flexDirection: 'column' }}>
                      <Link
                        href={l.href}
                        className={isParentActive ? 'active' : ''}
                        aria-current={isParentActive ? 'page' : undefined}
                        onClick={() => {
                          setMenuOpen(false);
                          if (clearBadge) clearBadge(l.href);
                        }}
                      >
                        <span className="nav-link-label">{label}</span>
                        {badge > 0 ? (
                          <span className="nav-alert-badge" aria-label={`${badge} alerts`}>
                            {badge > 99 ? '99+' : badge}
                          </span>
                        ) : null}
                      </Link>
                      {l.children && l.children.length > 0 && isExpanded ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            paddingInlineStart: '12px',
                            margin: '2px 0 4px 12px',
                            borderInlineStart: '1.5px solid var(--line, #cbd5e1)',
                            gap: '2px',
                          }}
                        >
                          {l.children.map((c) => {
                            const isChildActive = isNavActive(pathname, c.href);
                            return (
                              <Link
                                key={c.href}
                                href={c.href}
                                className={isChildActive ? 'active' : ''}
                                style={{
                                  fontSize: '12px',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  color: isChildActive ? '#ffffff' : 'var(--sidebar-text, #475569)',
                                  background: isChildActive ? 'var(--sidebar-active-bg, #00b8db)' : 'transparent',
                                  fontWeight: isChildActive ? 700 : 500,
                                  textDecoration: 'none',
                                }}
                                onClick={() => {
                                  setMenuOpen(false);
                                  if (clearBadge) {
                                    clearBadge(c.href);
                                    clearBadge(l.href);
                                  }
                                }}
                              >
                                {navLabel(c, t)}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button className="btn logout-btn block" type="button" onClick={logout} style={{ marginTop: 12 }}>
            {t('logout')}
          </button>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="topbar-left">
              <span className="menu-btn-wrap">
                <button
                  className="menu-btn"
                  type="button"
                  aria-label={t('openMenu')}
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
              {actions}
              <LanguageToggle />
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
              if (clearBadge) clearBadge(path);
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
