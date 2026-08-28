import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../nav/app_nav.dart';
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
  List<dynamic> employees = [];
  bool loading = true;
  String? error;
  String? msg;

  String employeeId = '';
  String exitType = 'resignation';
  String reason = '';
  String noticeDate = todayIso();
  String lastWorkingDate = todayIso();
  String settlementNotes = '';

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
      final emps = await api.request('/employees');
      if (!mounted) return;
      setState(() {
        rows = data as List<dynamic>;
        employees = emps as List<dynamic>;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _create() async {
    if (employeeId.isEmpty) {
      setState(() => error = 'Select an employee.');
      return;
    }
    setState(() {
      error = null;
      msg = null;
    });
    try {
      await context.read<AppState>().api.request(
            '/exit',
            method: 'POST',
            body: {
              'employeeId': int.parse(employeeId),
              'exitType': exitType,
              'reason': reason,
              'noticeDate': noticeDate,
              'lastWorkingDate': lastWorkingDate,
              'settlementNotes': settlementNotes.isEmpty ? null : settlementNotes,
            },
          );
      setState(() {
        msg = 'Exit case opened.';
        employeeId = '';
        reason = '';
        settlementNotes = '';
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => error = e.message);
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
            child: StatefulBuilder(
              builder: (ctx, setSheet) {
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Clearance #$caseId', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                      const SizedBox(height: 12),
                      ...items.map((raw) {
                        final c = Map<String, dynamic>.from(raw as Map);
                        final done = pick(c, ['status']).toLowerCase() == 'done';
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(pick(c, ['title'])),
                          subtitle: Text(pick(c, ['category'])),
                          trailing: done
                              ? StatusChip(pick(c, ['status']))
                              : TextButton(
                                  onPressed: () async {
                                    try {
                                      await context.read<AppState>().api.request(
                                            '/exit/checklist/${c['id']}',
                                            method: 'PATCH',
                                            body: {'status': 'done'},
                                          );
                                      if (!mounted) return;
                                      c['status'] = 'done';
                                      setSheet(() {});
                                      await _load();
                                    } on ApiException catch (e) {
                                      if (!mounted) return;
                                      setState(() => error = e.message);
                                      if (ctx.mounted) Navigator.pop(ctx);
                                    }
                                  },
                                  child: const Text('Done'),
                                ),
                        );
                      }),
                    ],
                  ),
                );
              },
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
    final isAdmin = normalizeRole(context.watch<AppState>().user?.role) == 'admin';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
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
          if (msg != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(msg!, style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w600)),
            ),
          if (isAdmin)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: FormSpacedColumn(
                  children: [
                    Text('Open exit case', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    DropdownButtonFormField<String>(
                      initialValue: employeeId.isEmpty ? null : employeeId,
                      decoration: const InputDecoration(labelText: 'Employee'),
                      items: employees
                          .map((raw) {
                            final e = Map<String, dynamic>.from(raw as Map);
                            return DropdownMenuItem(value: '${e['id']}', child: Text(pick(e, ['fullName', 'full_name'])));
                          })
                          .toList(),
                      onChanged: (v) => setState(() => employeeId = v ?? ''),
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: exitType,
                      decoration: const InputDecoration(labelText: 'Exit type'),
                      items: const [
                        DropdownMenuItem(value: 'resignation', child: Text('Resignation')),
                        DropdownMenuItem(value: 'termination', child: Text('Termination')),
                        DropdownMenuItem(value: 'end_of_contract', child: Text('End of contract')),
                      ],
                      onChanged: (v) => setState(() => exitType = v ?? 'resignation'),
                    ),
                    TextFormField(decoration: const InputDecoration(labelText: 'Reason'), onChanged: (v) => reason = v),
                    Row(
                      children: [
                        Expanded(child: TextFormField(initialValue: noticeDate, decoration: const InputDecoration(labelText: 'Notice'), onChanged: (v) => noticeDate = v)),
                        const SizedBox(width: 8),
                        Expanded(child: TextFormField(initialValue: lastWorkingDate, decoration: const InputDecoration(labelText: 'Last day'), onChanged: (v) => lastWorkingDate = v)),
                      ],
                    ),
                    TextFormField(decoration: const InputDecoration(labelText: 'Settlement notes'), onChanged: (v) => settlementNotes = v),
                    FilledButton(onPressed: _create, child: const Text('Open case')),
                  ],
                ),
              ),
            ),
          if (loading) const ScreenLoader(),
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
                        label: const Text('Checklist'),
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
