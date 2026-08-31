import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../brand.dart';
import '../nav/app_nav.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/ui_kit.dart';
import 'assets_screen.dart';
import 'approvals_screen.dart';
import 'attendance_screen.dart';
import 'certificate_screen.dart';
import 'compliance_screen.dart';
import 'dashboard_screen.dart';
import 'directory_screen.dart';
import 'documents_screen.dart';
import 'employees_screen.dart';
import 'ess_screen.dart';
import 'exit_screen.dart';
import 'leave_screen.dart';
import 'mss_screen.dart';
import 'notifications_screen.dart';
import 'onboarding_screen.dart';
import 'payroll_screen.dart';
import 'payslips_screen.dart';
import 'performance_screen.dart';
import 'profile_screen.dart';
import 'recruitment_screen.dart';
import 'reports_screen.dart';
import 'team_approvals_screen.dart';
import 'training_screen.dart';
import 'travel_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late String route;
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final Set<String> _visited = {};
  final Map<String, Widget> _pageCache = {};

  @override
  void initState() {
    super.initState();
    final role = context.read<AppState>().user?.role;
    route = homeRouteForRole(role);
    _visited.add(route);
  }

  String _titleFor(String id) {
    final app = context.read<AppState>();
    for (final g in navForRole(app.user?.role, isTeamLead: app.isTeamLead)) {
      for (final i in g.items) {
        if (i.id == id) return i.label;
      }
    }
    return Brand.shellTitle;
  }

  Widget _pageFor(String id) {
    switch (id) {
      case 'dashboard':
        return const DashboardScreen();
      case 'mss':
        return const MssScreen();
      case 'employees':
        return const EmployeesScreen();
      case 'onboarding':
        return const OnboardingScreen();
      case 'recruitment':
        return const RecruitmentScreen();
      case 'exit':
        return const ExitScreen();
      case 'compliance':
        return const ComplianceScreen();
      case 'performance':
        return const PerformanceScreen();
      case 'training':
        return const TrainingScreen();
      case 'assets':
        return const AssetsScreen();
      case 'travel':
        return const TravelScreen();
      case 'attendance':
        return const AttendanceScreen();
      case 'leave':
        return const LeaveScreen();
      case 'certificates':
        return const CertificateScreen();
      case 'team_approvals':
        return const TeamApprovalsScreen();
      case 'payroll':
        return const PayrollScreen();
      case 'approvals':
        return const ApprovalsScreen();
      case 'reports':
        return const ReportsScreen();
      case 'ess':
        return EssScreen(onNavigate: _openRoute);
      case 'payslips':
        return const PayslipsScreen();
      case 'documents':
        return const DocumentsScreen();
      case 'directory':
        return const DirectoryScreen();
      case 'notifications':
        return const NotificationsScreen();
      case 'profile':
        return const ProfileScreen();
      default:
        return const DashboardScreen();
    }
  }

  Widget _cachedPage(String id) {
    return _pageCache.putIfAbsent(
      id,
      () => KeyedSubtree(key: ValueKey('page-$id'), child: _pageFor(id)),
    );
  }

  void _openRoute(String id) {
    setState(() {
      route = id;
      _visited.add(id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final user = app.user!;
    final groups = navForRole(user.role, isTeamLead: app.isTeamLead);
    final userLabel = userDisplayLabel(
      fullName: user.fullName,
      email: user.email,
      jobTitle: user.jobTitle,
      role: user.role,
    );

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: T.bg(context),
      appBar: AppTopBar(
        title: _titleFor(route),
        userLabel: userLabel,
        isDark: app.themeMode == ThemeMode.dark,
        topInset: MediaQuery.viewPaddingOf(context).top,
        onOpenMenu: () => _scaffoldKey.currentState?.openDrawer(),
        onToggleTheme: () => app.toggleTheme(),
      ),
      drawer: _PortalDrawer(
        groups: groups,
        activeId: route,
        userName: user.fullName ?? user.email,
        role: user.jobTitle ?? 'Employee',
        onSelect: (id) {
          _openRoute(id);
          Navigator.of(context).pop();
        },
        onLogout: () {
          Navigator.of(context).pop();
          app.logout();
        },
      ),
      // Keep visited screens alive — menu switch pe dubara API load/spinner nahi.
      body: Column(
        children: [
          Expanded(
            child: SafeArea(
              bottom: false,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  for (final id in _visited)
                    Offstage(
                      offstage: id != route,
                      child: TickerMode(
                        enabled: id == route,
                        child: _cachedPage(id),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const AppBottomChrome(),
        ],
      ),
    );
  }
}

class _PortalDrawer extends StatelessWidget {
  const _PortalDrawer({
    required this.groups,
    required this.activeId,
    required this.userName,
    required this.role,
    required this.onSelect,
    required this.onLogout,
  });

  final List<NavGroup> groups;
  final String activeId;
  final String userName;
  final String role;
  final ValueChanged<String> onSelect;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: T.sidebarBg(context),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 8, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        RichText(
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: T.isDark(context) ? Colors.white : AppColors.lightText,
                            ),
                            children: const [
                              TextSpan(text: 'Digital '),
                              TextSpan(
                                text: 'Dive',
                                style: TextStyle(color: AppColors.accent),
                              ),
                              TextSpan(text: ' HR'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'HR Portal · Mobile',
                          style: TextStyle(fontSize: 12, color: T.sidebarMuted(context)),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close menu',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: Icon(Icons.close_rounded, color: T.sidebarText(context)),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: T.sidebarHover(context),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: T.sidebarBorder(context)),
                ),
                child: Row(
                  children: [
                    InitialsAvatar(userName, size: 40),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            userName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: T.sidebarText(context),
                            ),
                          ),
                          Text(
                            role,
                            style: TextStyle(fontSize: 12, color: T.sidebarMuted(context)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Divider(height: 1, color: T.sidebarBorder(context)),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                children: [
                  for (final group in groups) ...[
                    Padding(
                      padding: const EdgeInsets.fromLTRB(10, 8, 10, 6),
                      child: Text(
                        group.title.toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.6,
                          color: T.sidebarMuted(context),
                        ),
                      ),
                    ),
                    for (final item in group.items)
                      _DrawerTile(
                        label: item.label,
                        icon: navIcon(item.icon),
                        active: item.id == activeId,
                        onTap: () => onSelect(item.id),
                      ),
                    const SizedBox(height: 6),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: FilledButton(
                onPressed: onLogout,
                child: const Text('Logout'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerTile extends StatelessWidget {
  const _DrawerTile({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: active ? AppColors.accent : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          hoverColor: T.sidebarHover(context),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: active ? Colors.white : T.sidebarText(context),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                      color: active ? Colors.white : T.sidebarText(context),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
