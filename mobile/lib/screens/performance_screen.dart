import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class PerformanceScreen extends StatefulWidget {
  const PerformanceScreen({super.key});

  @override
  State<PerformanceScreen> createState() => _PerformanceScreenState();
}

class _PerformanceScreenState extends State<PerformanceScreen> {
  List<dynamic> goals = [];
  List<dynamic> reviews = [];
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
      final g = await api.request('/performance/goals');
      final r = await api.request('/performance/reviews');
      if (!mounted) return;
      setState(() {
        goals = g as List<dynamic>;
        reviews = r as List<dynamic>;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          const PageHero(
            title: 'Performance',
            subtitle: 'Goals, KPIs and reviews',
            trailing: Icon(Icons.emoji_events_outlined, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const ScreenLoader(),
          if (!loading) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Text('Goals', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (goals.isEmpty) const EmptyHint('No goals yet.'),
            ...goals.map((raw) {
              final g = Map<String, dynamic>.from(raw as Map);
              final progress = pick(g, ['progressPct', 'progress_pct'], '0');
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
                                Text(pick(g, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                                Text(
                                  '${pick(g, ['fullName', 'full_name'])} · ${pick(g, ['periodLabel', 'period_label'], '-')}',
                                  style: TextStyle(color: T.muted(context), fontSize: 12.5),
                                ),
                                Text(
                                  'KPI ${pick(g, ['kpi'], '-')} · Target ${pick(g, ['targetValue', 'target_value'], '-')}',
                                  style: TextStyle(color: T.muted(context), fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          StatusChip(pick(g, ['status'])),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text('$progress%', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                      const SizedBox(height: 4),
                      LinearProgressIndicator(
                        value: ((double.tryParse(progress) ?? 0) / 100).clamp(0, 1),
                        minHeight: 6,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ],
                  ),
                ),
              );
            }),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Reviews', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (reviews.isEmpty) const EmptyHint('No reviews yet.'),
            ...reviews.map((raw) {
              final r = Map<String, dynamic>.from(raw as Map);
              final type = pick(r, ['reviewType', 'review_type']).replaceAll('_', ' ');
              final summary = pick(r, ['summary'], '');
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
                                  '$type · ${pick(r, ['reviewerName', 'reviewer_name'], '—')} · Rating ${pick(r, ['rating'], '-')}',
                                  style: TextStyle(color: T.muted(context), fontSize: 12.5),
                                ),
                                Text(
                                  formatDate(r['reviewDate'] ?? r['review_date']),
                                  style: TextStyle(color: T.muted(context), fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          StatusChip(pick(r, ['status'])),
                        ],
                      ),
                      if (summary.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(summary, style: TextStyle(color: T.muted(context), fontSize: 12.5)),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
