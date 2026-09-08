import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/ui_kit.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final user = app.user!;
    final l10n = L10n(app.locale);

    return ListView(
      padding: screenListPadding(context),
      children: [
        PageHero(
          title: l10n.t('profile_title'),
          subtitle: l10n.t('profile_subtitle'),
          trailing: const Icon(Icons.person_rounded, color: Colors.white, size: 34),
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
                _row(context, l10n.t('category'), user.jobTitle ?? 'Employee'),
                _row(context, l10n.t('employee_id'), user.employeeId?.toString() ?? '-'),
                const SizedBox(height: 8),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.t('language')),
                  subtitle: Text(app.locale == 'ar' ? l10n.t('arabic') : l10n.t('english')),
                  trailing: FilledButton.tonal(
                    onPressed: () => app.toggleLocale(),
                    child: Text(app.locale == 'ar' ? 'EN' : 'ع'),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => app.logout(),
                  icon: const Icon(Icons.logout_rounded),
                  label: Text(l10n.t('logout')),
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
