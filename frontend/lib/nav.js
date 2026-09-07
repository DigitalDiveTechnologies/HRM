export const NAV = [
  {
    title: 'Overview',
    links: [
      { href: '/dashboard', label: 'Dashboard', roles: ['admin'] },
      { href: '/reports', label: 'Reports & Analytics', roles: ['admin'], disabled: true },
      { href: '/notifications', label: 'Notifications', roles: ['admin'], disabled: true },
    ],
  },
  {
    title: 'Core HR',
    links: [
      {
        href: '/divisions',
        label: 'Company',
        roles: ['admin'],
        children: [
          { href: '/divisions/management', label: 'Create Company', roles: ['admin'] },
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
      { href: '/onboarding', label: 'Onboarding', roles: ['admin'], disabled: true },
      { href: '/recruitment', label: 'Recruitment & ATS', roles: ['admin'], disabled: true },
      { href: '/exit', label: 'Employee Exit', roles: ['admin'], disabled: true },
      { href: '/compliance', label: 'Compliance', roles: ['admin'], disabled: true },
      { href: '/performance', label: 'Performance', roles: ['admin'], disabled: true },
      { href: '/training', label: 'Training', roles: ['admin'], disabled: true },
      { href: '/assets', label: 'Assets', roles: ['admin'], disabled: true },
      { href: '/travel', label: 'Travel & Expense', roles: ['admin'], disabled: true },
      { href: '/attendance', label: 'Attendance', roles: ['admin'], disabled: true },
      { href: '/leave', label: 'Leave', roles: ['admin'], disabled: true },
      { href: '/certificates', label: 'Certificates', roles: ['admin'], disabled: true },
      { href: '/payroll', label: 'Payroll', roles: ['admin'], disabled: true },
    ],
  },
  {
    title: 'Self Service',
    links: [
      { href: '/ess', label: 'ESS Portal', roles: ['admin'], disabled: true },
      { href: '/documents', label: 'Documents', roles: ['admin'], disabled: true },
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

export function canAccessPath(pathname, role) {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  for (const group of NAV) {
    for (const link of group.links) {
      if (link.href === path) return (link.roles || ['admin']).includes(role);
      if (link.children) {
        for (const child of link.children) {
          if (child.href === path) return (child.roles || ['admin']).includes(role);
        }
      }
    }
  }
  return role === 'admin';
}

export function navForRole(role) {
  return NAV.map((group) => ({
    ...group,
    links: group.links
      .filter((l) => (l.roles || ['admin']).includes(role))
      .map((l) => ({
        ...l,
        children: (l.children || []).filter((c) => (c.roles || ['admin']).includes(role)),
      })),
  })).filter((group) => group.links.length > 0);
}
