import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../utils/format.dart';

IconData navIcon(String key) {
  switch (key) {
    case 'dashboard':
      return Icons.dashboard_outlined;
    case 'approvals':
      return Icons.fact_check_outlined;
    case 'reports':
      return Icons.insights_outlined;
    case 'employees':
      return Icons.badge_outlined;
    case 'attendance':
      return Icons.schedule_outlined;
    case 'leave':
      return Icons.beach_access_outlined;
    case 'payroll':
    case 'payslips':
      return Icons.account_balance_wallet_outlined;
    case 'ess':
    case 'home':
      return Icons.home_outlined;
    case 'documents':
      return Icons.folder_outlined;
    case 'directory':
      return Icons.groups_outlined;
    case 'alerts':
      return Icons.notifications_none_rounded;
    case 'profile':
      return Icons.person_outline_rounded;
    default:
      return Icons.circle_outlined;
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) {
    final s = status.toLowerCase();
    Color bg;
    Color fg;
    if (['approved', 'done', 'present', 'ok', 'active', 'valid', 'paid', 'read'].contains(s)) {
      bg = AppColors.ok.withValues(alpha: 0.14);
      fg = AppColors.ok;
    } else if (['pending', 'late', 'onboarding', 'new'].contains(s)) {
      bg = AppColors.warn.withValues(alpha: 0.14);
      fg = AppColors.warn;
    } else if (['rejected', 'leave', 'exited', 'danger'].contains(s)) {
      bg = AppColors.danger.withValues(alpha: 0.14);
      fg = AppColors.danger;
    } else {
      bg = AppColors.accent.withValues(alpha: 0.12);
      fg = AppColors.accent;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(status, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}

class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar(this.name, {super.key, this.size = 48});
  final String? name;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [AppColors.accentDeep, AppColors.accent, AppColors.accentGlow],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Text(
        initials(name),
        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: size * 0.34),
      ),
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin = const EdgeInsets.only(bottom: 12),
  });
  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: T.surface(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: T.cardBorder(context)),
        boxShadow: T.isDark(context)
            ? null
            : [
                BoxShadow(
                  color: const Color(0xFF0B1B33).withValues(alpha: 0.06),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
      ),
      child: child,
    );
  }
}

class PageHero extends StatelessWidget {
  const PageHero({
    super.key,
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 14),
      padding: const EdgeInsets.fromLTRB(20, 20, 18, 20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          colors: T.isDark(context)
              ? const [Color(0xFF03142C), Color(0xFF0A3550), Color(0xFF02607A)]
              : const [Color(0xFF023047), Color(0xFF0369A1), Color(0xFF00B8DB)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                Text(
                  subtitle,
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.88), fontSize: 13.5, height: 1.35),
                ),
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

class EmptyHint extends StatelessWidget {
  const EmptyHint(this.text, {super.key, this.icon = Icons.inbox_outlined});
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(36),
      child: Column(
        children: [
          Icon(icon, size: 40, color: T.muted(context)),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center, style: TextStyle(color: T.muted(context))),
        ],
      ),
    );
  }
}

class MetricTile extends StatelessWidget {
  const MetricTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color = AppColors.accent,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: T.isDark(context) ? 0.18 : 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 10),
            Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 12, color: T.muted(context))),
          ],
        ),
      ),
    );
  }
}
