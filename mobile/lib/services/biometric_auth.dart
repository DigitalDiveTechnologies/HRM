import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';

/// Fingerprint / biometric gate for attendance punches.
/// On web / desktop without a sensor, [useMockWhenUnavailable] simulates success.
class BiometricAuthService {
  BiometricAuthService({LocalAuthentication? auth}) : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  /// True when device reports biometric hardware we can use.
  Future<bool> get hasHardware async {
    try {
      if (kIsWeb) return false;
      final supported = await _auth.isDeviceSupported();
      if (!supported) return false;
      final canCheck = await _auth.canCheckBiometrics;
      if (!canCheck) return false;
      final types = await _auth.getAvailableBiometrics();
      return types.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Returns true when fingerprint (or mock) succeeds.
  Future<bool> authenticateForAttendance({
    required BuildContext context,
    required bool useMockWhenUnavailable,
  }) async {
    final hardware = await hasHardware;

    if (!hardware) {
      if (!useMockWhenUnavailable) {
        return false;
      }
      if (!context.mounted) return false;
      return _mockAuthenticate(context);
    }

    try {
      return await _auth.authenticate(
        localizedReason: 'Scan your fingerprint to mark attendance',
        biometricOnly: true,
        persistAcrossBackgrounding: true,
      );
    } catch (_) {
      return false;
    }
  }

  Future<bool> _mockAuthenticate(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.fingerprint_rounded),
              SizedBox(width: 10),
              Expanded(child: Text('Mock fingerprint')),
            ],
          ),
          content: const Text(
            'No fingerprint sensor detected (web / desktop).\n\n'
            'Simulate a successful scan for testing?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Simulate success'),
            ),
          ],
        );
      },
    );
    return result == true;
  }
}
