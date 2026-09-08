import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'brand.dart';
import 'l10n/l10n.dart';
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
      child: Builder(
        builder: (context) {
          final themeMode = context.select<AppState, ThemeMode>((s) => s.themeMode);
          final locale = context.select<AppState, String>((s) => s.locale);
          final isAr = locale == 'ar';
          return MaterialApp(
            title: Brand.appTitle,
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: themeMode,
            themeAnimationDuration: Duration.zero,
            themeAnimationStyle: AnimationStyle.noAnimation,
            locale: Locale(locale),
            builder: (context, child) {
              return Directionality(
                textDirection: isAr ? TextDirection.rtl : TextDirection.ltr,
                child: child ?? const SizedBox.shrink(),
              );
            },
            home: const _RootGate(),
          );
        },
      ),
    );
  }
}

class _RootGate extends StatelessWidget {
  const _RootGate();

  @override
  Widget build(BuildContext context) {
    final ready = context.select<AppState, bool>((s) => s.ready);
    final signedIn = context.select<AppState, bool>((s) => s.user != null);
    final locale = context.select<AppState, String>((s) => s.locale);

    if (!ready) {
      return Scaffold(body: Center(child: Text(L10n(locale).t('loading'))));
    }
    if (!signedIn) {
      return const LoginScreen();
    }
    return const AppShell();
  }
}
