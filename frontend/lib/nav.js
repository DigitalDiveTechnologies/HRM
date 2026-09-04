export const NAV = [
  {
    title: 'Overview',
    links: [
      { href: '/dashboard', label: 'Dashboard', roles: ['admin'] },
      { href: '/reports', label: 'Reports & Analytics', roles: ['admin'] },
      { href: '/notifications', label: 'Notifications', roles: ['admin'] },
      { href: '/help', label: 'Help & Manuals', roles: ['admin'] },
    ],
  },
  {
    title: 'Core HR',
    links: [
      { href: '/divisions', label: 'Company', roles: ['admin'] },
      { href: '/employees', label: 'Employees', roles: ['admin'] },
      { href: '/approvals', label: 'Approvals', roles: ['admin'] },
      { href: '/masters', label: 'Designations & Types', roles: ['admin'] },
      { href: '/onboarding', label: 'Onboarding', roles: ['admin'] },
      { href: '/recruitment', label: 'Recruitment & ATS', roles: ['admin'] },
      { href: '/exit', label: 'Employee Exit', roles: ['admin'] },
      { href: '/compliance', label: 'Compliance', roles: ['admin'] },
      { href: '/performance', label: 'Performance', roles: ['admin'] },
      { href: '/training', label: 'Training', roles: ['admin'] },
      { href: '/assets', label: 'Assets', roles: ['admin'] },
      { href: '/travel', label: 'Travel & Expense', roles: ['admin'] },
      { href: '/attendance', label: 'Attendance', roles: ['admin'] },
      { href: '/leave', label: 'Leave', roles: ['admin'] },
      { href: '/certificates', label: 'Certificates', roles: ['admin'] },
      { href: '/payroll', label: 'Payroll', roles: ['admin'] },
    ],
  },
  {
    title: 'Self Service',
    links: [
      { href: '/ess', label: 'ESS Portal', roles: ['admin'] },
      { href: '/documents', label: 'Documents', roles: ['admin'] },
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
    }
  }
  return role === 'admin';
}

export function navForRole(role) {
  return NAV.map((group) => ({
    ...group,
    links: group.links.filter((l) => (l.roles || ['admin']).includes(role)),
  })).filter((group) => group.links.length > 0);
}
