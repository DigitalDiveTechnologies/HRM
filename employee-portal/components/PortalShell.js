'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, session, value } from '@/lib/api';
import ThemeToggle from './ThemeToggle';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '▦' },
  { href: '/attendance', label: 'Attendance', icon: '◷' },
  { href: '/leaves', label: 'Leaves', icon: '◫' },
  { href: '/onboarding', label: 'Onboarding', icon: '✓' },
  { href: '/profile', label: 'My Profile', icon: '◉' },
];

export default function PortalShell({ title, subtitle, actions, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState('en');
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  useEffect(() => {
    const current = session.get();
    if (!current?.token || current?.user?.role?.toLowerCase() !== 'employee') {
      router.replace('/login');
      return;
    }
    setUser(current.user);

    // Fetch companies for company selector in header
    api('/divisions')
      .then((d) => setCompanies(Array.isArray(d) ? d : []))
      .catch(() => {});
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

  function toggleLang() {
    setLang((prev) => (prev === 'en' ? 'ar' : 'en'));
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--muted)' }}>
        Loading your portal…
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
          <div className="brand-tag">HR Portal · UAE</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? 'active' : ''}
                onClick={() => setOpen(false)}
              >
                <i>{item.icon}</i>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="logout-btn" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main">
        {/* Top Header - Exact Match to Admin Dashboard Image */}
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
              <p>{subtitle || 'Workforce overview, live statistics and operational metrics'}</p>
            </div>
          </div>

          <div className="topbar-right">
            {actions}

            {/* Company Selector Dropdown (Exact match to image) */}
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="topbar-select"
              title="Filter by company"
            >
              <option value="">🏢 All Companies ({companies.length || 14})</option>
              {companies.map((c) => (
                <option key={value(c, 'id')} value={String(value(c, 'id'))}>
                  {value(c, 'name')} {value(c, 'code') ? `(${value(c, 'code')})` : ''}
                </option>
              ))}
            </select>

            {/* Language Toggle Button */}
            <button
              type="button"
              className="lang-toggle"
              onClick={toggleLang}
              title="Toggle Language"
              aria-label="Toggle Language"
            >
              {lang === 'en' ? 'ع' : 'EN'}
            </button>

            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* User Chip: [Name] · employee */}
            <div className="user-chip">
              {displayName} · employee
            </div>
          </div>
        </div>

        {/* Page Content */}
        {children}
      </main>
    </div>
  );
}
