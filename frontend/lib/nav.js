/** Nav labels use i18n keys; AppShell translates via t(labelKey).
 * permission = RBAC permission code (Settings → Permissions matrix).
 * Super Admin always sees Settings; other roles filtered by granted permissions.
 */

/** When false, Settings → Users / Roles are hidden and routes are blocked. */
export const SETTINGS_USERS_ROLES_ENABLED = true;

export const NAV = [
  {
    titleKey: 'nav_overview',
    links: [
      { href: '/dashboard', labelKey: 'nav_dashboard', permission: 'dashboard.view', roles: ['admin', 'manager', 'employee'] },
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
        children: [
          { href: '/divisions/management', label: 'Create Company', permission: 'company.create', roles: ['admin'] },
          {
            href: '/divisions/organisation',
            label: 'Organisation',
            permissions: [
              'company.organisation',
              'company.org.entities',
              'company.org.branches',
              'company.org.positions',
              'company.org.assignments',
              'company.org.headcount',
            ],
            roles: ['admin'],
          },
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
        roles: ['admin', 'manager', 'employee'],
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
    settingsSection: true,
    links: [
      // Temporarily disabled — re-enable by setting SETTINGS_USERS_ROLES_ENABLED = true
      ...(SETTINGS_USERS_ROLES_ENABLED
        ? [
            { href: '/settings/users', label: 'Users', roles: ['super_admin', 'admin'] },
            { href: '/settings/roles', label: 'Roles', roles: ['super_admin', 'admin'] },
          ]
        : []),
      { href: '/settings/permissions', label: 'Permissions', roles: ['super_admin', 'admin'] },
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
  // Dashboard is the default home for every portal role
  if (link.href === '/dashboard') return true;
  const codes = linkPermissionCodes(link);
  const childAllowed = Array.isArray(link.children) && link.children.some((c) => linkAllowed(c, role, permissions));

  if (permissions && permissions.length) {
    if (codes.length && hasAnyPermission(permissions, codes)) return true;
    if (childAllowed) return true;
    if (codes.length) return false;
  }
  if (childAllowed) return true;
  // No permission matrix grants → fall back to role allow-list on the link
  if (permissions && permissions.length && !codes.length) {
    return false;
  }
  return linkRoles(link).includes(role);
}

export function canAccessPath(pathname, role, permissions) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const base = path.split('?')[0].replace(/\/$/, '') || '/';
  const r = String(role || '').toLowerCase();
  const grants = Array.isArray(permissions) ? permissions : [];

  // Super Admin: full portal
  if (r === 'super_admin') return true;

  if (base.startsWith('/settings')) {
    if (!SETTINGS_USERS_ROLES_ENABLED && (base === '/settings/users' || base === '/settings/roles')) {
      return false;
    }
    return r === 'admin';
  }

  // Empty-permission landing + default home — any signed-in role may open these
  if (base === '/no-access' || base === '/dashboard') return true;

  for (const group of NAV) {
    if (group.settingsSection) continue;
    for (const link of group.links) {
      if (link.href === base || (base.startsWith(`${link.href}/`) && link.href !== '/')) {
        if (linkAllowed(link, r, grants)) return true;
      }
      if (link.children) {
        for (const child of link.children) {
          if (child.href === base || base.startsWith(`${child.href}/`)) {
            if (linkAllowed(child, r, grants)) return true;
          }
        }
      }
    }
  }

  // Company / divisions (opened from dashboard; may not be a top-level nav row)
  if (base === '/divisions' || base.startsWith('/divisions/')) {
    if (grants.length) {
      return canUseAnyPermission(r, grants, [
        'company.create',
        'company.organisation',
        'company.structure',
        'company.org.entities',
        'company.org.branches',
        'company.org.positions',
        'company.org.assignments',
        'company.org.headcount',
      ]);
    }
    return r === 'admin';
  }

  // Role has an explicit permission matrix → only granted paths (already matched above)
  if (grants.length) return false;

  // Legacy full Admin (no matrix rows) keeps full portal
  return r === 'admin';
}

/** Prefer Dashboard for every role (same as admin). Fall back to first granted page. */
export function firstAllowedPath(role, permissions) {
  const seen = new Set();
  const candidates = [];
  const push = (href) => {
    if (!href || seen.has(href)) return;
    seen.add(href);
    candidates.push(href);
  };

  // Always land on Dashboard first when the role can open it (every portal role can)
  push('/dashboard');

  if (role === 'manager') {
    ['/mss', '/approvals', '/leave', '/attendance', '/notifications'].forEach(push);
  } else if (role === 'employee') {
    ['/ess', '/leave', '/attendance', '/documents', '/notifications'].forEach(push);
  } else {
    ['/notifications', '/employees', '/payroll'].forEach(push);
  }

  for (const group of NAV) {
    if (group.settingsSection) continue;
    for (const link of group.links) {
      push(link.href);
      for (const child of link.children || []) push(child.href);
    }
  }

  for (const href of candidates) {
    if (canAccessPath(href, role, permissions)) return href;
  }
  return null;
}

export function navForRole(role, permissions) {
  return NAV.map((group) => {
    if (group.settingsSection) {
      if (role !== 'super_admin' && role !== 'admin') return { ...group, links: [] };
      return { ...group, links: group.links.slice() };
    }
    return {
      ...group,
      links: group.links
        .filter((l) => linkAllowed(l, role, permissions))
        .map((l) => {
          const allowedChildren = (l.children || []).filter((c) => linkAllowed(c, role, permissions));
          const parentDirectlyAllowed = hasAnyPermission(permissions, linkPermissionCodes(l)) || role === 'super_admin';
          if (!parentDirectlyAllowed && allowedChildren.length === 1) {
            return {
              ...l,
              ...allowedChildren[0],
              children: [],
            };
          }
          return {
            ...l,
            children: allowedChildren,
          };
        }),
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

/**
 * Feature gate for page widgets (same rules as sidebar links).
 * - super_admin: always
 * - role with granted permissions list: must include code
 * - admin with empty grants: full access (legacy / full admin)
 * - other roles with empty grants: deny
 */
export function canUsePermission(role, permissions, code) {
  if (!code) return true;
  const r = String(role || '').toLowerCase();
  if (r === 'super_admin') return true;
  if (permissions && permissions.length) {
    return hasPermission(permissions, code);
  }
  return r === 'admin';
}

export function canUseAnyPermission(role, permissions, codes) {
  const list = Array.isArray(codes) ? codes : [codes];
  return list.some((c) => canUsePermission(role, permissions, c));
}
