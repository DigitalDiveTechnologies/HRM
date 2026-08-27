export const NAV = [
  {
    title: 'Overview',
    links: [
      { href: '/dashboard', label: 'Dashboard', roles: ['admin', 'manager'] },
      { href: '/reports', label: 'Reports & Analytics', roles: ['admin', 'manager'] },
      { href: '/notifications', label: 'Notifications', roles: ['admin', 'manager', 'employee'] },
      { href: '/approvals', label: 'Approvals', roles: ['admin', 'manager'] },
    ],
  },
  {
    title: 'Core HR',
    links: [
      { href: '/employees', label: 'Employees', roles: ['admin'] },
      { href: '/onboarding', label: 'Onboarding', roles: ['admin'] },
      { href: '/attendance', label: 'Attendance', roles: ['admin', 'manager', 'employee'] },
      { href: '/leave', label: 'Leave', roles: ['admin', 'manager', 'employee'] },
      { href: '/payroll', label: 'Payroll', roles: ['admin'] },
    ],
  },
  {
    title: 'Self Service',
    links: [
      { href: '/ess', label: 'ESS Portal', roles: ['admin', 'manager', 'employee'] },
      { href: '/documents', label: 'Documents', roles: ['admin', 'manager'] },
    ],
  },
];

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
