class AppConfig {
  /// Local dev: flutter run --dart-define=API_BASE=http://192.168.1.18:5088
  /// Staging: https://digitaldivetech-001-site7.gtempurl.com
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://digitaldivetech-001-site7.gtempurl.com',
  );
}
