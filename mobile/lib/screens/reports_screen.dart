import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  Map<String, dynamic>? data;
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
      final res = await api.request('/reports') as Map<String, dynamic>;
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
    final attrition = data?['attrition'] is Map ? Map<String, dynamic>.from(data!['attrition'] as Map) : <String, dynamic>{};
    final byDept = (data?['headcountByDepartment'] as List<dynamic>?) ??
        (data?['headcount_by_department'] as List<dynamic>?) ??
        [];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          const PageHero(
            title: 'Reports',
            subtitle: 'Headcount, attrition and payroll insights',
            trailing: Icon(Icons.insights_rounded, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading && data != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      MetricTile(
                        label: 'Exits',
                        value: '${attrition['exits'] ?? attrition['exitCount'] ?? 0}',
                        icon: Icons.trending_down_rounded,
                        color: AppColors.danger,
                      ),
                      const SizedBox(width: 10),
                      MetricTile(
                        label: 'Rate',
                        value: '${attrition['rate'] ?? attrition['attritionRate'] ?? '-'}',
                        icon: Icons.percent_rounded,
                        color: AppColors.warn,
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Headcount by department',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  if (byDept.isEmpty) const EmptyHint('No department data.'),
                  ...byDept.map((raw) {
                    final d = Map<String, dynamic>.from(raw as Map);
                    final label = pick(d, ['departmentName', 'department_name', 'name', 'label']);
                    final count = pick(d, ['count', 'headcount', 'value'], '0');
                    return SectionCard(
                      child: Row(
                        children: [
                          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700))),
                          Text(count, style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.accent)),
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
