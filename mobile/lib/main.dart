import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/app_shell.dart';
import 'screens/login_screen.dart';
import 'services/api_client.dart';
import 'state/app_state.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DigitalDiveHrApp());
}

class DigitalDiveHrApp extends StatelessWidget {
  const DigitalDiveHrApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) {
        final state = AppState(ApiClient());
        state.init();
        return state;
      },
      child: Consumer<AppState>(
        builder: (context, app, _) {
          final Widget home;
          if (!app.ready) {
            home = const Scaffold(body: Center(child: CircularProgressIndicator()));
          } else if (app.user == null) {
            home = const LoginScreen();
          } else {
            // All roles (admin / boss / manager / employee) use the app
            home = const AppShell();
          }

          return MaterialApp(
            title: 'Digital Dive HR',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: app.themeMode,
            // Instant switch — no grey lerp between light/dark
            themeAnimationDuration: Duration.zero,
            home: home,
          );
        },
      ),
    );
  }
}
