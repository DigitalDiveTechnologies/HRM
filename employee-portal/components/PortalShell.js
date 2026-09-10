'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { session } from '@/lib/api';
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

  useEffect(() => {
    const current = session.get();
    if (!current?.token || current?.user?.role?.toLowerCase() !== 'employee') {
      router.replace('/login');
      return;
    }
    setUser(current.user);
  }, [router]);

  // Preserve sidebar scroll position
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sidebar = document.getElementById('emp-sidebar');
    if (!sidebar) return;

    const saved = sessionStorage.getItem('gocs_emp_sidebar_scroll');
    if (saved) sidebar.scrollTop = Number(saved);

    const onScroll = () => {
      sessionStorage.setItem('gocs_emp_sidebar_scroll', String(sidebar.scrollTop));
    };
    sidebar.addEventListener('scroll', onScroll, { passive: true });

    return () => sidebar.removeEventListener('scroll', onScroll);
  }, [pathname]);

  function logout() {
    session.clear();
    router.replace('/login');
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>
        {t('loading_portal')}
      </div>
    );
  }

  const displayName = user.fullName || user.email || 'Employee';

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

            {/* Language Toggle Button */}
            <button
              type="button"
              className="lang-toggle"
              onClick={toggleLocale}
              title={locale === 'en' ? 'Switch to Arabic (العربية)' : 'Switch to English'}
              aria-label="Toggle Language"
            >
              {locale === 'en' ? 'ع' : 'EN'}
            </button>

            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* User Chip: [Name] · employee */}
            <div className="user-chip">
              {displayName} · {locale === 'ar' ? 'موظف' : 'employee'}
            </div>
          </div>
        </div>

        {/* Page Content */}
        {children}
      </main>
    </div>
  );
}
