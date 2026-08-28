import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class PayslipsScreen extends StatefulWidget {
  const PayslipsScreen({super.key});

  @override
  State<PayslipsScreen> createState() => _PayslipsScreenState();
}

class _PayslipsScreenState extends State<PayslipsScreen> {
  List<dynamic> slips = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final user = context.read<AppState>().user;
    if (user?.employeeId == null) {
      setState(() {
        error = 'No employee profile linked.';
        loading = false;
      });
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await context.read<AppState>().api.request('/ess/${user!.employeeId}') as Map<String, dynamic>;
      setState(() => slips = (data['payslips'] as List<dynamic>? ?? []));
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final latest = slips.isNotEmpty ? Map<String, dynamic>.from(slips.first as Map) : null;
    final latestPay = latest == null ? null : money(latest['netPay'] ?? latest['net_pay']);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          PageHero(
            title: 'Payslips',
            subtitle: 'Your salary history · ${currencyCode()}',
            trailing: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 36),
          ),
          if (latestPay != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: SectionCard(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Latest net pay', style: Theme.of(context).textTheme.bodySmall),
                          const SizedBox(height: 6),
                          Text(
                            latestPay,
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.8,
                              color: T.ink(context),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            pick(latest!, ['periodLabel', 'period_label']),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [AppColors.accentDeep, AppColors.accent]),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(Icons.payments_rounded, color: Colors.white, size: 28),
                    ),
                  ],
                ),
              ),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const ScreenLoader(),
          if (!loading && slips.isEmpty) const EmptyHint('No payslips yet.', icon: Icons.receipt_long_outlined),
          ...slips.map((raw) {
            final p = Map<String, dynamic>.from(raw as Map);
            final amount = money(p['netPay'] ?? p['net_pay']);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                padding: EdgeInsets.zero,
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () {},
                  child: Row(
                    children: [
                      Container(
                        width: 6,
                        height: 96,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [AppColors.accentDeep, AppColors.accent],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                          borderRadius: BorderRadius.horizontal(left: Radius.circular(20)),
                        ),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(14, 16, 16, 16),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      pick(p, ['periodLabel', 'period_label']),
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'WPS ${pick(p, ['wpsRef', 'wps_ref'], '-')}',
                                      style: Theme.of(context).textTheme.bodySmall,
                                    ),
                                    const SizedBox(height: 10),
                                    const StatusChip('Paid'),
                                  ],
                                ),
                              ),
                              Text(
                                amount,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 17,
                                  color: AppColors.accent,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
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
