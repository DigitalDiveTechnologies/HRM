export const NAV = [
  {
    title: 'Overview',
    links: [
      { href: '/dashboard', label: 'Dashboard', roles: ['admin'] },
      { href: '/mss', label: 'Manager Self-Service', roles: ['admin'] },
      { href: '/reports', label: 'Reports & Analytics', roles: ['admin'] },
      { href: '/notifications', label: 'Notifications', roles: ['admin'] },
      { href: '/approvals', label: 'Approvals', roles: ['admin'] },
    ],
  },
  {
    title: 'Core HR',
    links: [
      { href: '/employees', label: 'Employees', roles: ['admin'] },
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
