import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
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
    final api = context.read<AppState>().api;
    try {
      final data = await api.request('/approvals');
      if (!mounted) return;
      setState(() => rows = data as List<dynamic>);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _setStatus(dynamic id, String status) async {
    final api = context.read<AppState>().api;
    try {
      await api.request('/approvals/$id', method: 'PATCH', body: {'status': status});
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          const PageHero(
            title: 'Approvals',
            subtitle: 'Leave, document and onboarding approvals',
            trailing: Icon(Icons.fact_check_rounded, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const EmptyHint('No approvals pending.'),
          ...rows.map((raw) {
            final a = Map<String, dynamic>.from(raw as Map);
            final status = pick(a, ['status']);
            final pending = status.toLowerCase() == 'pending';
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(pick(a, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                        ),
                        StatusChip(status),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${pick(a, ['requestType', 'request_type'])} · ${pick(a, ['fullName', 'full_name'], '-')}',
                      style: TextStyle(color: T.muted(context), fontSize: 12.5),
                    ),
                    Text(
                      'L${pick(a, ['levelNo', 'level_no'])} · ${pick(a, ['approverRole', 'approver_role'])}',
                      style: TextStyle(color: T.muted(context), fontSize: 12),
                    ),
                    if (pending) ...[
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: () => _setStatus(a['id'], 'approved'),
                              child: const Text('Approve'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => _setStatus(a['id'], 'rejected'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.danger,
                                side: const BorderSide(color: AppColors.danger),
                                minimumSize: const Size.fromHeight(48),
                              ),
                              child: const Text('Reject'),
                            ),
                          ),
                        ],
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
