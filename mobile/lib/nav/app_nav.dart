/// Role-based navigation — mirrors Digital Dive HR portal menus.
library;

class NavItem {
  const NavItem({
    required this.id,
    required this.label,
    required this.icon,
  });

  final String id;
  final String label;
  final String icon; // Material icon name key
}

class NavGroup {
  const NavGroup({required this.title, required this.items});
  final String title;
  final List<NavItem> items;
}

/// Normalize JWT / DB role. Boss uses admin-level access.
String normalizeRole(String? role) {
  final r = (role ?? 'employee').toLowerCase().trim();
  if (r == 'boss' || r == 'hr_admin' || r == 'hr-admin') return 'admin';
  if (r == 'admin' || r == 'manager' || r == 'employee') return r;
  return 'employee';
}

String homeRouteForRole(String? role) {
  switch (normalizeRole(role)) {
    case 'manager':
      return 'approvals';
    case 'employee':
      return 'ess';
    default:
      return 'dashboard';
  }
}

List<NavGroup> navForRole(String? role) {
  final r = normalizeRole(role);

  if (r == 'employee') {
    return const [
      NavGroup(
        title: 'Self Service',
        items: [
          NavItem(id: 'ess', label: 'ESS / Home', icon: 'home'),
          NavItem(id: 'leave', label: 'My Leaves', icon: 'leave'),
          NavItem(id: 'attendance', label: 'My Attendance', icon: 'attendance'),
          NavItem(id: 'payslips', label: 'My Payslips', icon: 'payslips'),
          NavItem(id: 'notifications', label: 'Notifications', icon: 'alerts'),
          NavItem(id: 'directory', label: 'Directory', icon: 'directory'),
          NavItem(id: 'profile', label: 'Profile', icon: 'profile'),
        ],
      ),
    ];
  }

  if (r == 'manager') {
    return const [
      NavGroup(
        title: 'Overview',
        items: [
          NavItem(id: 'dashboard', label: 'Dashboard', icon: 'dashboard'),
          NavItem(id: 'mss', label: 'MSS', icon: 'mss'),
          NavItem(id: 'approvals', label: 'Approvals', icon: 'approvals'),
          NavItem(id: 'reports', label: 'Reports', icon: 'reports'),
        ],
      ),
      NavGroup(
        title: 'Core HR',
        items: [
          NavItem(id: 'attendance', label: 'Attendance', icon: 'attendance'),
          NavItem(id: 'leave', label: 'Leave', icon: 'leave'),
          NavItem(id: 'recruitment', label: 'Recruitment', icon: 'recruitment'),
          NavItem(id: 'exit', label: 'Exit', icon: 'exit'),
          NavItem(id: 'compliance', label: 'Compliance', icon: 'compliance'),
          NavItem(id: 'performance', label: 'Performance', icon: 'performance'),
          NavItem(id: 'training', label: 'Training', icon: 'training'),
          NavItem(id: 'assets', label: 'Assets', icon: 'assets'),
          NavItem(id: 'travel', label: 'Travel', icon: 'travel'),
        ],
      ),
      NavGroup(
        title: 'Self Service',
        items: [
          NavItem(id: 'ess', label: 'ESS', icon: 'ess'),
          NavItem(id: 'documents', label: 'Documents', icon: 'documents'),
          NavItem(id: 'directory', label: 'Directory', icon: 'directory'),
        ],
      ),
    ];
  }

  // Admin / Boss — full menu
  return const [
    NavGroup(
      title: 'Overview',
      items: [
        NavItem(id: 'dashboard', label: 'Dashboard', icon: 'dashboard'),
        NavItem(id: 'mss', label: 'MSS', icon: 'mss'),
        NavItem(id: 'approvals', label: 'Approvals', icon: 'approvals'),
        NavItem(id: 'reports', label: 'Reports', icon: 'reports'),
      ],
    ),
    NavGroup(
      title: 'Core HR',
      items: [
        NavItem(id: 'employees', label: 'Employees', icon: 'employees'),
        NavItem(id: 'recruitment', label: 'Recruitment', icon: 'recruitment'),
        NavItem(id: 'exit', label: 'Exit', icon: 'exit'),
        NavItem(id: 'compliance', label: 'Compliance', icon: 'compliance'),
        NavItem(id: 'performance', label: 'Performance', icon: 'performance'),
        NavItem(id: 'training', label: 'Training', icon: 'training'),
        NavItem(id: 'assets', label: 'Assets', icon: 'assets'),
        NavItem(id: 'travel', label: 'Travel', icon: 'travel'),
        NavItem(id: 'attendance', label: 'Attendance', icon: 'attendance'),
        NavItem(id: 'leave', label: 'Leave', icon: 'leave'),
        NavItem(id: 'payroll', label: 'Payroll', icon: 'payroll'),
      ],
    ),
    NavGroup(
      title: 'Self Service',
      items: [
        NavItem(id: 'ess', label: 'ESS', icon: 'ess'),
        NavItem(id: 'documents', label: 'Documents', icon: 'documents'),
        NavItem(id: 'directory', label: 'Directory', icon: 'directory'),
      ],
    ),
  ];
}
