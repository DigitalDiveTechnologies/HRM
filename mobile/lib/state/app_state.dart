import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../nav/app_nav.dart';
import '../services/api_client.dart';

class AuthUser {
  AuthUser({
    required this.id,
    required this.email,
    required this.role,
    this.employeeId,
    this.fullName,
    this.jobTitle,
  });

  final int id;
  final String email;
  final String role;
  final int? employeeId;
  final String? fullName;
  final String? jobTitle;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: (json['id'] as num).toInt(),
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? 'employee',
      employeeId: json['employeeId'] == null ? null : (json['employeeId'] as num).toInt(),
      fullName: json['fullName']?.toString(),
      jobTitle: json['jobTitle']?.toString() ?? json['job_title']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'role': role,
        'employeeId': employeeId,
        'fullName': fullName,
        'jobTitle': jobTitle,
      };
}

class AppState extends ChangeNotifier {
  AppState(this.api);

  final ApiClient api;

  ThemeMode themeMode = ThemeMode.light;
  AuthUser? user;
  bool ready = false;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final theme = prefs.getString('hr_theme') ?? 'light';
    themeMode = theme == 'dark' ? ThemeMode.dark : ThemeMode.light;

    await api.loadToken();
    final raw = prefs.getString('hr_user');
    if (raw != null && api.token != null && api.token!.isNotEmpty) {
      try {
        final parsed = AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
        if (canUseMobileApp(parsed.role)) {
          user = parsed;
        } else {
          await api.setToken(null);
          await prefs.remove('hr_user');
        }
      } catch (_) {
        user = null;
      }
    }

    ready = true;
    notifyListeners();
  }

  Future<void> toggleTheme() async {
    themeMode = themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    // Paint new theme immediately — don't wait on disk I/O (avoids grey/double blink).
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('hr_theme', themeMode == ThemeMode.dark ? 'dark' : 'light');
  }

  Future<void> login(String email, String password) async {
    final data = await api.request(
      '/auth/login',
      method: 'POST',
      body: {'email': email.trim(), 'password': password},
    ) as Map<String, dynamic>;

    final token = data['token']?.toString() ?? '';
    final u = AuthUser.fromJson(Map<String, dynamic>.from(data['user'] as Map));
    if (!canUseMobileApp(u.role)) {
      throw ApiException(
        'Administrator accounts use the HR web portal. Employees sign in here.',
      );
    }
    await api.setToken(token);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('hr_user', jsonEncode(u.toJson()));
    user = u;
    notifyListeners();
  }

  Future<void> logout() async {
    user = null;
    await api.setToken(null);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('hr_user');
    notifyListeners();
  }
}
