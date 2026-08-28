import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class EmployeesScreen extends StatefulWidget {
  const EmployeesScreen({super.key});

  @override
  State<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends State<EmployeesScreen> {
  List<dynamic> rows = [];
  List<dynamic> chart = [];
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
      final data = await api.request('/employees');
      List<dynamic> org = const [];
      try {
        org = await api.request('/org/chart') as List<dynamic>;
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        rows = data as List<dynamic>;
        chart = org;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _openDetail(Map<String, dynamic> e) async {
    List<dynamic> history = const [];
    try {
      history = await context.read<AppState>().api.request('/org/history/${e['id']}') as List<dynamic>;
    } catch (_) {}
    if (!mounted) return;
    final name = pick(e, ['fullName', 'full_name']);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                const SizedBox(height: 8),
                Text('${pick(e, ['empCode', 'emp_code'])} · ${pick(e, ['jobTitle', 'job_title'])}'),
                Text(pick(e, ['departmentName', 'department_name'], '-')),
                Text('Manager: ${pick(e, ['managerName', 'manager_name'], '-')}'),
                Text(pick(e, ['email'])),
                Text(pick(e, ['phone'], '-')),
                const SizedBox(height: 8),
                Text('Join: ${formatDate(e['joinDate'] ?? e['join_date'])}'),
                Text('Passport exp: ${formatDate(e['passportExpiry'] ?? e['passport_expiry'])}'),
                Text('Visa exp: ${formatDate(e['visaExpiry'] ?? e['visa_expiry'])}'),
                const SizedBox(height: 12),
                const Text('Employment history', style: TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                if (history.isEmpty) Text('No history.', style: TextStyle(color: T.muted(ctx))),
                ...history.map((raw) {
                  final h = Map<String, dynamic>.from(raw as Map);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(
                      '${pick(h, ['jobTitle', 'job_title'])} · ${formatDate(h['startDate'] ?? h['start_date'])} → ${formatDate(h['endDate'] ?? h['end_date'])}',
                      style: TextStyle(color: T.muted(ctx), fontSize: 13),
                    ),
                  );
                }),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Employees',
            subtitle: 'Profiles, org chart, ID / passport / visa',
            trailing: Icon(Icons.badge_outlined, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (chart.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Org links', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    ...chart.take(12).map((raw) {
                      final n = Map<String, dynamic>.from(raw as Map);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          '${pick(n, ['fullName', 'full_name'])} → ${pick(n, ['managerName', 'manager_name'], '—')}',
                          style: TextStyle(color: T.muted(context), fontSize: 12.5),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
          if (loading) const ScreenLoader(),
          if (!loading && rows.isEmpty) const EmptyHint('No employees found.'),
          ...rows.map((raw) {
            final e = Map<String, dynamic>.from(raw as Map);
            final name = pick(e, ['fullName', 'full_name']);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: InkWell(
                  onTap: () => _openDetail(e),
                  child: Row(
                    children: [
                      InitialsAvatar(name, size: 48),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              '${pick(e, ['empCode', 'emp_code'])} · ${pick(e, ['jobTitle', 'job_title'], '')}',
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                            Text(
                              'Mgr ${pick(e, ['managerName', 'manager_name'], '-')} · Visa ${formatDate(e['visaExpiry'] ?? e['visa_expiry'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 11.5),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(pick(e, ['status'], 'active')),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
