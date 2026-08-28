import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav/app_nav.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> rows = [];
  bool loading = true;
  String? error;
  String? msg;

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
    try {
      final data = await context.read<AppState>().api.request('/notifications');
      if (!mounted) return;
      setState(() => rows = data as List<dynamic>);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _markRead(dynamic id) async {
    try {
      await context.read<AppState>().api.request('/notifications/$id/read', method: 'PATCH', body: {});
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  Future<void> _generate() async {
    try {
      final res = await context.read<AppState>().api.request('/notifications/generate', method: 'POST', body: {});
      final inserted = res is Map ? (res['inserted'] ?? 0) : 0;
      setState(() => msg = 'Generated $inserted alerts');
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = normalizeRole(context.watch<AppState>().user?.role) == 'admin';
    final unread = rows.where((raw) {
      final n = Map<String, dynamic>.from(raw as Map);
      return !(n['isRead'] == true || n['is_read'] == true);
    }).length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          PageHero(
            title: 'Alerts',
            subtitle: unread == 0 ? 'You’re all caught up' : '$unread unread · visa, contract & more',
            trailing: const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 36),
          ),
          if (isAdmin)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: FilledButton(onPressed: _generate, child: const Text('Run alert generator')),
            ),
          if (msg != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(msg!, style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w600)),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const ScreenLoader(),
          if (!loading && rows.isEmpty) const EmptyHint('You are all caught up.', icon: Icons.notifications_none_rounded),
          ...rows.map((raw) {
            final n = Map<String, dynamic>.from(raw as Map);
            final read = n['isRead'] == true || n['is_read'] == true;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(pick(n, ['title']), style: TextStyle(fontWeight: read ? FontWeight.w500 : FontWeight.w800)),
                  subtitle: Text(
                    '${pick(n, ['category'])} · due ${formatDate(n['dueDate'] ?? n['due_date'])}',
                    style: TextStyle(color: T.muted(context), fontSize: 12.5),
                  ),
                  trailing: read
                      ? const StatusChip('read')
                      : TextButton(onPressed: () => _markRead(n['id']), child: const Text('Mark read')),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
