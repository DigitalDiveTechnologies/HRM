class AppConfig {
  /// Override: flutter run --dart-define=API_BASE=http://10.0.2.2:5088
  /// Android emulator → 10.0.2.2 | Windows/Web → localhost
  static const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://localhost:5088',
  );
}
