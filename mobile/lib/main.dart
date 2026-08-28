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
      // Only themeMode rebuilds MaterialApp chrome — screens stay mounted (no reload/spinner).
      child: Builder(
        builder: (context) {
          final themeMode = context.select<AppState, ThemeMode>((s) => s.themeMode);
          return MaterialApp(
            title: 'Digital Dive HR',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: themeMode,
            themeAnimationDuration: Duration.zero,
            themeAnimationStyle: AnimationStyle.noAnimation,
            home: const _RootGate(),
          );
        },
      ),
    );
  }
}

/// Auth/routing gate — does not rebuild on theme toggle.
class _RootGate extends StatelessWidget {
  const _RootGate();

  @override
  Widget build(BuildContext context) {
    final ready = context.select<AppState, bool>((s) => s.ready);
    final signedIn = context.select<AppState, bool>((s) => s.user != null);

    if (!ready) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (!signedIn) {
      return const LoginScreen();
    }
    return const AppShell();
  }
}
