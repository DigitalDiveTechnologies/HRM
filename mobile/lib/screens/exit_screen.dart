import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class ExitScreen extends StatefulWidget {
  const ExitScreen({super.key});

  @override
  State<ExitScreen> createState() => _ExitScreenState();
}

class _ExitScreenState extends State<ExitScreen> {
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
      final data = await api.request('/exit');
      if (!mounted) return;
      setState(() => rows = data as List<dynamic>);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _openChecklist(dynamic caseId) async {
    try {
      final items = await context.read<AppState>().api.request('/exit/$caseId/checklist') as List<dynamic>;
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (ctx) {
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Clearance #$caseId', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  const SizedBox(height: 12),
                  ...items.map((raw) {
                    final c = Map<String, dynamic>.from(raw as Map);
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(pick(c, ['title'])),
                      subtitle: Text(pick(c, ['category'])),
                      trailing: StatusChip(pick(c, ['status'])),
                    );
                  }),
                ],
              ),
            ),
          );
        },
      );
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
            title: 'Employee Exit',
            subtitle: 'Clearance, settlement & offboarding',
            trailing: Icon(Icons.logout_rounded, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const EmptyHint('No exit cases yet.'),
          ...rows.map((raw) {
            final r = Map<String, dynamic>.from(raw as Map);
            final done = pick(r, ['checklistDone', 'checklist_done'], '0');
            final total = pick(r, ['checklistTotal', 'checklist_total'], '0');
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(pick(r, ['fullName', 'full_name']), style: const TextStyle(fontWeight: FontWeight.w800)),
                              Text(
                                '${pick(r, ['exitType', 'exit_type'])} · Last ${formatDate(r['lastWorkingDate'] ?? r['last_working_date'])}',
                                style: TextStyle(color: T.muted(context), fontSize: 12.5),
                              ),
                              Text('Clearance $done/$total', style: TextStyle(color: T.muted(context), fontSize: 12)),
                            ],
                          ),
                        ),
                        StatusChip(pick(r, ['status'])),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: () => _openChecklist(r['id']),
                        icon: const Icon(Icons.checklist_rounded, size: 18),
                        label: const Text('View checklist'),
                      ),
                    ),
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
