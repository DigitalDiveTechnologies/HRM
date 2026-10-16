import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? data;
  String? error;
  bool loading = true;
  List<Map<String, dynamic>> companyLinks = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    final api = context.read<AppState>().api;
    try {
      final res = await api.request('/dashboard') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => data = res);
      try {
        final linksRes = await api.request('/company-links');
        if (linksRes is List && mounted) {
          setState(() {
            companyLinks = linksRes.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          });
        }
      } catch (_) {}
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final recent = (data?['recentAttendance'] as List<dynamic>?) ?? [];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Dashboard',
            subtitle: 'Workforce overview and key HR metrics',
            trailing: Icon(Icons.dashboard_rounded, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const ScreenLoader(),
          if (!loading && data != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  Row(
                    children: [
                      MetricTile(
                        label: 'Headcount',
                        value: '${data!['headcount'] ?? 0}',
                        icon: Icons.groups_outlined,
                      ),
                      const SizedBox(width: 10),
                      MetricTile(
                        label: 'Pending leave',
                        value: '${data!['pendingLeave'] ?? 0}',
                        icon: Icons.beach_access_outlined,
                        color: AppColors.warn,
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      MetricTile(
                        label: 'Docs expiring',
                        value: '${data!['expiringDocs'] ?? 0}',
                        icon: Icons.folder_outlined,
                        color: AppColors.danger,
                      ),
                      const SizedBox(width: 10),
                      MetricTile(
                        label: 'Unread alerts',
                        value: '${data!['unreadNotifications'] ?? 0}',
                        icon: Icons.notifications_outlined,
                      ),
                    ],
                  ),
                  if (companyLinks.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Corporate Quick Links',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: companyLinks.map((link) {
                        return InkWell(
                          onTap: () => _showLinkDialog(context, link),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: Theme.of(context).cardColor,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: T.line(context)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(_getLinkIcon(link['iconKey'] ?? link['icon_key']), size: 18, color: AppColors.accent),
                                const SizedBox(width: 8),
                                Text(
                                  link['title'] ?? 'Link',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                                ),
                                const SizedBox(width: 6),
                                const Icon(Icons.open_in_new_rounded, size: 12, color: Colors.grey),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Recent attendance',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (recent.isEmpty) const EmptyHint('No recent attendance.'),
                  ...recent.map((raw) {
                    final r = Map<String, dynamic>.from(raw as Map);
                    return SectionCard(
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  pick(r, ['fullName', 'full_name']),
                                  style: const TextStyle(fontWeight: FontWeight.w800),
                                ),
                                Text(
                                  '${formatDate(r['workDate'] ?? r['work_date'])} · Late ${formatLate(r['lateMinutes'] ?? r['late_minutes'])}',
                                  style: TextStyle(color: T.muted(context), fontSize: 12.5),
                                ),
                              ],
                            ),
                          ),
                          StatusChip(pick(r, ['status'])),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
        ],
      ),
    );
  }
  IconData _getLinkIcon(String? key) {
    switch ((key ?? '').toLowerCase()) {
      case 'globe': return Icons.language_rounded;
      case 'shield': return Icons.verified_user_rounded;
      case 'mail': return Icons.mail_outline_rounded;
      case 'heart':
      case 'activity': return Icons.favorite_border_rounded;
      case 'life-buoy': return Icons.support_agent_rounded;
      case 'book': return Icons.menu_book_rounded;
      case 'award': return Icons.school_outlined;
      default: return Icons.open_in_new_rounded;
    }
  }

  void _showLinkDialog(BuildContext context, Map<String, dynamic> link) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Icon(_getLinkIcon(link['iconKey'] ?? link['icon_key']), color: AppColors.accent),
            const SizedBox(width: 8),
            Expanded(child: Text(link['title'] ?? 'Corporate Link', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(link['category'] ?? 'General', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.accent, fontSize: 12)),
            const SizedBox(height: 8),
            SelectableText(
              link['url'] ?? '',
              style: const TextStyle(color: Colors.blueAccent, fontSize: 13, decoration: TextDecoration.underline),
            ),
            const SizedBox(height: 12),
            const Text(
              'Authorized internal portal link. Copy or open in your browser.',
              style: TextStyle(fontSize: 11.5, color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }
}
