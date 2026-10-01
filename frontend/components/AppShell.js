'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  api,
  clearSession,
  getToken,
  getUser,
  getPermissions,
  hasSession,
  homeForRole,
  normalizeRole,
} from '../lib/auth';
import { canAccessPath, canUsePermission, isNavActive, navForRole, navGroupTitle, navLabel } from '../lib/nav';
import { BRAND } from '../lib/brand';
import ThemeToggle from './ThemeToggle';
import LanguageToggle from './LanguageToggle';
import { usePortalAlerts } from './usePortalAlerts';
import { useLocale } from '../lib/i18n/LocaleContext';
import { useCompanyFilter } from '../lib/useCompanyFilter';
import { subscribeSettingsRbacChanged } from '../lib/settingsSync';
import { LOGO_ACCEPT, readLogoFileAsDataUrl } from '../lib/logoUpload';
import { v } from '../lib/format';

const ORG_BRAND_CACHE = 'gocs_org_brand';

function getNavIcon(href) {
  switch (href) {
    case '/dashboard':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case '/attendance':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case '/leave':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case '/payroll':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      );
    case '/certificates':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case '/notifications':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case '/onboarding':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      );
    case '/employees':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case '/departments':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
          <path d="M6 12H4a2 2 0 0 0-2 2v8h20v-8a2 2 0 0 0-2-2h-2" />
          <line x1="10" y1="6" x2="14" y2="6" />
          <line x1="10" y1="10" x2="14" y2="10" />
          <line x1="10" y1="14" x2="14" y2="14" />
          <line x1="10" y1="18" x2="14" y2="18" />
        </svg>
      );
    case '/masters':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case '/recruitment':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );
    case '/exit':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case '/compliance':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      );
    case '/performance':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case '/training':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case '/assets':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case '/travel':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
      );
    case '/approvals':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      );
    case '/reports':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case '/ops':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );
    case '/ess':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polyline points="16 11 18 13 22 9" />
        </svg>
      );
    case '/mss':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case '/documents':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case '/settings/users':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <circle cx="19" cy="11" r="2" />
        </svg>
      );
    case '/settings/roles':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case '/settings/permissions':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="m21 2-9.6 9.6" />
          <path d="m15.5 7.5 3 3L22 7l-3-3" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
}

export default function AppShell({ title, subtitle, actions, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [orgBrand, setOrgBrand] = useState(() => {
    if (typeof window === 'undefined') return { displayName: BRAND.sidebarTitle, logoUrl: '' };
    try {
      const cached = localStorage.getItem(ORG_BRAND_CACHE);
      if (cached) {
        const p = JSON.parse(cached);
        return {
          displayName: p.displayName || p.DisplayName || BRAND.sidebarTitle,
          logoUrl: p.logoUrl || p.LogoUrl || '',
        };
      }
    } catch {}
    return { displayName: BRAND.sidebarTitle, logoUrl: '' };
  });
  const [brandEditOpen, setBrandEditOpen] = useState(false);
  const [brandDraft, setBrandDraft] = useState({ displayName: '', logoUrl: '' });
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandError, setBrandError] = useState('');

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
    const permissions = getPermissions(u);
    const norm = (p) => {
      const s = (p || '/').split('?')[0];
      return (s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s) || '/';
    };
    const here = norm(pathname);

    // Always mark ready with a valid session — never leave any role stuck on Loading.
    setUser(u);
    setReady(true);

    // Self-heal stale caches from prior buggy single-item writes
    try {
      const empCache = localStorage.getItem('gocs_cached_employees');
      const dashCache = localStorage.getItem('gocs_cached_dashboard');
      if (empCache && dashCache) {
        const emps = JSON.parse(empCache);
        const dash = JSON.parse(dashCache);
        const hc = Number(dash?.dash?.headcount || dash?.dash?.totalEmployees || 0);
        if (Array.isArray(emps) && emps.length === 1 && hc > 1) {
          if (Array.isArray(dash.employees) && dash.employees.length > 1) {
            localStorage.setItem('gocs_cached_employees', JSON.stringify(dash.employees));
          } else {
            localStorage.removeItem('gocs_cached_employees');
          }
        }
      }
    } catch {}

    if (!canAccessPath(pathname, role, permissions)) {
      const home = homeForRole(u);
      if (home && norm(home) !== here) {
        router.replace(home);
      }
    }

    // Refresh permissions from server (deactivate / matrix changes) — keep login role, never promote to admin
    api('/auth/me')
      .then((me) => {
        if (!me) return;
        if (me.token) {
          try { localStorage.setItem('hr_token', me.token); } catch {}
        }
        const loginRole = normalizeRole(u);
        const meRole = String(me.role || me.Role || loginRole).toLowerCase();
        // Ignore bogus "admin" from old JWTs when this session logged in as another role
        const role =
          meRole === 'admin' && loginRole && loginRole !== 'admin' && loginRole !== 'super_admin'
            ? loginRole
            : meRole || loginRole;
        const perms = Array.isArray(me.permissions)
          ? me.permissions
          : Array.isArray(me.Permissions)
            ? me.Permissions
            : getPermissions(u);
        const next = {
          ...u,
          role,
          permissions: perms,
          email: me.email || me.Email || u.email,
          fullName: me.fullName || me.FullName || u.fullName || u.full_name,
        };
        try {
          localStorage.setItem('hr_user', JSON.stringify(next));
        } catch {
          /* ignore */
        }
        setUser(next);
        const nextRole = normalizeRole(next);
        const nextPerms = getPermissions(next);
        if (!canAccessPath(pathname, nextRole, nextPerms)) {
          const home = homeForRole(next);
          if (home && norm(home) !== here) router.replace(home);
        }
      })
      .catch(() => {
        /* keep session — never logout into a Loading loop */
      });
  }, [pathname, router]);

  useEffect(() => {
    if (!ready) return;
    api('/org-brand')
      .then((b) => {
        if (!b) return;
        const next = {
          displayName: b.displayName || b.DisplayName || BRAND.sidebarTitle,
          logoUrl: b.logoUrl || b.LogoUrl || '',
        };
        setOrgBrand(next);
        try {
          localStorage.setItem(ORG_BRAND_CACHE, JSON.stringify(next));
        } catch {}
      })
      .catch(() => {});
  }, [ready]);

  // Soft-refresh session when Settings RBAC changes (no full page reload)
  useEffect(() => {
    return subscribeSettingsRbacChanged((detail) => {
      const t = String(detail?.type || '');
      if (t !== 'permissions_saved' && t !== 'rbac_reload') return;
      const u = getUser();
      if (!u) return;
      api('/auth/me')
        .then((me) => {
          if (!me) return;
          if (me.token) {
            try { localStorage.setItem('hr_token', me.token); } catch {}
          }
          const loginRole = normalizeRole(u);
          const meRole = String(me.role || me.Role || loginRole).toLowerCase();
          const role =
            meRole === 'admin' && loginRole && loginRole !== 'admin' && loginRole !== 'super_admin'
              ? loginRole
              : meRole || loginRole;
          const perms = Array.isArray(me.permissions)
            ? me.permissions
            : Array.isArray(me.Permissions)
              ? me.Permissions
              : getPermissions(u);
          const next = {
            ...u,
            role,
            permissions: perms,
            email: me.email || me.Email || u.email,
            fullName: me.fullName || me.FullName || u.fullName || u.full_name,
          };
          try {
            localStorage.setItem('hr_user', JSON.stringify(next));
          } catch {
            /* ignore */
          }
          setUser(next);
        })
        .catch(() => {});
    });
  }, []);

  // Keep scrollbar thumb near the active nav item (center it in the sidebar viewport)
  useEffect(() => {
    if (typeof window === 'undefined' || !ready) return;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const scrollActiveNearThumb = () => {
      const active = sidebar.querySelector('a.active, a[aria-current="page"]');
      if (!active) return;
      const sRect = sidebar.getBoundingClientRect();
      const aRect = active.getBoundingClientRect();
      const activeMid = aRect.top + aRect.height / 2;
      const viewMid = sRect.top + sidebar.clientHeight / 2;
      const next = sidebar.scrollTop + (activeMid - viewMid);
      const max = Math.max(0, sidebar.scrollHeight - sidebar.clientHeight);
      sidebar.scrollTop = Math.min(max, Math.max(0, next));
    };

    // After nav links paint
    const t1 = window.setTimeout(scrollActiveNearThumb, 0);
    const t2 = window.setTimeout(scrollActiveNearThumb, 80);

    const onScroll = () => {
      sessionStorage.setItem('gocs_sidebar_scroll', String(sidebar.scrollTop));
    };
    sidebar.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      sidebar.removeEventListener('scroll', onScroll);
    };
  }, [pathname, ready]);

  const { badgeFor, clearBadge, menuCategories, toast, dismissToast } = usePortalAlerts(pathname, ready && Boolean(user));
  const { selectedCompany, selectedCompanyId, companies, setCompanyId } = useCompanyFilter();

  if (!ready || !user) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="muted">{t('loading')}</div>
      </div>
    );
  }

  const role = normalizeRole(user);
  const permissions = getPermissions(user);
  const filteredNav = navForRole(role, permissions);
  const pathAllowed = canAccessPath(pathname, role, permissions);
  const noPages = filteredNav.length === 0;
  const showPage = pathAllowed && !noPages;
  const canEditOrgBrand = canUsePermission(role, permissions, 'company.brand.edit');

  function logout() {
    clearSession();
    router.replace('/');
  }

  function openBrandEdit() {
    setBrandError('');
    setBrandDraft({
      displayName: orgBrand.displayName || BRAND.sidebarTitle,
      logoUrl: orgBrand.logoUrl || '',
    });
    setBrandEditOpen(true);
  }

  async function saveOrgBrand(e) {
    e.preventDefault();
    setBrandBusy(true);
    setBrandError('');
    try {
      const saved = await api('/org-brand', {
        method: 'PUT',
        body: JSON.stringify({
          displayName: String(brandDraft.displayName || '').trim(),
          logoUrl: brandDraft.logoUrl || '',
        }),
      });
      const next = {
        displayName: saved?.displayName || saved?.DisplayName || brandDraft.displayName,
        logoUrl: saved?.logoUrl ?? saved?.LogoUrl ?? brandDraft.logoUrl,
      };
      setOrgBrand(next);
      try {
        localStorage.setItem(ORG_BRAND_CACHE, JSON.stringify(next));
      } catch {}
      setBrandEditOpen(false);
    } catch (err) {
      setBrandError(err.message || 'Could not save brand.');
    } finally {
      setBrandBusy(false);
    }
  }

  const companyLogo = selectedCompany?.logo_url || selectedCompany?.logoUrl || '';
  const companyName = selectedCompany?.name || '';
  const isDashboardPage = pathname === '/dashboard' || (pathname || '').startsWith('/dashboard/') || pathname === '/ess' || (pathname || '').startsWith('/ess/');
  const headerTitle = noPages || !pathAllowed ? 'No access' : title;
  const headerSubtitle =
    noPages || !pathAllowed
      ? 'This role has no portal pages assigned yet.'
      : subtitle || '';
  const allBrandTitle = orgBrand.displayName || BRAND.sidebarTitle;
  const allBrandLogo = orgBrand.logoUrl || '';

  return (
    <>
      <div className={`backdrop${menuOpen ? ' show' : ''}`} onClick={() => setMenuOpen(false)} />
      <div className="app-shell">
        <aside className={`sidebar${menuOpen ? ' open' : ''}`} id="sidebar">
          <div className="sidebar-top">
            <div>
              <div className="logo brand-row">
                {selectedCompany ? (
                  <>
                    {companyLogo ? (
                      <img
                        className="sidebar-brand-logo"
                        src={companyLogo}
                        alt={companyName}
                        style={{
                          height: 84,
                          maxWidth: 176,
                          objectFit: 'contain',
                          borderRadius: 4,
                          flexShrink: 0,
                          background: '#ffffff',
                          padding: '1px',
                          border: '1px solid rgba(255,255,255,0.15)'
                        }}
                      />
                    ) : null}
                    <div className="sidebar-brand-copy">
                      <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {companyName} <span style={{ color: 'var(--primary, #00b8db)', fontWeight: 800 }}>HR</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {allBrandLogo ? (
                      <img
                        className="sidebar-brand-logo"
                        src={allBrandLogo}
                        alt={allBrandTitle}
                        style={{
                          height: 84,
                          maxWidth: 176,
                          objectFit: 'contain',
                          borderRadius: 4,
                          flexShrink: 0,
                          background: '#ffffff',
                          padding: '1px',
                          border: '1px solid rgba(255,255,255,0.15)',
                        }}
                      />
                    ) : null}
                    <div className="sidebar-brand-copy">
                      <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {allBrandTitle}
                      </span>
                      {canEditOrgBrand ? (
                        <button
                          type="button"
                          className="sidebar-brand-edit"
                          title="Edit Synergy (All Companies) name & logo"
                          onClick={openBrandEdit}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
              <div className="tag">
                {selectedCompany ? BRAND.sidebarTag : BRAND.sidebarTag}
              </div>
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
                          <span className="nav-icon" style={{ opacity: 0.4 }}>{getNavIcon(l.href)}</span>
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
                        {isParentActive ? <span className="nav-active-indicator" /> : null}
                        <span className="nav-icon">{getNavIcon(l.href)}</span>
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
          <div
            className="topbar"
            style={
              isDashboardPage
                ? {
                    background: 'var(--surface, #ffffff)',
                    padding: '12px 20px',
                    borderRadius: 14,
                    border: '1px solid var(--line, #e2e8f0)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    alignItems: 'center',
                    marginBottom: 20,
                  }
                : undefined
            }
          >
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
              {isDashboardPage ? (
                <div className="topbar-search-wrap" style={{ display: 'flex', alignItems: 'center', flex: 1, maxWidth: 440, minWidth: 220 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      background: 'var(--surface-alt, #f8fafc)',
                      border: '1px solid var(--line, #e2e8f0)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      color: 'var(--muted, #64748b)',
                      fontSize: '13px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search employees, documents, payslips..."
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        fontSize: '13px',
                        color: 'var(--ink, #0f172a)',
                        padding: 0
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          const val = e.target.value.trim();
                          const lower = val.toLowerCase();
                          if (lower === 'document' || lower === 'documents' || lower === 'doc' || lower === 'docs') {
                            router.push('/documents');
                          } else if (lower === 'payslip' || lower === 'payslips' || lower === 'payroll' || lower === 'salary' || lower === 'wps') {
                            router.push('/payroll');
                          } else if (lower === 'attendance' || lower === 'clock' || lower === 'shifts' || lower === 'shift') {
                            router.push('/attendance');
                          } else if (lower === 'leave' || lower === 'leaves' || lower === 'vacation') {
                            router.push('/leave');
                          } else if (lower === 'asset' || lower === 'assets' || lower === 'equipment') {
                            router.push('/assets');
                          } else if (lower === 'report' || lower === 'reports' || lower === 'analytics') {
                            router.push('/reports');
                          } else if (lower === 'onboarding' || lower === 'task' || lower === 'tasks') {
                            router.push('/onboarding');
                          } else if (lower === 'recruitment' || lower === 'candidate' || lower === 'candidates' || lower === 'jobs') {
                            router.push('/recruitment');
                          } else if (lower === 'training' || lower === 'course' || lower === 'courses') {
                            router.push('/training');
                          } else if (lower === 'travel' || lower === 'trip') {
                            router.push('/travel');
                          } else if (lower === 'compliance') {
                            router.push('/compliance');
                          } else if (lower === 'company' || lower === 'companies' || lower === 'division' || lower === 'divisions') {
                            router.push('/divisions');
                          } else if (lower === 'department' || lower === 'departments' || lower === 'dept') {
                            router.push('/departments');
                          } else if (lower === 'setting' || lower === 'settings' || lower === 'role' || lower === 'roles' || lower === 'permissions' || lower === 'permission') {
                            router.push('/settings/roles');
                          } else {
                            router.push(`/employees?search=${encodeURIComponent(val)}`);
                          }
                        }
                      }}
                    />
                    <kbd style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      background: 'var(--surface, #ffffff)',
                      border: '1px solid var(--line, #cbd5e1)',
                      borderRadius: 4,
                      padding: '2px 5px',
                      color: 'var(--muted, #64748b)',
                      whiteSpace: 'nowrap'
                    }}>
                      ⌘K
                    </kbd>
                  </div>
                </div>
              ) : (
                <div>
                  <h2>{headerTitle}</h2>
                  <p>{headerSubtitle}</p>
                </div>
              )}
            </div>
            <div className="topbar-right">
              {actions}
              {companies && companies.length > 0 && !isDashboardPage ? (
                <select
                  aria-label="Filter company"
                  className="topbar-select"
                  value={selectedCompanyId || ''}
                  onChange={(e) => setCompanyId(e.target.value)}
                  style={{
                    fontWeight: 600,
                    cursor: 'pointer',
                    maxWidth: 180,
                    borderRadius: 6,
                    height: 40,
                  }}
                  title="Filter portal data by operating company"
                >
                  <option value="">🏢 All Companies</option>
                  {companies.map((c, idx) => {
                    const cid = String(v(c, 'id', 'Id') || c?.id || c?.Id || idx);
                    const cname = v(c, 'name', 'Name') || c?.name || c?.Name || `Company #${cid}`;
                    return (
                      <option key={cid} value={cid}>
                        {cname}
                      </option>
                    );
                  })}
                </select>
              ) : null}
              {isDashboardPage ? (
                <>
                  <LanguageToggle />
                  <ThemeToggle />
                  <Link
                    href="/notifications"
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      border: '1px solid var(--line, #e2e8f0)',
                      background: 'var(--surface, #ffffff)',
                      color: 'var(--ink, #0f172a)',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title="Notifications"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {badgeFor('/notifications') > 0 ? (
                      <span
                        style={{
                          position: 'absolute',
                          top: -3,
                          right: -3,
                          minWidth: 16,
                          height: 16,
                          padding: '0 4px',
                          borderRadius: 999,
                          background: '#ef4444',
                          color: '#fff',
                          fontSize: '9.5px',
                          fontWeight: 700,
                          lineHeight: '16px',
                          textAlign: 'center',
                          border: '1.5px solid var(--surface, #ffffff)'
                        }}
                      >
                        {badgeFor('/notifications') > 99 ? '99+' : badgeFor('/notifications')}
                      </span>
                    ) : null}
                  </Link>

                  {/* User Avatar Chip (Matching Mockup) */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '4px 12px 4px 5px',
                      borderRadius: 30,
                      background: 'var(--surface, #ffffff)',
                      border: '1px solid var(--line, #e2e8f0)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '11px',
                        letterSpacing: '0.5px'
                      }}
                    >
                      {(user?.fullName || user?.full_name || user?.email || 'A').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                        {user?.fullName || user?.full_name || 'Admin'}
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--muted, #64748b)', fontWeight: 500 }}>
                        {role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'HR Admin' : role}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <LanguageToggle />
                  <ThemeToggle />
                  <div className="user-chip">
                    {user?.fullName || user?.full_name || user?.email} · {role}
                  </div>
                </>
              )}
            </div>
          </div>
          <div id="content">
            {showPage ? (
              children
            ) : (
              <div className="card" style={{ padding: '28px 24px', maxWidth: 560 }}>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  No portal pages are assigned to your role. Ask Super Admin to open{' '}
                  <strong>Settings → Permissions</strong>, tick the pages this role should see, Save, then sign in
                  again.
                </p>
              </div>
            )}
          </div>
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
      {brandEditOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
          onClick={() => !brandBusy && setBrandEditOpen(false)}
        >
          <div
            className="card"
            style={{ width: 'min(420px, 100%)', padding: 18, margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>Edit Synergy brand</h3>
            <p className="muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
              Only the main Synergy name and logo — not the list of companies below.
            </p>
            {brandError ? <div className="error" style={{ marginBottom: 10 }}>{brandError}</div> : null}
            <form onSubmit={saveOrgBrand} className="stack" style={{ gap: 12 }}>
              <label className="field">
                <span>Brand name</span>
                <input
                  required
                  minLength={1}
                  value={brandDraft.displayName}
                  onChange={(e) => setBrandDraft({ ...brandDraft, displayName: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Logo (optional)</span>
                <input
                  type="file"
                  accept={LOGO_ACCEPT}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      const dataUrl = await readLogoFileAsDataUrl(file);
                      setBrandDraft((prev) => ({ ...prev, logoUrl: dataUrl }));
                      setBrandError('');
                    } catch (err) {
                      setBrandError(err.message || 'Invalid logo file.');
                    }
                  }}
                />
                {brandDraft.logoUrl ? (
                  <img
                    src={brandDraft.logoUrl}
                    alt="Brand logo preview"
                    style={{
                      marginTop: 8,
                      height: 40,
                      maxWidth: 80,
                      objectFit: 'contain',
                      borderRadius: 4,
                      border: '1px solid var(--line)',
                      background: '#fff',
                    }}
                  />
                ) : null}
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" className="btn" disabled={brandBusy}>
                  {brandBusy ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={brandBusy}
                  onClick={() => setBrandEditOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
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
