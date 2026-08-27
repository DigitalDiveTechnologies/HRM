import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav/app_nav.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/ui_kit.dart';
import 'approvals_screen.dart';
import 'attendance_screen.dart';
import 'dashboard_screen.dart';
import 'directory_screen.dart';
import 'documents_screen.dart';
import 'employees_screen.dart';
import 'ess_screen.dart';
import 'leave_screen.dart';
import 'notifications_screen.dart';
import 'payroll_screen.dart';
import 'payslips_screen.dart';
import 'profile_screen.dart';
import 'reports_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late String route;

  @override
  void initState() {
    super.initState();
    final role = context.read<AppState>().user?.role;
    route = homeRouteForRole(role);
  }

  String _titleFor(String id) {
    for (final g in navForRole(context.read<AppState>().user?.role)) {
      for (final i in g.items) {
        if (i.id == id) return i.label;
      }
    }
    return 'Digital Dive HR';
  }

  String _subtitleFor(String id, String role) {
    final r = normalizeRole(role);
    switch (id) {
      case 'dashboard':
        return 'Workforce overview and key HR metrics';
      case 'employees':
        return 'Profiles, org info, ID / passport / visa';
      case 'attendance':
        return r == 'employee' ? 'Your punches and late minutes' : 'Team attendance records';
      case 'leave':
        return r == 'employee' ? 'Your leave requests' : 'Leave requests and balances';
      case 'payroll':
        return 'Salary, OT, allowances, WPS refs';
      case 'approvals':
        return 'Leave, document and onboarding approvals';
      case 'reports':
        return 'Headcount, attrition and payroll insights';
      case 'ess':
        return 'Employee self-service';
      case 'payslips':
        return 'Your salary history · ${DateTime.now().year}';
      case 'documents':
        return 'Contracts, passport, Emirates ID, visa';
      case 'directory':
        return 'Find teammates across Digital Dive';
      case 'notifications':
        return 'Visa, contract, birthday & more';
      case 'profile':
        return 'Your account details';
      default:
        return 'Digital Dive HR';
    }
  }

  Widget _pageFor(String id) {
    switch (id) {
      case 'dashboard':
        return const DashboardScreen();
      case 'employees':
        return const EmployeesScreen();
      case 'attendance':
        return const AttendanceScreen();
      case 'leave':
        return const LeaveScreen();
      case 'payroll':
        return const PayrollScreen();
      case 'approvals':
        return const ApprovalsScreen();
      case 'reports':
        return const ReportsScreen();
      case 'ess':
        return const EssScreen();
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

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final user = app.user!;
    final role = normalizeRole(user.role);
    final groups = navForRole(user.role);

    return Scaffold(
      backgroundColor: T.bg(context),
      appBar: AppBar(
        leading: Builder(
          builder: (ctx) => IconButton(
            tooltip: 'Open menu',
            onPressed: () => Scaffold.of(ctx).openDrawer(),
            icon: const Icon(Icons.menu_rounded),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_titleFor(route), style: Theme.of(context).appBarTheme.titleTextStyle),
            Text(
              _subtitleFor(route, user.role),
              style: TextStyle(fontSize: 11.5, color: T.muted(context), fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Toggle theme',
            onPressed: () => app.toggleTheme(),
            icon: Icon(
              app.themeMode == ThemeMode.dark ? Icons.dark_mode_rounded : Icons.wb_sunny_rounded,
              color: T.ink(context),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: T.isDark(context) ? 0.18 : 0.1),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
                ),
                child: Text(
                  '${user.fullName?.split(' ').first ?? 'User'} · $role',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: T.ink(context),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      drawer: _PortalDrawer(
        groups: groups,
        activeId: route,
        userName: user.fullName ?? user.email,
        role: role,
        onSelect: (id) {
          setState(() => route = id);
          Navigator.of(context).pop();
        },
        onLogout: () {
          Navigator.of(context).pop();
          app.logout();
        },
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 200),
        child: KeyedSubtree(
          key: ValueKey(route),
          child: _pageFor(route),
        ),
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
