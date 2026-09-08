/** Nav labels use i18n keys; AppShell translates via t(labelKey). */

export const NAV = [
  {
    titleKey: 'nav_overview',
    links: [
      { href: '/dashboard', labelKey: 'nav_dashboard', roles: ['admin'] },
      { href: '/reports', labelKey: 'nav_reports', roles: ['admin'] },
      { href: '/notifications', labelKey: 'nav_notifications', roles: ['admin', 'manager', 'employee'] },
    ],
  },
  {
    titleKey: 'nav_core_hr',
    links: [
      {
        href: '/divisions',
        label: 'Company',
        roles: ['admin'],
        children: [
          { href: '/divisions/management', label: 'Create Company', roles: ['admin'] },
          { href: '/divisions/organisation', label: 'Organisation', roles: ['admin'] },
          { href: '/divisions/structure', label: 'Company Structure', roles: ['admin'] },
        ],
      },
      {
        href: '/employees',
        label: 'Employees',
        roles: ['admin'],
        children: [
          { href: '/employees/create', label: 'Create Employee', roles: ['admin'] },
        ],
      },
      { href: '/masters', label: 'Designations & Types', roles: ['admin'] },
      { href: '/onboarding', label: 'Onboarding', roles: ['admin'] },
      { href: '/recruitment', label: 'Recruitment & ATS', roles: ['admin'] },
      { href: '/exit', label: 'Employee Exit', roles: ['admin'] },
      { href: '/compliance', label: 'Compliance', roles: ['admin'] },
      { href: '/performance', label: 'Performance', roles: ['admin'] },
      { href: '/training', label: 'Training', roles: ['admin'] },
      { href: '/assets', label: 'Assets', roles: ['admin'] },
      { href: '/travel', label: 'Travel & Expense', roles: ['admin', 'manager', 'employee'] },
      { href: '/attendance', labelKey: 'nav_attendance', roles: ['admin', 'manager', 'employee'] },
      { href: '/leave', labelKey: 'nav_leave', roles: ['admin', 'manager', 'employee'] },
      { href: '/certificates', labelKey: 'nav_certificates', roles: ['admin', 'manager', 'employee'] },
      { href: '/payroll', label: 'Payroll', roles: ['admin'] },
      { href: '/approvals', labelKey: 'nav_approvals', roles: ['admin', 'manager'] },
    ],
  },
  {
    titleKey: 'nav_self_service',
    links: [
      { href: '/ess', labelKey: 'nav_ess', roles: ['admin', 'manager', 'employee'] },
      { href: '/mss', labelKey: 'nav_mss', roles: ['admin', 'manager'] },
      { href: '/documents', labelKey: 'nav_documents', roles: ['admin', 'manager', 'employee'] },
    ],
  },
];

/** Match current route to nav link (handles trailing slashes from static export). */
export function isNavActive(pathname, href) {
  const norm = (p) => {
    if (!p) return '';
    let s = p.startsWith('/') ? p : `/${p}`;
    if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
    return s;
  };
  return norm(pathname) === norm(href);
}

function linkRoles(link) {
  return link.roles || ['admin'];
}

export function canAccessPath(pathname, role) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const base = path.split('?')[0];
  // Allow nested employee create etc.
  for (const group of NAV) {
    for (const link of group.links) {
      if (link.href === base || (base.startsWith(`${link.href}/`) && link.href !== '/')) {
        if (linkRoles(link).includes(role)) return true;
      }
      if (link.children) {
        for (const child of link.children) {
          if (child.href === base || base.startsWith(`${child.href}/`)) {
            if (linkRoles(child).includes(role)) return true;
          }
        }
      }
    }
  }
  // Admin can open anything else in the portal
  return role === 'admin';
}

export function navForRole(role) {
  return NAV.map((group) => ({
    ...group,
    links: group.links
      .filter((l) => linkRoles(l).includes(role))
      .map((l) => ({
        ...l,
        children: (l.children || []).filter((c) => linkRoles(c).includes(role)),
      })),
  })).filter((group) => group.links.length > 0);
}

export function navLabel(link, t) {
  if (link.labelKey && t) return t(link.labelKey);
  return link.label || link.labelKey || link.href;
}

export function navGroupTitle(group, t) {
  if (group.titleKey && t) return t(group.titleKey);
  return group.title || group.titleKey || '';
}
