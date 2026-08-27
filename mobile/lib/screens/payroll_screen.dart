import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class PayrollScreen extends StatefulWidget {
  const PayrollScreen({super.key});

  @override
  State<PayrollScreen> createState() => _PayrollScreenState();
}

class _PayrollScreenState extends State<PayrollScreen> {
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
      final data = await api.request('/payroll');
      if (!mounted) return;
      setState(() => rows = data as List<dynamic>);
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
          PageHero(
            title: 'Payroll',
            subtitle: 'Salary, OT, allowances · ${currencyCode()}',
            trailing: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const EmptyHint('No payroll records.'),
          ...rows.map((raw) {
            final p = Map<String, dynamic>.from(raw as Map);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            pick(p, ['fullName', 'full_name']),
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                          ),
                        ),
                        Text(
                          money(p['netPay'] ?? p['net_pay']),
                          style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.accent),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${pick(p, ['periodLabel', 'period_label'])} · WPS ${pick(p, ['wpsRef', 'wps_ref'], '-')}',
                      style: TextStyle(color: T.muted(context), fontSize: 12.5),
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
