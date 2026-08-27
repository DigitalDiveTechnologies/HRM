import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

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
      setState(() => rows = data as List<dynamic>);
    } on ApiException catch (e) {
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

  @override
  Widget build(BuildContext context) {
    final unread = rows.where((raw) {
      final n = Map<String, dynamic>.from(raw as Map);
      return !(n['isRead'] == true || n['is_read'] == true);
    }).length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 110),
        children: [
          PageHero(
            title: 'Alerts',
            subtitle: unread == 0 ? 'You’re all caught up' : '$unread unread · visa, contract & more',
            trailing: const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 36),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const EmptyHint('You are all caught up.', icon: Icons.notifications_none_rounded),
          ...rows.map((raw) {
            final n = Map<String, dynamic>.from(raw as Map);
            final read = n['isRead'] == true || n['is_read'] == true;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: read
                                  ? [AppColors.ok.withValues(alpha: 0.15), AppColors.ok.withValues(alpha: 0.08)]
                                  : [AppColors.accent.withValues(alpha: 0.18), AppColors.accentGlow.withValues(alpha: 0.14)],
                            ),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(
                            read ? Icons.mark_email_read_rounded : Icons.mark_email_unread_rounded,
                            color: read ? AppColors.ok : AppColors.accent,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(pick(n, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                              Text(
                                '${pick(n, ['category'])} · Due ${formatDate(n['dueDate'] ?? n['due_date'])}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        StatusChip(read ? 'Read' : 'New'),
                      ],
                    ),
                    if (pick(n, ['message'], '').isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text(pick(n, ['message'], ''), style: Theme.of(context).textTheme.bodyMedium),
                    ],
                    if (!read) ...[
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          onPressed: () => _markRead(n['id']),
                          icon: const Icon(Icons.done_all_rounded, size: 18),
                          label: const Text('Mark read'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
