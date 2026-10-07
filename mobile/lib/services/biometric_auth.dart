import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';

/// Biometric gate for attendance punches:
/// - Android: Fingerprint verification (with screen lock fallback if needed)
/// - iPhone (iOS): Face ID verification
/// On web / desktop without a sensor, [useMockWhenUnavailable] simulates success.
class BiometricAuthService {
  BiometricAuthService({LocalAuthentication? auth}) : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  /// True when device reports biometric hardware or security support.
  Future<bool> get hasHardware async {
    try {
      if (kIsWeb) return false;
      final supported = await _auth.isDeviceSupported();
      if (!supported) return false;
      final canCheck = await _auth.canCheckBiometrics;
      if (!canCheck) return supported;
      final types = await _auth.getAvailableBiometrics();
      return types.isNotEmpty || supported;
    } catch (_) {
      return false;
    }
  }

  /// Whether current target platform is iOS
  bool get isIOS => defaultTargetPlatform == TargetPlatform.iOS;

  /// Name of the biometric method (Face ID on iPhone, Fingerprint on Android)
  String get biometricMethodName => isIOS ? 'Face ID' : 'Fingerprint';

  /// Returns true when biometric (Fingerprint on Android, Face ID on iPhone) succeeds.
  Future<bool> authenticateForAttendance({
    required BuildContext context,
    required bool useMockWhenUnavailable,
  }) async {
    final hardware = await hasHardware;

    if (!hardware) {
      if (!useMockWhenUnavailable) {
        // Check if device supports standard lock / credential
        try {
          final supported = await _auth.isDeviceSupported();
          if (supported) {
            return await _auth.authenticate(
              localizedReason: 'Verify your device security to mark attendance',
              biometricOnly: false,
              persistAcrossBackgrounding: true,
            );
          }
        } catch (_) {}
        return false;
      }
      if (!context.mounted) return false;
      return _mockAuthenticate(context);
    }

    try {
      final reason = isIOS
          ? 'Verify Face ID to mark attendance'
          : 'Scan your fingerprint to mark attendance';

      return await _auth.authenticate(
        localizedReason: reason,
        biometricOnly: false,
        persistAcrossBackgrounding: true,
      );
    } catch (e) {
      debugPrint('[BiometricAuthService] Authentication error: $e');
      if (useMockWhenUnavailable && context.mounted) {
        return _mockAuthenticate(context);
      }
      return false;
    }
  }

  Future<bool> _mockAuthenticate(BuildContext context) async {
    final isApple = isIOS;
    final methodName = isApple ? 'Face ID' : 'Fingerprint';
    final icon = isApple ? Icons.face_rounded : Icons.fingerprint_rounded;

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          title: Row(
            children: [
              Icon(icon),
              const SizedBox(width: 10),
              Expanded(child: Text('Mock $methodName')),
            ],
          ),
          content: Text(
            'No $methodName sensor detected (web / desktop / simulator).\n\n'
            'Simulate a successful $methodName verification for testing?',
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
