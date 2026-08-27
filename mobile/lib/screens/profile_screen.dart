import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav/app_nav.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/ui_kit.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final user = app.user!;
    final role = normalizeRole(user.role);

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const PageHero(
          title: 'Profile',
          subtitle: 'Your account details',
          trailing: Icon(Icons.person_rounded, color: Colors.white, size: 34),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SectionCard(
            child: Column(
              children: [
                InitialsAvatar(user.fullName ?? user.email, size: 72),
                const SizedBox(height: 14),
                Text(
                  user.fullName ?? 'Employee',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20),
                ),
                const SizedBox(height: 4),
                Text(user.email, style: TextStyle(color: T.muted(context))),
                const SizedBox(height: 16),
                _row(context, 'Role', role),
                _row(context, 'Job title', user.jobTitle ?? '-'),
                _row(context, 'Employee ID', user.employeeId?.toString() ?? '-'),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => app.logout(),
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('Logout'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(child: Text(label, style: TextStyle(color: T.muted(context)))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
