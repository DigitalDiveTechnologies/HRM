import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../brand.dart';
import '../services/api_client.dart';
import '../services/biometric_auth.dart';
import '../services/location_service.dart';
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

class _EssScreenState extends State<EssScreen> with WidgetsBindingObserver {
  final _biometric = BiometricAuthService();
  final _locationService = LocationService();

  bool loading = true;
  bool punching = false;
  String? punchStep;
  String? error;
  String? punchMsg;

  Map<String, dynamic>? ess;
  List<dynamic> balances = [];
  List<dynamic> attendance = [];

  bool mockFingerprint = kIsWeb || defaultTargetPlatform == TargetPlatform.windows;
  bool hardwareAvailable = false;

  // Live Location status
  bool locationServiceEnabled = true;
  bool locationPermissionGranted = true;
  bool locationPermissionPermanentlyDenied = false;
  String? liveLocationCoords;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    _probeHardware();
    _initLocationFlow();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _probeLocation(requestPermission: false);
    }
  }

  Future<void> _probeLocation({bool requestPermission = false}) async {
    final status = await _locationService.probeLocationStatus(
      allowMockOnDesktop: mockFingerprint,
      requestPermission: requestPermission,
    );
    if (!mounted) return;
    setState(() {
      locationServiceEnabled = !status.requiresLocationSettings;
      locationPermissionPermanentlyDenied = status.requiresAppSettings;
      locationPermissionGranted = !status.requiresAppSettings && status.errorMessage != 'Location permission not granted';
      if (status.location != null) {
        liveLocationCoords = '${status.location!.latitude.toStringAsFixed(4)}, ${status.location!.longitude.toStringAsFixed(4)}';
      }
    });
  }

  Future<void> _initLocationFlow() async {
    await _probeLocation(requestPermission: true);
    if (!mounted) return;
    if (locationPermissionPermanentlyDenied) {
      await _showPermissionDialog(isAppSettings: true);
    } else if (!locationServiceEnabled) {
      await _showGpsOffDialog();
    }
  }

  Future<void> _showPermissionDialog({required bool isAppSettings}) async {
    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.lock_outline_rounded, color: AppColors.warn),
            SizedBox(width: 8),
            Expanded(child: Text('Location Permission Required')),
          ],
        ),
        content: Text(
          isAppSettings
              ? 'Location permission was previously denied. Android requires you to enable Location in App Settings to mark attendance.\n\nTap "Open Settings" -> Permissions -> Location -> "Allow only while using the app".'
              : 'Attendance tracking requires location permission to verify your attendance punch. Please allow location access.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              if (isAppSettings) {
                _locationService.openAppropriateSettings(isAppSettings: true);
              } else {
                _probeLocation(requestPermission: true);
              }
            },
            child: Text(isAppSettings ? 'Open Settings' : 'Grant Permission'),
          ),
        ],
      ),
    );
  }

  Future<void> _showGpsOffDialog() async {
    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.location_off_rounded, color: AppColors.danger),
            SizedBox(width: 8),
            Expanded(child: Text('Turn On Location (GPS)')),
          ],
        ),
        content: const Text(
          'Device GPS / Location is turned OFF. Please turn on location services in device settings to verify your attendance punch.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _locationService.openAppropriateSettings(isAppSettings: false);
            },
            child: const Text('Turn ON GPS'),
          ),
        ],
      ),
    );
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

  String? _todayCheckOut() {
    final today = todayIso();
    for (final raw in attendance) {
      final r = Map<String, dynamic>.from(raw as Map);
      final date = formatDate(r['workDate'] ?? r['work_date']);
      if (date == today) {
        final cout = pick(r, ['checkOut', 'check_out'], '');
        if (cout.isNotEmpty && cout != '-') {
          return cout.length >= 5 ? cout.substring(0, 5) : cout;
        }
      }
    }
    return null;
  }

  Future<void> _punch({required bool isCheckIn}) async {
    final user = context.read<AppState>().user!;
    if (user.employeeId == null) {
      setState(() => error = 'No employee profile linked to this account.');
      return;
    }

    final cin = _todayCheckIn();
    final cout = _todayCheckOut();
    if (isCheckIn && cin != null) {
      setState(() => error = 'You have already checked in today.');
      return;
    }
    if (!isCheckIn && (cin == null || cout != null)) {
      setState(() => error = cout != null
          ? 'You have already checked out today.'
          : 'Please check in before checking out.');
      return;
    }

    setState(() {
      punching = true;
      punchStep = 'Acquiring GPS location…';
      punchMsg = null;
      error = null;
    });

    final locResult = await _locationService.requireLocation(
      allowMockOnDesktop: mockFingerprint,
    );

    if (!locResult.isSuccess || locResult.location == null) {
      if (!mounted) return;
      setState(() {
        punching = false;
        punchStep = null;
        error = locResult.errorMessage ?? 'GPS location is required to mark attendance.';
      });
      await _probeLocation();

      if (mounted) {
        final bool isGpsOff = locResult.requiresLocationSettings;
        final bool isAppSettings = locResult.requiresAppSettings;

        await showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Row(
              children: [
                Icon(
                  isGpsOff ? Icons.location_off_rounded : Icons.lock_outline_rounded,
                  color: AppColors.danger,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(isGpsOff ? 'Turn On Location (GPS)' : 'Location Permission Required'),
                ),
              ],
            ),
            content: Text(
              locResult.errorMessage ??
                  'Location services and permissions are required to verify your attendance punch.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  if (isGpsOff) {
                    _locationService.openAppropriateSettings(isAppSettings: false);
                  } else if (isAppSettings) {
                    _locationService.openAppropriateSettings(isAppSettings: true);
                  } else {
                    _probeLocation(requestPermission: true);
                  }
                },
                child: Text(isGpsOff
                    ? 'Open Location Settings'
                    : (isAppSettings ? 'Open App Settings' : 'Grant Permission')),
              ),
            ],
          ),
        );
      }
      return;
    }

    final loc = locResult.location!;
    if (!mounted) return;
    setState(() {
      liveLocationCoords = '${loc.latitude.toStringAsFixed(4)}, ${loc.longitude.toStringAsFixed(4)}';
      punchStep = 'Location captured · Verifying fingerprint…';
    });

    final ok = await _biometric.authenticateForAttendance(
      context: context,
      useMockWhenUnavailable: mockFingerprint,
    );
    if (!mounted) return;
    if (!ok) {
      setState(() {
        punching = false;
        punchStep = null;
        error = 'Fingerprint verification failed';
      });
      return;
    }

    setState(() => punchStep = 'Submitting to server…');

    final now = _nowHm();
    final body = <String, dynamic>{
      'employeeId': user.employeeId,
      'workDate': todayIso(),
      'status': 'present',
      'overtimeHours': 0,
      'latitude': loc.latitude,
      'longitude': loc.longitude,
    };

    if (isCheckIn) {
      body['checkIn'] = now;
      body['checkOut'] = null;
      body['checkInLatitude'] = loc.latitude;
      body['checkInLongitude'] = loc.longitude;
    } else {
      body['checkIn'] = null;
      body['checkOut'] = now;
      body['checkOutLatitude'] = loc.latitude;
      body['checkOutLongitude'] = loc.longitude;
    }

    try {
      await context.read<AppState>().api.request('/attendance', method: 'POST', body: body);
      if (!mounted) return;
      setState(() {
        punchMsg = isCheckIn ? 'Checked in at $now' : 'Checked out at $now';
        punching = false;
        punchStep = null;
      });
      await _load();
      if (mounted) await context.read<AppState>().refreshTeamLead();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.message;
        punching = false;
        punchStep = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = e.toString();
        punching = false;
        punchStep = null;
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
    final checkOut = _todayCheckOut();

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
                          : (checkOut == null
                              ? 'Checked in at $checkIn · ${formatDate(todayIso())}'
                              : 'Checked in at $checkIn · Out at $checkOut · ${formatDate(todayIso())}'),
                      style: TextStyle(color: T.muted(context), fontSize: 13),
                    ),
                    const SizedBox(height: 8),

                    if (!locationServiceEnabled)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.location_off_rounded, color: AppColors.danger, size: 16),
                            const SizedBox(width: 6),
                            const Expanded(
                              child: Text(
                                'GPS is turned OFF on this phone',
                                style: TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ),
                            TextButton(
                              style: TextButton.styleFrom(visualDensity: VisualDensity.compact, padding: EdgeInsets.zero),
                              onPressed: _showGpsOffDialog,
                              child: const Text('Turn ON', style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      )
                    else if (!locationPermissionGranted)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: AppColors.warn.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.warn.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.lock_outline_rounded, color: AppColors.warn, size: 16),
                            const SizedBox(width: 6),
                            const Expanded(
                              child: Text(
                                'Location permission required',
                                style: TextStyle(color: AppColors.warn, fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ),
                            TextButton(
                              style: TextButton.styleFrom(visualDensity: VisualDensity.compact, padding: EdgeInsets.zero),
                              onPressed: () => _showPermissionDialog(isAppSettings: locationPermissionPermanentlyDenied),
                              child: Text(locationPermissionPermanentlyDenied ? 'Settings' : 'Grant', style: const TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: AppColors.ok.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.ok.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.my_location_rounded, color: AppColors.ok, size: 16),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                liveLocationCoords != null
                                    ? 'GPS Ready ($liveLocationCoords)'
                                    : 'GPS Ready & Active',
                                style: const TextStyle(color: AppColors.ok, fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.refresh_rounded, size: 16, color: AppColors.ok),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              tooltip: 'Refresh location',
                              onPressed: () => _probeLocation(requestPermission: true),
                            ),
                          ],
                        ),
                      ),

                    if (punchStep != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                            const SizedBox(width: 8),
                            Text(punchStep!, style: const TextStyle(color: AppColors.accent, fontSize: 12.5, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    if (punchMsg != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
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
                            onPressed: (punching || checkIn != null) ? null : () => _punch(isCheckIn: true),
                            icon: const Icon(Icons.login_rounded),
                            label: Text(punching ? '…' : (checkIn != null ? 'Checked in' : 'Check in')),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: (punching || checkIn == null || checkOut != null) ? null : () => _punch(isCheckIn: false),
                            icon: const Icon(Icons.logout_rounded),
                            label: Text(checkOut != null ? 'Checked out' : 'Check out'),
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
