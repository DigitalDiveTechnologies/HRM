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
}
