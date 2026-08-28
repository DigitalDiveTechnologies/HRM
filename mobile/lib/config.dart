class AppConfig {
  /// Local dev: flutter run --dart-define=API_BASE=http://192.168.1.18:5088
  /// Production: https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment',
  );
}
