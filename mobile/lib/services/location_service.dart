import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

class AttendanceLocation {
  const AttendanceLocation({
    required this.latitude,
    required this.longitude,
  });

  final double latitude;
  final double longitude;

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
      };

  @override
  String toString() => '${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}';
}

/// Result of requesting location verification.
class LocationCheckResult {
  const LocationCheckResult({
    this.location,
    this.errorMessage,
    this.requiresLocationSettings = false,
    this.requiresAppSettings = false,
  });

  final AttendanceLocation? location;
  final String? errorMessage;
  final bool requiresLocationSettings;
  final bool requiresAppSettings;

  bool get isSuccess => location != null;
}

/// Service to strictly enforce device GPS location during check-in / check-out.
class LocationService {
  /// Proactively requests location permission if it hasn't been requested yet.
  Future<LocationPermission> requestPermissionIfNeeded() async {
    if (kIsWeb || defaultTargetPlatform == TargetPlatform.windows || defaultTargetPlatform == TargetPlatform.macOS) {
      return LocationPermission.always;
    }
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      return permission;
    } catch (e) {
      debugPrint('[LocationService] requestPermissionIfNeeded error: $e');
      return LocationPermission.denied;
    }
  }

  /// Probes current location status (for UI indicator badges).
  /// If [requestPermission] is true and permission is currently denied, triggers the system permission dialog.
  Future<LocationCheckResult> probeLocationStatus({
    bool allowMockOnDesktop = false,
    bool requestPermission = false,
  }) async {
    if (allowMockOnDesktop &&
        (kIsWeb || defaultTargetPlatform == TargetPlatform.windows || defaultTargetPlatform == TargetPlatform.macOS)) {
      return const LocationCheckResult(
        location: AttendanceLocation(latitude: 25.204849, longitude: 55.270783),
      );
    }

    try {
      // 1. Check & optionally request permission
      var permission = await Geolocator.checkPermission();
      if (requestPermission && permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        return LocationCheckResult(
          errorMessage: 'Location permission not granted',
          requiresAppSettings: permission == LocationPermission.deniedForever,
        );
      }

      // 2. Check device GPS service
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return const LocationCheckResult(
          errorMessage: 'Location service is disabled',
          requiresLocationSettings: true,
        );
      }

      // 3. Check last known position for instant preview
      final isAndroid = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
      Position? pos;
      try {
        pos = await Geolocator.getLastKnownPosition(forceAndroidLocationManager: isAndroid);
        pos ??= await Geolocator.getLastKnownPosition();
      } catch (_) {}

      // If no cached position, try quick low-latency position (4s)
      if (pos == null) {
        try {
          pos = await Geolocator.getCurrentPosition(
            locationSettings: isAndroid
                ? AndroidSettings(accuracy: LocationAccuracy.medium, timeLimit: const Duration(seconds: 4))
                : const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 4)),
          ).timeout(const Duration(seconds: 5));
        } catch (_) {}
      }

      if (pos != null) {
        return LocationCheckResult(
          location: AttendanceLocation(latitude: pos.latitude, longitude: pos.longitude),
        );
      }

      return const LocationCheckResult(errorMessage: 'Ready to acquire location');
    } catch (_) {
      return const LocationCheckResult(errorMessage: 'Unable to check location status');
    }
  }

  /// Strictly requires that location services are ON and permission is GRANTED.
  /// If location is off or permission is not granted, returns a failure result
  /// indicating the exact issue and whether settings need to be opened.
  Future<LocationCheckResult> requireLocation({
    required bool allowMockOnDesktop,
  }) async {
    // Desktop / Web testing fallback (only when developer mock mode is enabled)
    if (allowMockOnDesktop &&
        (kIsWeb || defaultTargetPlatform == TargetPlatform.windows || defaultTargetPlatform == TargetPlatform.macOS)) {
      return const LocationCheckResult(
        location: AttendanceLocation(latitude: 25.204849, longitude: 55.270783),
      );
    }

    try {
      // 1. Check and request permission FIRST!
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        // Explicitly trigger the system runtime permission dialog
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return const LocationCheckResult(
            errorMessage: 'Location permission was denied. Please allow location access to verify attendance.',
            requiresAppSettings: false,
          );
        }
      }

      if (permission == LocationPermission.deniedForever) {
        return const LocationCheckResult(
          errorMessage: 'Location permission is permanently denied in settings. Please allow location in App Settings to proceed.',
          requiresAppSettings: true,
        );
      }

      // 2. Check if device location services (GPS) are turned ON
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return const LocationCheckResult(
          errorMessage: 'Device GPS / Location is turned OFF. Please turn on location services on your phone to mark attendance.',
          requiresLocationSettings: true,
        );
      }

      // 3. Resilient position acquisition (each tier has a hard timeout so the
      //    punch can never hang on "Acquiring GPS location…").
      final isAndroid = !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
      Position? position;

      Future<Position?> attempt(LocationSettings settings, int seconds, String label) async {
        try {
          return await Geolocator.getCurrentPosition(locationSettings: settings)
              .timeout(Duration(seconds: seconds + 2));
        } catch (e) {
          debugPrint('[LocationService] $label failed: $e');
          return null;
        }
      }

      LocationSettings settingsFor(LocationAccuracy accuracy, int seconds, {bool forceManager = false}) {
        if (isAndroid) {
          return AndroidSettings(
            accuracy: accuracy,
            timeLimit: Duration(seconds: seconds),
            forceLocationManager: forceManager,
          );
        }
        return LocationSettings(accuracy: accuracy, timeLimit: Duration(seconds: seconds));
      }

      // A. High accuracy (fused provider, 7s)
      position = await attempt(settingsFor(LocationAccuracy.high, 7), 7, 'High accuracy');

      // B. Medium / network accuracy (works fast indoors, 5s)
      position ??= await attempt(settingsFor(LocationAccuracy.medium, 5), 5, 'Medium accuracy');

      // C. Android: native LocationManager
      if (position == null && isAndroid) {
        position = await attempt(
          settingsFor(LocationAccuracy.high, 6, forceManager: true), 6, 'LocationManager');
      }

      // D. Last known cached position
      if (position == null) {
        try {
          position = await Geolocator.getLastKnownPosition(forceAndroidLocationManager: isAndroid)
              .timeout(const Duration(seconds: 3));
          position ??= await Geolocator.getLastKnownPosition().timeout(const Duration(seconds: 3));
        } catch (e) {
          debugPrint('[LocationService] Last known position failed: $e');
        }
      }

      if (position == null) {
        return const LocationCheckResult(
          errorMessage: 'Unable to acquire GPS location. Please check your signal and ensure location is enabled.',
        );
      }

      return LocationCheckResult(
        location: AttendanceLocation(
          latitude: position.latitude,
          longitude: position.longitude,
        ),
      );
    } catch (e) {
      debugPrint('[LocationService] Failed to acquire GPS position: $e');
      return LocationCheckResult(
        errorMessage: 'Location error: $e. Please verify location is enabled in settings.',
      );
    }
  }

  /// Opens either device location settings or app settings
  Future<void> openAppropriateSettings({required bool isAppSettings}) async {
    try {
      if (isAppSettings) {
        await Geolocator.openAppSettings();
      } else {
        await Geolocator.openLocationSettings();
      }
    } catch (e) {
      debugPrint('[LocationService] Could not open settings: $e');
    }
  }
}
