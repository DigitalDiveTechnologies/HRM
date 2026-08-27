import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class TravelScreen extends StatefulWidget {
  const TravelScreen({super.key});

  @override
  State<TravelScreen> createState() => _TravelScreenState();
}

class _TravelScreenState extends State<TravelScreen> {
  List<dynamic> travel = [];
  List<dynamic> expenses = [];
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
      final t = await api.request('/travel/requests');
      final x = await api.request('/travel/expenses');
      if (!mounted) return;
      setState(() {
        travel = t as List<dynamic>;
        expenses = x as List<dynamic>;
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
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          const PageHero(
            title: 'Travel & Expense',
            subtitle: 'Trips and expense claims',
            trailing: Icon(Icons.flight_takeoff_outlined, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading) ...[
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Text('Travel', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (travel.isEmpty) const EmptyHint('No travel requests.'),
            ...travel.map((raw) {
              final t = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pick(t, ['destination']), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              '${pick(t, ['fullName', 'full_name'])} · ${formatDate(t['startDate'] ?? t['start_date'])} → ${formatDate(t['endDate'] ?? t['end_date'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                            Text(
                              money(t['estimatedCost'] ?? t['estimated_cost']),
                              style: TextStyle(color: T.muted(context), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(pick(t, ['status'])),
                    ],
                  ),
                ),
              );
            }),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Expenses', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            if (expenses.isEmpty) const EmptyHint('No expense claims.'),
            ...expenses.map((raw) {
              final x = Map<String, dynamic>.from(raw as Map);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(pick(x, ['title']), style: const TextStyle(fontWeight: FontWeight.w800)),
                            Text(
                              '${pick(x, ['fullName', 'full_name'])} · ${pick(x, ['category'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 12.5),
                            ),
                            Text(
                              '${money(x['amount'])} · ${formatDate(x['expenseDate'] ?? x['expense_date'])}',
                              style: TextStyle(color: T.muted(context), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(pick(x, ['status'])),
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
