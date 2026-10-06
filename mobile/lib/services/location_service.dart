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
      // 1. Check if device location services (GPS) are turned ON
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return const LocationCheckResult(
          errorMessage: 'Location (GPS) is turned off on your device. Please turn on location services to mark attendance.',
          requiresLocationSettings: true,
        );
      }

      // 2. Check and request permission
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return const LocationCheckResult(
            errorMessage: 'Location permission is required to mark attendance. Please allow location access.',
          );
        }
      }

      if (permission == LocationPermission.deniedForever) {
        return const LocationCheckResult(
          errorMessage: 'Location permission is permanently denied. Please enable location permissions in App Settings to proceed.',
          requiresAppSettings: true,
        );
      }

      // 3. Acquire high-accuracy GPS coordinates
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      return LocationCheckResult(
        location: AttendanceLocation(
          latitude: position.latitude,
          longitude: position.longitude,
        ),
      );
    } catch (e) {
      debugPrint('[LocationService] Failed to acquire GPS position: $e');
      return LocationCheckResult(
        errorMessage: 'Unable to acquire GPS location. Please check your signal and ensure location is enabled.',
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
