import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav/app_nav.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/ui_kit.dart';
import 'payslips_screen.dart';

/// ESS hub — employees see payslips + quick info; admin/manager see same self-service entry.
class EssScreen extends StatelessWidget {
  const EssScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AppState>().user!;
    final role = normalizeRole(user.role);

    if (user.employeeId != null) {
      return const PayslipsScreen();
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const PageHero(
          title: 'ESS Portal',
          subtitle: 'Employee self-service',
          trailing: Icon(Icons.home_rounded, color: Colors.white, size: 34),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Signed in as ${user.fullName ?? user.email}',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
                const SizedBox(height: 6),
                Text(
                  'Role: $role',
                  style: TextStyle(color: T.muted(context)),
                ),
                const SizedBox(height: 12),
                Text(
                  user.employeeId == null
                      ? 'No employee profile is linked to this account. Use Attendance, Leave, Payroll, and Approvals from the menu for HR operations.'
                      : 'Open My Payslips from the menu for salary history.',
                  style: TextStyle(color: T.muted(context), height: 1.4),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
