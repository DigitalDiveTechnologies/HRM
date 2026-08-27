import 'package:flutter/material.dart';

/// Digital Dive brand tokens (aligned with portal CSS).
class AppColors {
  static const accent = Color(0xFF00B8DB);
  static const accentHover = Color(0xFF00A8CF);
  static const accentGlow = Color(0xFF38D6F4);
  static const accentDeep = Color(0xFF023047);

  static const darkBg = Color(0xFF020B1F);
  static const darkSurface = Color(0xFF0A1A33);
  static const darkSecondary = Color(0xFF03142C);

  static const lightBg = Color(0xFFF8FCFD);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightAlt = Color(0xFFEEF9FC);
  static const lightText = Color(0xFF101828);
  static const lightMuted = Color(0xFF4A5565);
  static const lightLine = Color(0xFFE4EEF3);

  static const sidebarLight = Color(0xFFF8FCFD);
  static const sidebarDark = Color(0xFF020B1F);

  static const ok = Color(0xFF1F7A4C);
  static const warn = Color(0xFFB86E00);
  static const danger = Color(0xFFB42318);
}

/// Theme-aware colors — avoids light/dark conflicts when toggling.
class T {
  static bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  static Color ink(BuildContext context) =>
      Theme.of(context).colorScheme.onSurface;

  static Color muted(BuildContext context) =>
      isDark(context) ? Colors.white.withValues(alpha: 0.7) : AppColors.lightMuted;

  static Color surface(BuildContext context) =>
      Theme.of(context).colorScheme.surface;

  static Color bg(BuildContext context) =>
      Theme.of(context).scaffoldBackgroundColor;

  static Color line(BuildContext context) => isDark(context)
      ? AppColors.accent.withValues(alpha: 0.28)
      : AppColors.lightLine;

  static Color cardBorder(BuildContext context) => isDark(context)
      ? AppColors.accent.withValues(alpha: 0.18)
      : const Color(0xFFE2EEF4);

  static Color inputFill(BuildContext context) =>
      isDark(context) ? AppColors.darkSurface : Colors.white;

  static Color sidebarBg(BuildContext context) =>
      isDark(context) ? AppColors.sidebarDark : AppColors.sidebarLight;

  static Color sidebarText(BuildContext context) =>
      isDark(context) ? Colors.white.withValues(alpha: 0.85) : AppColors.lightText;

  static Color sidebarMuted(BuildContext context) =>
      isDark(context) ? Colors.white.withValues(alpha: 0.55) : AppColors.lightMuted;

  static Color sidebarBorder(BuildContext context) => isDark(context)
      ? AppColors.accent.withValues(alpha: 0.12)
      : AppColors.lightLine;

  static Color sidebarHover(BuildContext context) =>
      AppColors.accent.withValues(alpha: isDark(context) ? 0.16 : 0.1);
}

const _font = 'Segoe UI';

InputDecorationTheme _inputs(Brightness b) {
  final dark = b == Brightness.dark;
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: BorderSide(
      color: dark ? AppColors.accent.withValues(alpha: 0.28) : AppColors.lightLine,
    ),
  );
  return InputDecorationTheme(
    filled: true,
    fillColor: dark ? AppColors.darkSurface : Colors.white,
    hintStyle: TextStyle(color: dark ? Colors.white54 : AppColors.lightMuted),
    labelStyle: TextStyle(color: dark ? Colors.white70 : AppColors.lightMuted),
    border: border,
    enabledBorder: border,
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
  );
}

class AppTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.accent,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.accent,
      onPrimary: Colors.white,
      surface: AppColors.lightSurface,
      onSurface: AppColors.lightText,
      onSurfaceVariant: AppColors.lightMuted,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: _font,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.lightBg,
      dividerColor: AppColors.lightLine,
      iconTheme: const IconThemeData(color: AppColors.lightText),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.lightBg,
        foregroundColor: AppColors.lightText,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: AppColors.lightText),
        titleTextStyle: TextStyle(
          fontFamily: _font,
          fontWeight: FontWeight.w800,
          fontSize: 18,
          color: AppColors.lightText,
        ),
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: AppColors.sidebarLight,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: AppColors.lightSurface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: _inputs(Brightness.light),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.accent.withValues(alpha: 0.4),
          disabledForegroundColor: Colors.white70,
          minimumSize: const Size.fromHeight(48),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontFamily: _font, fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.accent),
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: AppColors.lightText,
        textColor: AppColors.lightText,
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: AppColors.lightSurface,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          fontFamily: _font,
          fontWeight: FontWeight.w800,
          fontSize: 18,
          color: AppColors.lightText,
        ),
      ),
    );
  }

  static ThemeData dark() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.accent,
      brightness: Brightness.dark,
    ).copyWith(
      primary: AppColors.accent,
      onPrimary: Colors.white,
      surface: AppColors.darkSurface,
      onSurface: Colors.white,
      onSurfaceVariant: Colors.white70,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: _font,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.darkBg,
      dividerColor: AppColors.accent.withValues(alpha: 0.2),
      iconTheme: const IconThemeData(color: Colors.white),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.darkBg,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: IconThemeData(color: Colors.white),
        titleTextStyle: TextStyle(
          fontFamily: _font,
          fontWeight: FontWeight.w800,
          fontSize: 18,
          color: Colors.white,
        ),
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: AppColors.sidebarDark,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: AppColors.darkSurface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: _inputs(Brightness.dark),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.accent.withValues(alpha: 0.35),
          disabledForegroundColor: Colors.white70,
          minimumSize: const Size.fromHeight(48),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontFamily: _font, fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.accentGlow),
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: Colors.white,
        textColor: Colors.white,
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: AppColors.darkSurface,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          fontFamily: _font,
          fontWeight: FontWeight.w800,
          fontSize: 18,
          color: Colors.white,
        ),
      ),
    );
  }
}
