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
List<NavGroup> navForRole(String? role, {bool isTeamLead = false}) {
  final items = <NavItem>[
    const NavItem(id: 'ess', label: 'ESS / Home', icon: 'home'),
    if (isTeamLead) const NavItem(id: 'team_approvals', label: 'Team approvals', icon: 'approvals'),
    const NavItem(id: 'leave', label: 'My Leaves', icon: 'leave'),
    const NavItem(id: 'certificates', label: 'Certificates', icon: 'certificates'),
    const NavItem(id: 'attendance', label: 'My Attendance', icon: 'attendance'),
    const NavItem(id: 'payslips', label: 'My Payslips', icon: 'payslips'),
    const NavItem(id: 'notifications', label: 'Notifications', icon: 'alerts'),
    const NavItem(id: 'documents', label: 'My Documents', icon: 'documents'),
    const NavItem(id: 'directory', label: 'Directory', icon: 'directory'),
    const NavItem(id: 'profile', label: 'Profile', icon: 'profile'),
  ];
  return [
    NavGroup(title: 'Self Service', items: items),
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
