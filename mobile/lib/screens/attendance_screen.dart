import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../services/biometric_auth.dart';
import '../services/location_service.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../utils/format.dart';
import '../widgets/ui_kit.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> with WidgetsBindingObserver {
  final _biometric = BiometricAuthService();
  final _locationService = LocationService();

  List<dynamic> rows = [];
  bool loading = true;
  bool punching = false;
  String? punchStep;
  String? error;
  String? msg;
  String workDate = todayIso();
  String status = 'present';

  /// Chrome / Windows / no sensor → mock biometric for testing.
  bool mockFingerprint = kIsWeb || defaultTargetPlatform == TargetPlatform.windows;
  bool hardwareAvailable = false;
  bool checkingHardware = true;

  // Live Location status
  bool locationServiceEnabled = true;
  bool locationPermissionGranted = true;
  bool locationPermissionPermanentlyDenied = false;
  String? liveLocationCoords;

  bool get isIOS => defaultTargetPlatform == TargetPlatform.iOS;
  String get biometricLabel => isIOS ? 'Face ID' : 'Fingerprint';
  IconData get biometricIcon => isIOS ? Icons.face_rounded : Icons.fingerprint_rounded;

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
      // Re-probe location when returning from phone settings or quick settings
      _probeLocation(requestPermission: false);
    }
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

  Future<void> _initLocationFlow() async {
    // Proactively request permission when opening Attendance screen
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
    } catch (e) {
      if (!mounted) return;
      setState(() => error = e.toString());
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

  /// Extracts "HH:mm" from API values like "2026-10-07T07:40:00" or "07:40:00".
  String _hm(dynamic value) {
    if (value == null) return '-';
    var s = value.toString().trim();
    if (s.isEmpty || s == '-') return '-';
    final t = s.indexOf('T');
    if (t >= 0) s = s.substring(t + 1);
    final sp = s.indexOf(' ');
    if (sp >= 0 && s.length > sp + 1 && s.contains('-')) s = s.substring(sp + 1);
    return s.length >= 5 ? s.substring(0, 5) : s;
  }

  /// Today's attendance row (if any).
  Map<String, dynamic>? _todayRow() {
    final today = todayIso();
    for (final raw in rows) {
      final r = Map<String, dynamic>.from(raw as Map);
      if (formatDate(r['workDate'] ?? r['work_date']) == today) return r;
    }
    return null;
  }

  bool _has(Map<String, dynamic>? r, List<String> keys) {
    if (r == null) return false;
    final v = pick(r, keys, '');
    return v.isNotEmpty && v != '-';
  }

  bool get _checkedInToday => _has(_todayRow(), ['checkIn', 'check_in']);
  bool get _checkedOutToday => _has(_todayRow(), ['checkOut', 'check_out']);

  Future<void> _punch({required bool isCheckIn}) async {
    final user = context.read<AppState>().user!;
    if (user.employeeId == null) {
      setState(() => error = 'No employee profile linked.');
      return;
    }

    if (isCheckIn && _checkedInToday) {
      setState(() => error = 'You have already checked in today.');
      return;
    }
    if (!isCheckIn && (!_checkedInToday || _checkedOutToday)) {
      setState(() => error = _checkedOutToday
          ? 'You have already checked out today.'
          : 'Please check in before checking out.');
      return;
    }

    setState(() {
      punching = true;
      punchStep = 'Acquiring GPS location…';
      msg = null;
      error = null;
    });

    // 1. Strict Location Requirement: Location MUST be ON and GRANTED
    final locResult = await _locationService.requireLocation(
      allowMockOnDesktop: mockFingerprint,
    );

    if (!locResult.isSuccess || locResult.location == null) {
      if (!mounted) return;
      setState(() {
        punching = false;
        punchStep = null;
        error = locResult.errorMessage ?? 'Location is strictly required to mark attendance.';
      });
      await _probeLocation();

      // Show actionable dialog for any location failure (GPS off, permission denied, or settings needed)
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
      punchStep = 'Location captured · Verifying $biometricLabel…';
    });

    // 2. Biometric verification: Face ID on iPhone, Fingerprint on Android
    final ok = await _biometric.authenticateForAttendance(
      context: context,
      useMockWhenUnavailable: mockFingerprint,
    );
    if (!mounted) return;
    if (!ok) {
      setState(() {
        punching = false;
        punchStep = null;
        error = '$biometricLabel verification failed or was cancelled.';
      });
      return;
    }

    setState(() => punchStep = 'Submitting to server…');

    final now = _nowHm();
    final body = <String, dynamic>{
      'employeeId': user.employeeId,
      'workDate': todayIso(),
      'status': status,
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
      // Server keeps the existing check-in time for today's row.
      body['checkIn'] = null;
      body['checkOut'] = now;
      body['checkOutLatitude'] = loc.latitude;
      body['checkOutLongitude'] = loc.longitude;
    }

    try {
      await context.read<AppState>().api.request(
            '/attendance',
            method: 'POST',
            body: body,
          );
      if (!mounted) return;
      final locText = ' (GPS: ${loc.latitude.toStringAsFixed(4)}, ${loc.longitude.toStringAsFixed(4)})';
      setState(() {
        msg = isCheckIn
            ? 'Check-in recorded at $now ($biometricLabel verified$locText).'
            : 'Check-out recorded at $now ($biometricLabel verified$locText).';
        punching = false;
        punchStep = null;
      });
      await _load();
      if (!mounted) return;
      await showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: AppColors.ok),
              const SizedBox(width: 8),
              Expanded(child: Text(isCheckIn ? 'Checked in' : 'Checked out')),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Time: $now', style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text('$biometricLabel: verified'),
              const SizedBox(height: 8),
              const Text('Location recorded:', style: TextStyle(fontWeight: FontWeight.w700)),
              Text('Latitude: ${loc.latitude.toStringAsFixed(6)}'),
              Text('Longitude: ${loc.longitude.toStringAsFixed(6)}'),
            ],
          ),
          actions: [
            FilledButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('OK')),
          ],
        ),
      );

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
        error = 'Attendance punch failed: $e';
        punching = false;
        punchStep = null;
      });
    }
  }

  void _showLocationDialog(Map<String, dynamic> r, dynamic inLat, dynamic inLng, dynamic outLat, dynamic outLng) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.location_on_rounded, color: AppColors.accent),
            SizedBox(width: 8),
            Text('Punch Location'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Date: ${formatDate(r['workDate'] ?? r['work_date'])}',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.accent.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.login_rounded, size: 16, color: AppColors.ok),
                      const SizedBox(width: 6),
                      Text('Check-In (${pick(r, ['checkIn', 'check_in'], '-')})', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('Latitude: ${inLat?.toString() ?? 'N/A'}', style: const TextStyle(fontSize: 12)),
                  Text('Longitude: ${inLng?.toString() ?? 'N/A'}', style: const TextStyle(fontSize: 12)),
                ],
              ),
            ),
            if (outLat != null && outLng != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.warn.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.warn.withValues(alpha: 0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.logout_rounded, size: 16, color: AppColors.warn),
                        const SizedBox(width: 6),
                        Text('Check-Out (${pick(r, ['checkOut', 'check_out'], '-')})', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Latitude: ${outLat.toString()}', style: const TextStyle(fontSize: 12)),
                    Text('Longitude: ${outLng.toString()}', style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  /// Today's check-in / check-out times.
  Widget _todaySummary(BuildContext context) {
    final r = _todayRow();
    final cin = r == null ? '-' : _hm(r['checkIn'] ?? r['check_in']);
    final cout = r == null ? '-' : _hm(r['checkOut'] ?? r['check_out']);
    Widget cell(String label, String value, IconData icon, Color color) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: color.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Icon(icon, size: 18, color: color),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: TextStyle(fontSize: 11, color: T.muted(context))),
                    Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  ],
                ),
              ],
            ),
          ),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Today · ${todayIso()}', style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Row(
          children: [
            cell('Check-In', cin, Icons.login_rounded, AppColors.ok),
            const SizedBox(width: 10),
            cell('Check-Out', cout, Icons.logout_rounded, AppColors.warn),
          ],
        ),
      ],
    );
  }

  /// Shows only the next allowed action for today.
  Widget _punchAction() {
    if (loading && rows.isEmpty) {
      return const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator()));
    }
    if (_checkedInToday && _checkedOutToday) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.ok.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Row(
          children: [
            Icon(Icons.verified_rounded, color: AppColors.ok),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Attendance completed for today. See you tomorrow!',
                style: TextStyle(color: AppColors.ok, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
    }
    final isCheckIn = !_checkedInToday;
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: punching ? null : () => _punch(isCheckIn: isCheckIn),
        icon: Icon(isCheckIn ? Icons.login_rounded : Icons.logout_rounded),
        label: Text(punching ? 'Please wait…' : (isCheckIn ? 'Check-In' : 'Check-Out')),
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          backgroundColor: isCheckIn ? AppColors.accent : AppColors.warn,
        ),
      ),
    );
  }

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
      onRefresh: () async {
        await _load();
        await _probeLocation();
      },
      child: ListView(
        padding: screenListPadding(context),
        children: [
          PageHero(
            title: 'Attendance',
            subtitle: '$biometricLabel check-in / check-out with GPS',
            trailing: Icon(biometricIcon, color: Colors.white, size: 36),
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
              child: FormSpacedColumn(
                children: [
                  Text('Biometric & GPS punch', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  Text(
                    'Requires $biometricLabel and active device location (GPS) to Check-In or Check-Out.',
                    style: TextStyle(color: T.muted(context), fontSize: 12.5),
                  ),

                  // Live GPS Status Pill
                  if (!locationPermissionGranted)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.warn.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.warn.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.lock_outline_rounded, color: AppColors.warn, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              locationPermissionPermanentlyDenied
                                  ? 'Location Denied in App Settings'
                                  : 'Location Permission Needed',
                              style: const TextStyle(color: AppColors.warn, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                          TextButton(
                            onPressed: () async {
                              if (locationPermissionPermanentlyDenied) {
                                await _locationService.openAppropriateSettings(isAppSettings: true);
                              } else {
                                await _probeLocation(requestPermission: true);
                              }
                            },
                            style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                            child: Text(locationPermissionPermanentlyDenied ? 'Open Settings' : 'Grant Access'),
                          ),
                        ],
                      ),
                    )
                  else if (!locationServiceEnabled)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.location_off_rounded, color: AppColors.danger, size: 18),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Location (GPS) is OFF',
                              style: TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ),
                          TextButton(
                            onPressed: () async {
                              await _locationService.openAppropriateSettings(isAppSettings: false);
                            },
                            style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                            child: const Text('Turn ON'),
                          ),
                        ],
                      ),
                    )
                  else
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.ok.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.ok.withValues(alpha: 0.25)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.my_location_rounded, color: AppColors.ok, size: 16),
                          const SizedBox(width: 8),
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

                  if (error != null) Text(error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
                  if (msg != null) Text(msg!, style: const TextStyle(color: AppColors.ok, fontWeight: FontWeight.w600)),
                  if (punchStep != null)
                    Row(
                      children: [
                        const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                        const SizedBox(width: 8),
                        Text(punchStep!, style: const TextStyle(color: AppColors.accent, fontSize: 12.5, fontWeight: FontWeight.w600)),
                      ],
                    ),

                  _todaySummary(context),
                  if (!checkingHardware && !hardwareAvailable)
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('Mock $biometricLabel (no sensor)'),
                      subtitle: Text(
                        'Enable for simulator / testing',
                        style: TextStyle(color: T.muted(context), fontSize: 12),
                      ),
                      value: mockFingerprint,
                      activeThumbColor: AppColors.accent,
                      onChanged: punching ? null : (v) => setState(() => mockFingerprint = v),
                    ),
                  if (hardwareAvailable)
                    Text(
                      '$biometricLabel sensor ready',
                      style: const TextStyle(color: AppColors.ok, fontSize: 12.5, fontWeight: FontWeight.w600),
                    ),
                  _punchAction(),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 6, 20, 8),
            child: Text('Recent days', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          ),
          if (loading) const ScreenLoader(),
          if (!loading && rows.isEmpty) EmptyHint('No attendance yet — punch in above.', icon: biometricIcon),
          ...rows.map((raw) {
            final r = Map<String, dynamic>.from(raw as Map);
            final cin = pick(r, ['checkIn', 'check_in'], '-');
            final cout = pick(r, ['checkOut', 'check_out'], '-');
            final inLat = r['checkInLatitude'] ?? r['check_in_latitude'] ?? r['latitude'];
            final inLng = r['checkInLongitude'] ?? r['check_in_longitude'] ?? r['longitude'];
            final outLat = r['checkOutLatitude'] ?? r['check_out_latitude'];
            final outLng = r['checkOutLongitude'] ?? r['check_out_longitude'];
            final hasLocation = inLat != null && inLng != null;

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
                      child: Icon(biometricIcon, color: AppColors.accent),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(formatDate(r['workDate'] ?? r['work_date']), style: const TextStyle(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 3),
                          Text(
                            '${_hm(cin)} → ${_hm(cout)} · Late ${formatLate(r['lateMinutes'] ?? r['late_minutes'])}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          if (hasLocation)
                            Padding(
                              padding: const EdgeInsets.only(top: 3),
                              child: Row(
                                children: [
                                  const Icon(Icons.location_on_rounded, size: 13, color: AppColors.accent),
                                  const SizedBox(width: 3),
                                  Expanded(
                                    child: Text(
                                      'GPS: ${inLat.toString().length > 7 ? inLat.toString().substring(0, 7) : inLat}, ${inLng.toString().length > 7 ? inLng.toString().substring(0, 7) : inLng}' +
                                          (outLat != null ? ' · Out: ${outLat.toString().length > 7 ? outLat.toString().substring(0, 7) : outLat}' : ''),
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.accent,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (hasLocation)
                      IconButton(
                        icon: const Icon(Icons.map_rounded, size: 20, color: AppColors.accent),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        tooltip: 'View coordinates',
                        onPressed: () => _showLocationDialog(r, inLat, inLng, outLat, outLng),
                      ),
                    const SizedBox(width: 6),
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
