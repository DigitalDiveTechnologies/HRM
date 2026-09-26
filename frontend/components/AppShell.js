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

const ORG_BRAND_CACHE = 'gocs_org_brand';

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

  // Scroll active sidebar link into view (so thumb sits near Assets when Assets is active)
  useEffect(() => {
    if (typeof window === 'undefined' || !ready) return;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const scrollActiveIntoView = () => {
      const active = sidebar.querySelector('a.active, a[aria-current="page"]');
      if (active && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };
    // After paint so layout/heights are ready
    const t = window.setTimeout(scrollActiveIntoView, 0);

    const onScroll = () => {
      sessionStorage.setItem('gocs_sidebar_scroll', String(sidebar.scrollTop));
    };
    sidebar.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(t);
      sidebar.removeEventListener('scroll', onScroll);
    };
  }, [pathname, ready]);

  const { badgeFor, clearBadge, menuCategories, toast, dismissToast } = usePortalAlerts(pathname, ready && Boolean(user));
  const { selectedCompany } = useCompanyFilter();

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
              <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                {selectedCompany ? (
                  <>
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt={companyName}
                        style={{
                          height: 28,
                          maxWidth: 42,
                          objectFit: 'contain',
                          borderRadius: 4,
                          flexShrink: 0,
                          background: '#ffffff',
                          padding: '1px',
                          border: '1px solid rgba(255,255,255,0.15)'
                        }}
                      />
                    ) : null}
                    <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                      {companyName} <span style={{ color: 'var(--primary, #00b8db)', fontWeight: 800 }}>HR</span>
                    </span>
                  </>
                ) : (
                  <>
                    {allBrandLogo ? (
                      <img
                        src={allBrandLogo}
                        alt={allBrandTitle}
                        style={{
                          height: 28,
                          maxWidth: 42,
                          objectFit: 'contain',
                          borderRadius: 4,
                          flexShrink: 0,
                          background: '#ffffff',
                          padding: '1px',
                          border: '1px solid rgba(255,255,255,0.15)',
                        }}
                      />
                    ) : null}
                    <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                      {allBrandTitle}
                    </span>
                    {canEditOrgBrand ? (
                      <button
                        type="button"
                        className="btn secondary"
                        title="Edit All Companies brand"
                        onClick={openBrandEdit}
                        style={{
                          padding: '2px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: 1,
                          minHeight: 0,
                          height: 22,
                          display: 'inline-flex',
                          alignItems: 'center',
                          alignSelf: 'center',
                          flexShrink: 0,
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
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
                <h2>{headerTitle}</h2>
                <p>{headerSubtitle}</p>
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
            <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>Edit All Companies Brand</h3>
            <p className="muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
              Shown in the sidebar when All Companies is selected.
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
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = new FileReader();
                    r.onload = () => setBrandDraft((prev) => ({ ...prev, logoUrl: String(r.result || '') }));
                    r.readAsDataURL(file);
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
