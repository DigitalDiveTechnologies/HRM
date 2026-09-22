/** Nav labels use i18n keys; AppShell translates via t(labelKey).
 * permission = RBAC permission code (Settings → Permissions matrix).
 * Super Admin always sees Settings; other roles filtered by granted permissions.
 */

export const NAV = [
  {
    titleKey: 'nav_overview',
    links: [
      { href: '/dashboard', labelKey: 'nav_dashboard', permission: 'dashboard.view', roles: ['admin'] },
      { href: '/reports', labelKey: 'nav_reports', permission: 'reports.view', roles: ['admin'] },
      { href: '/ops', label: 'Ops & Scale', permission: 'ops.view', roles: ['admin'] },
      { href: '/notifications', labelKey: 'nav_notifications', permission: 'notifications.view', roles: ['admin', 'manager', 'employee'] },
    ],
  },
  {
    titleKey: 'nav_core_hr',
    links: [
      {
        href: '/divisions',
        label: 'Company',
        roles: ['admin'],
        permissions: ['company.create', 'company.organisation', 'company.structure'],
        disabled: true,
        children: [
          { href: '/divisions/management', label: 'Create Company', permission: 'company.create', roles: ['admin'] },
          { href: '/divisions/organisation', label: 'Organisation', permission: 'company.organisation', roles: ['admin'] },
          { href: '/divisions/structure', label: 'Company Structure', permission: 'company.structure', roles: ['admin'] },
        ],
      },
      {
        href: '/employees',
        label: 'Employees',
        permission: 'employees.list',
        roles: ['admin'],
        children: [
          { href: '/employees/create', label: 'Create Employee', permission: 'employees.create', roles: ['admin'] },
        ],
      },
      {
        href: '/masters',
        label: 'Designations & Types',
        permissions: ['masters.designations', 'masters.employment_types'],
        roles: ['admin'],
      },
      { href: '/onboarding', label: 'Onboarding', permission: 'onboarding.view', roles: ['admin'] },
      { href: '/recruitment', label: 'Recruitment & ATS', permission: 'recruitment.view', roles: ['admin'] },
      { href: '/exit', label: 'Employee Exit', permission: 'exit.view', roles: ['admin'] },
      { href: '/compliance', label: 'Compliance', permission: 'compliance.view', roles: ['admin'] },
      { href: '/performance', label: 'Performance', permission: 'performance.view', roles: ['admin', 'manager', 'employee'] },
      { href: '/training', label: 'Training', permission: 'training.view', roles: ['admin', 'manager', 'employee'] },
      { href: '/assets', label: 'Assets', permission: 'assets.view', roles: ['admin'] },
      { href: '/travel', label: 'Travel & Expense', permission: 'travel.view', roles: ['admin', 'manager', 'employee'] },
      { href: '/attendance', labelKey: 'nav_attendance', permission: 'attendance.view', roles: ['admin', 'manager', 'employee'] },
      { href: '/leave', labelKey: 'nav_leave', permission: 'leave.view', roles: ['admin', 'manager', 'employee'] },
      { href: '/certificates', labelKey: 'nav_certificates', permission: 'certificates.view', roles: ['admin', 'manager', 'employee'] },
      { href: '/payroll', label: 'Payroll', permission: 'payroll.view', roles: ['admin'] },
      { href: '/approvals', labelKey: 'nav_approvals', permission: 'approvals.view', roles: ['admin', 'manager'] },
    ],
  },
  {
    titleKey: 'nav_self_service',
    links: [
      { href: '/ess', labelKey: 'nav_ess', permission: 'ess.view', roles: ['admin', 'manager', 'employee'] },
      { href: '/mss', labelKey: 'nav_mss', permission: 'mss.view', roles: ['admin', 'manager'] },
      { href: '/documents', labelKey: 'nav_documents', permission: 'documents.view', roles: ['admin', 'manager', 'employee'] },
    ],
  },
  {
    titleKey: 'nav_settings',
    superAdminOnly: true,
    links: [
      { href: '/settings/users', label: 'Users', roles: ['super_admin'] },
      { href: '/settings/roles', label: 'Roles', roles: ['super_admin'] },
      { href: '/settings/permissions', label: 'Permissions', roles: ['super_admin'] },
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

function linkPermissionCodes(link) {
  if (Array.isArray(link.permissions) && link.permissions.length) return link.permissions;
  if (link.permission) return [link.permission];
  return [];
}

function hasAnyPermission(granted, codes) {
  if (!codes.length) return true;
  const set = new Set((granted || []).map((c) => String(c).toLowerCase()));
  return codes.some((c) => set.has(String(c).toLowerCase()));
}

function linkAllowed(link, role, permissions) {
  if (role === 'super_admin') return true;
  const codes = linkPermissionCodes(link);
  if (permissions && permissions.length && codes.length) {
    return hasAnyPermission(permissions, codes);
  }
  return linkRoles(link).includes(role);
}

export function canAccessPath(pathname, role, permissions) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const base = path.split('?')[0];

  if (role === 'super_admin') {
    if (base.startsWith('/settings')) return true;
    // fall through — still allow all admin paths
  }

  if (base.startsWith('/settings')) {
    return role === 'super_admin';
  }

  for (const group of NAV) {
    if (group.superAdminOnly) continue;
    for (const link of group.links) {
      if (link.href === base || (base.startsWith(`${link.href}/`) && link.href !== '/')) {
        if (linkAllowed(link, role, permissions)) return true;
      }
      if (link.children) {
        for (const child of link.children) {
          if (child.href === base || base.startsWith(`${child.href}/`)) {
            if (linkAllowed(child, role, permissions)) return true;
          }
        }
      }
    }
  }

  // Admin / super_admin can open anything else in the portal
  return role === 'admin' || role === 'super_admin';
}

export function navForRole(role, permissions) {
  return NAV.map((group) => {
    if (group.superAdminOnly) {
      if (role !== 'super_admin') return { ...group, links: [] };
      return { ...group, links: group.links.slice() };
    }
    return {
      ...group,
      links: group.links
        .filter((l) => linkAllowed(l, role, permissions))
        .map((l) => ({
          ...l,
          children: (l.children || []).filter((c) => linkAllowed(c, role, permissions)),
        })),
    };
  }).filter((group) => group.links.length > 0);
}

export function navLabel(link, t) {
  if (link.labelKey && t) return t(link.labelKey);
  return link.label || link.labelKey || link.href;
}

export function navGroupTitle(group, t) {
  if (group.titleKey && t) return t(group.titleKey);
  return group.title || group.titleKey || '';
}

export function hasPermission(permissions, code) {
  if (!code) return true;
  const rolePerms = permissions || [];
  if (!rolePerms.length) return false;
  return rolePerms.map((c) => String(c).toLowerCase()).includes(String(code).toLowerCase());
}
