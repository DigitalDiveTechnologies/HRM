/// Role-based navigation — employee self-service on mobile app only.
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

String normalizeRole(String? role) {
  final r = (role ?? 'employee').toLowerCase().trim();
  if (r == 'boss' || r == 'hr_admin' || r == 'hr-admin') return 'admin';
  if (r == 'admin' || r == 'manager' || r == 'employee') return r;
  return 'employee';
}

/// Mobile app — employees only (admin uses web portal).
bool canUseMobileApp(String? role) => normalizeRole(role) != 'admin';

String homeRouteForRole(String? role) => 'ess';

/// Employee ESS menu for all app users (manager is a job category, not a separate app role).
List<NavGroup> navForRole(String? role) {
  return const [
    NavGroup(
      title: 'Self Service',
      items: [
        NavItem(id: 'ess', label: 'ESS / Home', icon: 'home'),
        NavItem(id: 'leave', label: 'My Leaves', icon: 'leave'),
        NavItem(id: 'attendance', label: 'My Attendance', icon: 'attendance'),
        NavItem(id: 'payslips', label: 'My Payslips', icon: 'payslips'),
        NavItem(id: 'notifications', label: 'Notifications', icon: 'alerts'),
        NavItem(id: 'documents', label: 'My Documents', icon: 'documents'),
        NavItem(id: 'directory', label: 'Directory', icon: 'directory'),
        NavItem(id: 'profile', label: 'Profile', icon: 'profile'),
      ],
    ),
  ];
}

/// Label shown in app chrome — prefer job title over login role.
String userDisplayLabel({String? fullName, String? email, String? jobTitle, String? role}) {
  final name = (fullName != null && fullName.trim().isNotEmpty) ? fullName.trim() : (email ?? '');
  final category = (jobTitle != null && jobTitle.trim().isNotEmpty)
      ? jobTitle.trim()
      : 'Employee';
  return '$name · $category';
}
