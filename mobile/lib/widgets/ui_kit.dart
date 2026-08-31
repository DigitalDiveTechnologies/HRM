import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../utils/format.dart';

/// Standard vertical gap between form inputs, dropdowns, date fields, and actions.
const double kFormFieldSpacing = 12;

/// Shorthand — place between consecutive form controls.
const Widget formFieldGap = SizedBox(height: kFormFieldSpacing);

/// Column that inserts [kFormFieldSpacing] between every child (forms, dropdowns, buttons).
class FormSpacedColumn extends StatelessWidget {
  const FormSpacedColumn({
    super.key,
    required this.children,
    this.spacing = kFormFieldSpacing,
    this.crossAxisAlignment = CrossAxisAlignment.stretch,
  });

  final List<Widget> children;
  final double spacing;
  final CrossAxisAlignment crossAxisAlignment;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();
    final spaced = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) spaced.add(SizedBox(height: spacing));
      spaced.add(children[i]);
    }
    return Column(
      crossAxisAlignment: crossAxisAlignment,
      children: spaced,
    );
  }
}

/// Bottom inset for scrollable screens — clears the solid footer chrome.
EdgeInsets screenListPadding(BuildContext context, {double extra = 16}) {
  return EdgeInsets.only(bottom: extra);
}

/// Centered list loader — stays in content area, not over the footer chrome.
class ScreenLoader extends StatelessWidget {
  const ScreenLoader({super.key, this.padding = 40});

  final double padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: padding, horizontal: 24),
      child: const Center(
        child: CircularProgressIndicator(color: AppColors.accent),
      ),
    );
  }
}

/// Solid footer strip matching the top header — blocks loader bleed at system nav.
class AppBottomChrome extends StatelessWidget {
  const AppBottomChrome({super.key});

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewPaddingOf(context).bottom;
    final bg = T.bg(context);
    return ColoredBox(
      color: bg,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: bg,
          border: Border(top: BorderSide(color: T.line(context))),
        ),
        padding: EdgeInsets.only(bottom: bottom),
      ),
    );
  }
}

IconData navIcon(String key) {
  switch (key) {
    case 'dashboard':
      return Icons.dashboard_outlined;
    case 'mss':
      return Icons.supervisor_account_outlined;
    case 'approvals':
      return Icons.fact_check_outlined;
    case 'reports':
      return Icons.insights_outlined;
    case 'employees':
      return Icons.badge_outlined;
    case 'onboarding':
      return Icons.rocket_launch_outlined;
    case 'recruitment':
      return Icons.person_search_outlined;
    case 'exit':
      return Icons.logout_outlined;
    case 'compliance':
      return Icons.verified_user_outlined;
    case 'performance':
      return Icons.emoji_events_outlined;
    case 'training':
      return Icons.school_outlined;
    case 'assets':
      return Icons.devices_other_outlined;
    case 'travel':
      return Icons.flight_takeoff_outlined;
    case 'attendance':
      return Icons.schedule_outlined;
    case 'leave':
      return Icons.beach_access_outlined;
    case 'certificates':
      return Icons.description_outlined;
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
    final label = switch (s) {
      'pending_manager' => 'Pending manager',
      'pending_hr' => 'Pending HR',
      _ => status,
    };
    Color bg;
    Color fg;
    if (['approved', 'done', 'present', 'ok', 'active', 'valid', 'paid', 'read', 'compliant', 'closed', 'completed', 'submitted', 'acknowledged', 'available', 'assigned', 'issued'].contains(s)) {
      bg = AppColors.ok.withValues(alpha: 0.14);
      fg = AppColors.ok;
    } else if (['pending', 'late', 'onboarding', 'new', 'due_soon', 'open', 'draft', 'in_progress', 'pending_manager', 'pending_hr'].contains(s)) {
      bg = AppColors.warn.withValues(alpha: 0.14);
      fg = AppColors.warn;
    } else if (['rejected', 'leave', 'exited', 'danger', 'overdue', 'cancelled', 'expired', 'revoked', 'archived', 'retired', 'lost'].contains(s)) {
      bg = AppColors.danger.withValues(alpha: 0.14);
      fg = AppColors.danger;
    } else {
      bg = AppColors.accent.withValues(alpha: 0.12);
      fg = AppColors.accent;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w700)),
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
          color: T.surface(context),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: T.cardBorder(context)),
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

/// Matches portal chrome: 6px corners + cyan outline (not a pill).
const double kNavChromeRadius = 6;

Color _navChromeBorder(BuildContext context) =>
    AppColors.accent.withValues(alpha: T.isDark(context) ? 0.45 : 0.55);

/// Cyan count badge — matches app accent / menu chrome.
class AlertCountBadge extends StatelessWidget {
  const AlertCountBadge({
    super.key,
    required this.count,
    this.compact = false,
    this.onActiveBackground = false,
  });

  final int count;
  final bool compact;
  final bool onActiveBackground;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();

    final label = count > 99 ? '99+' : '$count';
    final height = compact ? 18.0 : 20.0;
    final minWidth = compact ? 18.0 : 20.0;
    final fontSize = compact ? 10.0 : 11.0;
    final hPad = compact ? 4.0 : 5.0;

    final bg = onActiveBackground ? Colors.white : AppColors.accentDeep;
    final fg = onActiveBackground ? AppColors.accentDeep : Colors.white;
    final borderColor = onActiveBackground ? Colors.white : AppColors.accentGlow;

    return Container(
      constraints: BoxConstraints(minWidth: minWidth, minHeight: height),
      padding: EdgeInsets.symmetric(horizontal: hPad),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(height / 2),
        border: Border.all(color: borderColor, width: 1.2),
        boxShadow: onActiveBackground
            ? null
            : [
                BoxShadow(
                  color: AppColors.accent.withValues(alpha: 0.35),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: fontSize,
          fontWeight: FontWeight.w800,
          height: 1,
        ),
      ),
    );
  }
}

/// Hamburger — cyan fill, larger white icon (less inner padding).
class NavMenuButton extends StatelessWidget {
  const NavMenuButton({
    super.key,
    required this.onPressed,
    this.badgeCount = 0,
  });

  final VoidCallback onPressed;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Material(
          color: AppColors.accent,
          borderRadius: BorderRadius.circular(kNavChromeRadius),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(kNavChromeRadius),
            child: const SizedBox(
              width: 40,
              height: 40,
              child: Icon(Icons.menu, color: Colors.white, size: 28),
            ),
          ),
        ),
        if (badgeCount > 0)
          Positioned(
            right: -6,
            top: -6,
            child: AlertCountBadge(count: badgeCount, compact: true),
          ),
      ],
    );
  }
}

/// Theme toggle — outlined square box (portal `.theme-toggle` / image 2).
class NavThemeButton extends StatelessWidget {
  const NavThemeButton({super.key, required this.isDark, required this.onPressed});

  final bool isDark;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: T.surface(context),
      borderRadius: BorderRadius.circular(kNavChromeRadius),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(kNavChromeRadius),
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(kNavChromeRadius),
            border: Border.all(color: _navChromeBorder(context)),
          ),
          child: Icon(
            isDark ? Icons.dark_mode_outlined : Icons.wb_sunny_outlined,
            size: 20,
            color: T.ink(context),
          ),
        ),
      ),
    );
  }
}

/// User chip — cyan border, 6px radius (not pill). Portal `.user-chip`.
class NavUserChip extends StatelessWidget {
  const NavUserChip({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: T.surface(context),
        borderRadius: BorderRadius.circular(kNavChromeRadius),
        border: Border.all(color: _navChromeBorder(context)),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          color: T.ink(context),
        ),
      ),
    );
  }
}

/// Mobile top bar — sits below the system status bar (SafeArea / viewPadding).
class AppTopBar extends StatelessWidget implements PreferredSizeWidget {
  const AppTopBar({
    super.key,
    required this.title,
    required this.userLabel,
    required this.isDark,
    required this.onOpenMenu,
    required this.onToggleTheme,
    this.topInset = 0,
    this.menuBadgeCount = 0,
  });

  final String title;
  final String userLabel;
  final bool isDark;
  final VoidCallback onOpenMenu;
  final VoidCallback onToggleTheme;

  /// Status-bar / notch inset from [MediaQuery.viewPadding.top].
  final double topInset;
  final int menuBadgeCount;

  static const double contentHeight = 104;

  @override
  Size get preferredSize => Size.fromHeight(contentHeight + topInset);

  @override
  Widget build(BuildContext context) {
    final titleStyle = Theme.of(context).appBarTheme.titleTextStyle ??
        TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 18,
          color: T.ink(context),
        );

    return Material(
      color: T.bg(context),
      elevation: 0,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(height: topInset),
          SizedBox(
            height: contentHeight,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      NavMenuButton(
                        onPressed: onOpenMenu,
                        badgeCount: menuBadgeCount,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: titleStyle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      NavThemeButton(isDark: isDark, onPressed: onToggleTheme),
                    ],
                  ),
                  const SizedBox(height: 8),
                  NavUserChip(label: userLabel),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
