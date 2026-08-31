import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../brand.dart';
import '../services/api_client.dart';
import '../services/biometric_auth.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

/// Unified ESS home — attendance punch, leave balances, payslip preview, quick actions.
class EssScreen extends StatefulWidget {
  const EssScreen({super.key, this.onNavigate});

  final ValueChanged<String>? onNavigate;

  @override
  State<EssScreen> createState() => _EssScreenState();
}

class _EssScreenState extends State<EssScreen> {
  final _biometric = BiometricAuthService();

  bool loading = true;
  bool punching = false;
  String? error;
  String? punchMsg;

  Map<String, dynamic>? ess;
  List<dynamic> balances = [];
  List<dynamic> attendance = [];

  bool mockFingerprint = kIsWeb || defaultTargetPlatform == TargetPlatform.windows;
  bool hardwareAvailable = false;

  @override
  void initState() {
    super.initState();
    _load();
    _probeHardware();
  }

  Future<void> _probeHardware() async {
    final ok = await _biometric.hasHardware;
    if (!mounted) return;
    setState(() {
      hardwareAvailable = ok;
      if (ok) mockFingerprint = false;
    });
  }

  Future<void> _load() async {
    final user = context.read<AppState>().user;
    final employeeId = user?.employeeId;
    if (employeeId == null) {
      setState(() {
        loading = false;
        error = 'No employee profile linked to this account.';
      });
      return;
    }

    setState(() {
      loading = true;
      error = null;
    });

    final api = context.read<AppState>().api;
    try {
      final results = await Future.wait([
        api.request('/ess/$employeeId'),
        api.request('/leave/balances'),
      ]);
      final essData = Map<String, dynamic>.from(results[0] as Map);
      final bal = results[1] as List<dynamic>;
      final att = (essData['attendance'] as List<dynamic>? ?? []);
      final myBal = bal.where((raw) {
        final r = Map<String, dynamic>.from(raw as Map);
        final id = r['employeeId'] ?? r['employee_id'];
        return id == null || id.toString() == employeeId.toString();
      }).toList();

      if (!mounted) return;
      setState(() {
        ess = essData;
        balances = myBal;
        attendance = att;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) {
        setState(() => loading = false);
        await context.read<AppState>().refreshTeamLead();
      }
    }
  }

  String _nowHm() {
    final n = DateTime.now();
    return '${n.hour.toString().padLeft(2, '0')}:${n.minute.toString().padLeft(2, '0')}';
  }

  String? _todayCheckIn() {
    final today = todayIso();
    for (final raw in attendance) {
      final r = Map<String, dynamic>.from(raw as Map);
      final date = formatDate(r['workDate'] ?? r['work_date']);
      if (date == today) {
        final cin = pick(r, ['checkIn', 'check_in'], '');
        if (cin.isNotEmpty && cin != '-') {
          return cin.length >= 5 ? cin.substring(0, 5) : cin;
        }
      }
    }
    return null;
  }

  Future<void> _punch({required bool isCheckIn}) async {
    final user = context.read<AppState>().user!;
    if (user.employeeId == null) return;

    setState(() {
      punching = true;
      punchMsg = null;
      error = null;
    });

    final ok = await _biometric.authenticateForAttendance(
      context: context,
      useMockWhenUnavailable: mockFingerprint,
    );
    if (!mounted) return;
    if (!ok) {
      setState(() {
        punching = false;
        error = 'Fingerprint verification failed';
      });
      return;
    }

    final now = _nowHm();
    final body = <String, dynamic>{
      'employeeId': user.employeeId,
      'workDate': todayIso(),
      'status': 'present',
      'overtimeHours': 0,
      'checkIn': isCheckIn ? now : (_todayCheckIn() ?? '09:00'),
      'checkOut': isCheckIn ? null : now,
    };

    try {
      await context.read<AppState>().api.request('/attendance', method: 'POST', body: body);
      if (!mounted) return;
      setState(() {
        punchMsg = isCheckIn ? 'Checked in at $now' : 'Checked out at $now';
        punching = false;
      });
      await _load();
      if (mounted) await context.read<AppState>().refreshTeamLead();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.message;
        punching = false;
      });
    }
  }

  void _go(String route) {
    if (widget.onNavigate != null) {
      widget.onNavigate!(route);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AppState>().user!;
    final payslips = (ess?['payslips'] as List<dynamic>? ?? []);
    final latest = payslips.isNotEmpty ? Map<String, dynamic>.from(payslips.first as Map) : null;
    final latestPay = latest == null ? null : money(latest['netPay'] ?? latest['net_pay']);
    final latestPeriod = latest == null ? null : pick(latest, ['periodLabel', 'period_label'], '-');
    final checkIn = _todayCheckIn();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: screenListPadding(context),
        children: [
          PageHero(
            title: Brand.appTitle,
            subtitle: 'Welcome, ${user.fullName ?? user.email}',
            trailing: const Icon(Icons.home_rounded, color: Colors.white, size: 34),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(error!, style: const TextStyle(color: AppColors.danger)),
            ),
          if (loading) const ScreenLoader(),
          if (!loading) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.fingerprint_rounded, color: AppColors.accent, size: 28),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Biometric attendance',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      checkIn == null
                          ? 'Not checked in today · ${formatDate(todayIso())}'
                          : 'Checked in at $checkIn · ${formatDate(todayIso())}',
                      style: TextStyle(color: T.muted(context), fontSize: 13),
                    ),
                    if (punchMsg != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(punchMsg!, style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w600)),
                      ),
                    if (!hardwareAvailable)
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Mock fingerprint'),
                        subtitle: const Text('For devices without sensor'),
                        value: mockFingerprint,
                        activeThumbColor: AppColors.accent,
                        onChanged: punching ? null : (v) => setState(() => mockFingerprint = v),
                      ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: punching ? null : () => _punch(isCheckIn: true),
                            icon: const Icon(Icons.login_rounded),
                            label: Text(punching ? '…' : 'Check in'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: punching ? null : () => _punch(isCheckIn: false),
                            icon: const Icon(Icons.logout_rounded),
                            label: const Text('Check out'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Leave balances', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 10),
                    if (balances.isEmpty)
                      Text('No leave balance data yet.', style: TextStyle(color: T.muted(context)))
                    else
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: balances.map((raw) {
                          final b = Map<String, dynamic>.from(raw as Map);
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: AppColors.accent.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '${pick(b, ['leaveType', 'leave_type'], 'Leave')}: ${pick(b, ['remainingDays', 'remaining_days'], '0')} days',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                            ),
                          );
                        }).toList(),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (latestPay != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: SectionCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Latest payslip', style: Theme.of(context).textTheme.bodySmall),
                            const SizedBox(height: 4),
                            Text(latestPay, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                            Text(latestPeriod ?? '', style: TextStyle(color: T.muted(context), fontSize: 12)),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => _go('payslips'),
                        icon: const Icon(Icons.chevron_right_rounded),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text('Quick actions', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.45,
                children: [
                  if (context.watch<AppState>().isTeamLead)
                    _QuickTile(
                      icon: Icons.fact_check_outlined,
                      label: 'Team approvals',
                      badge: context.watch<AppState>().pendingTeamApprovals,
                      onTap: () => _go('team_approvals'),
                    ),
                  _QuickTile(icon: Icons.beach_access_outlined, label: 'Apply leave', onTap: () => _go('leave')),
                  _QuickTile(icon: Icons.receipt_long_outlined, label: 'View slips', onTap: () => _go('payslips')),
                  _QuickTile(icon: Icons.description_outlined, label: 'Request certificate', onTap: () => _go('certificates')),
                  _QuickTile(icon: Icons.contacts_outlined, label: 'Directory', onTap: () => _go('directory')),
                  _QuickTile(icon: Icons.folder_outlined, label: 'Documents', onTap: () => _go('documents')),
                  _QuickTile(icon: Icons.calendar_month_outlined, label: 'Attendance', onTap: () => _go('attendance')),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                Brand.demoNotice,
                style: TextStyle(color: T.muted(context), fontSize: 11.5),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _QuickTile extends StatelessWidget {
  const _QuickTile({required this.icon, required this.label, required this.onTap, this.badge = 0});

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: T.surface(context),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.accent.withValues(alpha: 0.2)),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                children: [
                  Icon(icon, color: AppColors.accent, size: 26),
                  if (badge > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.warn,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text('$badge', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
            ],
          ),
        ),
      ),
    );
  }
}
