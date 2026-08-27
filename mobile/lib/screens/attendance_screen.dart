import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../services/biometric_auth.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _biometric = BiometricAuthService();

  List<dynamic> rows = [];
  bool loading = true;
  bool punching = false;
  String? error;
  String? msg;
  String workDate = todayIso();
  String status = 'present';

  /// Chrome / Windows / no sensor → mock fingerprint for testing.
  bool mockFingerprint = kIsWeb || defaultTargetPlatform == TargetPlatform.windows;
  bool hardwareAvailable = false;
  bool checkingHardware = true;

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
      checkingHardware = false;
      if (ok) mockFingerprint = false;
    });
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    final api = context.read<AppState>().api;
    final user = context.read<AppState>().user;
    final role = (user?.role ?? '').toLowerCase();
    final myId = user?.employeeId;
    try {
      final data = await api.request('/attendance') as List<dynamic>;
      final mine = (role == 'employee' && myId != null)
          ? data.where((raw) {
              final r = Map<String, dynamic>.from(raw as Map);
              final id = r['employeeId'] ?? r['employee_id'];
              return id == null || id.toString() == myId.toString();
            }).toList()
          : data;
      if (!mounted) return;
      setState(() => rows = mine);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String _nowHm() {
    final n = DateTime.now();
    final h = n.hour.toString().padLeft(2, '0');
    final m = n.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  /// Today's check-in from list (if any), for pairing with check-out.
  String? _todayCheckIn() {
    for (final raw in rows) {
      final r = Map<String, dynamic>.from(raw as Map);
      final date = formatDate(r['workDate'] ?? r['work_date']);
      if (date == workDate || date == todayIso()) {
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
    if (user.employeeId == null) {
      setState(() => error = 'No employee profile linked.');
      return;
    }

    setState(() {
      punching = true;
      msg = null;
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
      'workDate': workDate.isEmpty ? todayIso() : workDate,
      'status': status,
      'overtimeHours': 0,
    };

    if (isCheckIn) {
      body['checkIn'] = now;
      body['checkOut'] = null;
    } else {
      body['checkIn'] = _todayCheckIn() ?? checkInFallback();
      body['checkOut'] = now;
    }

    try {
      await context.read<AppState>().api.request(
            '/attendance',
            method: 'POST',
            body: body,
          );
      if (!mounted) return;
      setState(() {
        msg = isCheckIn
            ? 'Check-in recorded at $now (fingerprint verified).'
            : 'Check-out recorded at $now (fingerprint verified).';
        punching = false;
      });
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.message;
        punching = false;
      });
    }
  }

  String checkInFallback() => '09:00';

  @override
  Widget build(BuildContext context) {
    final presentCount = rows.where((raw) {
      final s = pick(Map<String, dynamic>.from(raw as Map), ['status']).toLowerCase();
      return s == 'present';
    }).length;
    final lateCount = rows.where((raw) {
      final s = pick(Map<String, dynamic>.from(raw as Map), ['status']).toLowerCase();
      return s == 'late';
    }).length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 110),
        children: [
          const PageHero(
            title: 'Attendance',
            subtitle: 'Fingerprint check-in / check-out',
            trailing: Icon(Icons.fingerprint_rounded, color: Colors.white, size: 36),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                MetricTile(label: 'Present', value: '$presentCount', icon: Icons.check_circle_outline, color: AppColors.ok),
                const SizedBox(width: 10),
                MetricTile(label: 'Late', value: '$lateCount', icon: Icons.warning_amber_rounded, color: AppColors.warn),
                const SizedBox(width: 10),
                MetricTile(label: 'Logged', value: '${rows.length}', icon: Icons.calendar_month_outlined),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Biometric punch', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(
                    'Scan fingerprint to Check-In or Check-Out. Works for Employee, Manager & HR.',
                    style: TextStyle(color: T.muted(context), fontSize: 12.5),
                  ),
                  const SizedBox(height: 12),
                  if (error != null) Text(error!, style: const TextStyle(color: AppColors.danger)),
                  if (msg != null) Text(msg!, style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  TextFormField(
                    initialValue: workDate,
                    decoration: const InputDecoration(labelText: 'Date', prefixIcon: Icon(Icons.calendar_today_outlined)),
                    onChanged: (v) => workDate = v,
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: status,
                    decoration: const InputDecoration(labelText: 'Status'),
                    items: const [
                      DropdownMenuItem(value: 'present', child: Text('Present')),
                      DropdownMenuItem(value: 'late', child: Text('Late')),
                      DropdownMenuItem(value: 'leave', child: Text('Leave')),
                    ],
                    onChanged: (v) => setState(() => status = v ?? 'present'),
                  ),
                  if (!checkingHardware && !hardwareAvailable) ...[
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Mock fingerprint (no sensor)'),
                      subtitle: Text(
                        'Enable for Chrome / Windows testing',
                        style: TextStyle(color: T.muted(context), fontSize: 12),
                      ),
                      value: mockFingerprint,
                      activeThumbColor: AppColors.accent,
                      onChanged: punching ? null : (v) => setState(() => mockFingerprint = v),
                    ),
                  ],
                  if (hardwareAvailable)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        'Fingerprint sensor ready',
                        style: TextStyle(color: AppColors.ok, fontSize: 12.5, fontWeight: FontWeight.w600),
                      ),
                    ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: punching ? null : () => _punch(isCheckIn: true),
                          icon: const Icon(Icons.login_rounded),
                          label: Text(punching ? '…' : 'Check-In'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: punching ? null : () => _punch(isCheckIn: false),
                          icon: const Icon(Icons.logout_rounded),
                          label: Text(punching ? '…' : 'Check-Out'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.accent,
                            side: const BorderSide(color: AppColors.accent),
                            minimumSize: const Size.fromHeight(48),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 6, 20, 8),
            child: Text('Recent days', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          ),
          if (loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
          if (!loading && rows.isEmpty) const EmptyHint('No attendance yet — punch in above.', icon: Icons.fingerprint_rounded),
          ...rows.map((raw) {
            final r = Map<String, dynamic>.from(raw as Map);
            final cin = pick(r, ['checkIn', 'check_in'], '-');
            final cout = pick(r, ['checkOut', 'check_out'], '-');
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SectionCard(
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.accent.withValues(alpha: 0.18), AppColors.accentGlow.withValues(alpha: 0.22)],
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.fingerprint_rounded, color: AppColors.accent),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(formatDate(r['workDate'] ?? r['work_date']), style: const TextStyle(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 3),
                          Text(
                            '${cin.length >= 5 ? cin.substring(0, 5) : cin} → ${cout.length >= 5 ? cout.substring(0, 5) : cout} · Late ${formatLate(r['lateMinutes'] ?? r['late_minutes'])}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    StatusChip(pick(r, ['status'])),
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
