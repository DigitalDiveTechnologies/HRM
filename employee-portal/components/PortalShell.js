'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ACCOUNT_DEACTIVATED_EVENT, api, session } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';
import ThemeToggle from './ThemeToggle';

const navConfigs = [
  {
    href: '/',
    key: 'nav_dashboard',
    defaultLabel: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/attendance',
    key: 'nav_attendance',
    defaultLabel: 'Attendance',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
  },
  {
    href: '/leaves',
    key: 'nav_leaves',
    defaultLabel: 'Leaves',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
      </svg>
    ),
  },
  {
    href: '/payslips',
    key: 'nav_payslips',
    defaultLabel: 'Payslips',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <path d="M7 15h2M15 15h2" />
      </svg>
    ),
  },
  {
    href: '/certificates',
    key: 'nav_certificates',
    defaultLabel: 'Certificates',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: '/notifications',
    key: 'nav_notifications',
    defaultLabel: 'Notifications',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    href: '/onboarding',
    key: 'nav_onboarding',
    defaultLabel: 'Onboarding',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: '/profile',
    key: 'nav_profile',
    defaultLabel: 'My Profile',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function PortalShell({ title, subtitle, actions, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t, toggleLocale } = useLocale();
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [deactivated, setDeactivated] = useState(false);

  useEffect(() => {
    const current = session.get();
    if (!current?.token || current?.user?.role?.toLowerCase() !== 'employee') {
      router.replace('/login');
      return;
    }
    setUser(current.user);

    // If account was deactivated after login, block the whole employee portal.
    const markDeactivated = () => setDeactivated(true);
    window.addEventListener(ACCOUNT_DEACTIVATED_EVENT, markDeactivated);

    api('/auth/me').catch((err) => {
      const msg = String(err?.message || '');
      if (/deactivat|inactive/i.test(msg)) markDeactivated();
    });

    return () => window.removeEventListener(ACCOUNT_DEACTIVATED_EVENT, markDeactivated);
  }, [router]);

  // Preserve sidebar scroll position
  useEffect(() => {
    if (typeof window === 'undefined' || deactivated) return;
    const sidebar = document.getElementById('emp-sidebar');
    if (!sidebar) return;

    const saved = sessionStorage.getItem('gocs_emp_sidebar_scroll');
    if (saved) sidebar.scrollTop = Number(saved);

    const onScroll = () => {
      sessionStorage.setItem('gocs_emp_sidebar_scroll', String(sidebar.scrollTop));
    };
    sidebar.addEventListener('scroll', onScroll, { passive: true });

    return () => sidebar.removeEventListener('scroll', onScroll);
  }, [pathname, deactivated]);

  function logout() {
    session.clear();
    router.replace('/login');
  }

  if (deactivated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            padding: '32px 28px',
            borderRadius: 12,
            border: '1px solid var(--line, #e2e8f0)',
            background: 'var(--surface, #fff)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>
            Account deactivated
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>
            Your account has been deactivated. You cannot access the employee portal. Please contact your HR admin.
          </p>
          <button type="button" className="btn-primary" onClick={logout} style={{ minWidth: 140 }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>
        {t('loading_portal')}
      </div>
    );
  }

  const displayName = user.fullName || user.email || 'Employee';
  const initials = String(displayName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'E';

  return (
    <div className="shell">
      {/* Mobile backdrop */}
      {open ? (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      ) : null}

      {/* Sidebar */}
      <aside className={`sidebar${open ? ' open' : ''}`} id="emp-sidebar">
        <div className="sidebar-top">
          <div className="brand-logo">
            GOCs <span className="accent">HR</span>
          </div>
          <div className="brand-tag">{t('portal_tag')}</div>
        </div>

        <nav className="sidebar-nav">
          {navConfigs.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? 'active' : ''}
                onClick={() => setOpen(false)}
              >
                <i className="nav-svg-icon">{item.icon}</i>
                <span>{t(item.key) || item.defaultLabel}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="logout-btn" type="button" onClick={logout}>
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main">
        {/* Top Header */}
        <div className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <div>
              <h2>{title}</h2>
              <p>{subtitle || t('dash_subtitle')}</p>
            </div>
          </div>

          <div className="topbar-right">
            {actions}

            <button
              type="button"
              className="lang-toggle"
              onClick={toggleLocale}
              title={locale === 'en' ? 'Switch to Arabic (العربية)' : 'Switch to English'}
              aria-label="Toggle Language"
            >
              {locale === 'en' ? 'ع' : 'EN'}
            </button>

            <ThemeToggle />

            <div className="user-chip">
              <span className="user-avatar" aria-hidden="true">{initials}</span>
              <span className="user-chip-meta">
                <span className="user-chip-name">{displayName}</span>
                <span className="user-chip-role">· {locale === 'ar' ? 'موظف' : 'employee'}</span>
              </span>
            </div>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
