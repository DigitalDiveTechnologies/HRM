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
    int? readInt(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toInt();
      return int.tryParse(v.toString());
    }

    return AuthUser(
      id: (json['id'] as num).toInt(),
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? 'employee',
      employeeId: readInt(json['employeeId'] ?? json['employee_id']),
      fullName: json['fullName']?.toString() ?? json['full_name']?.toString(),
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
  AppState(this.api) {
    api.onUnauthorized = _handleUnauthorized;
  }

  final ApiClient api;

  ThemeMode themeMode = ThemeMode.light;
  AuthUser? user;
  bool ready = false;
  bool isTeamLead = false;
  int pendingTeamApprovals = 0;

  void _handleUnauthorized() {
    if (user == null) return;
    user = null;
    api.setToken(null);
    SharedPreferences.getInstance().then((prefs) => prefs.remove('hr_user'));
    notifyListeners();
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final theme = prefs.getString('hr_theme') ?? 'light';
    themeMode = theme == 'dark' ? ThemeMode.dark : ThemeMode.light;

    await api.loadToken();
    final raw = prefs.getString('hr_user');
    if (raw != null && api.token != null && api.token!.isNotEmpty) {
      try {
        final parsed = AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
        if (!canUseMobileApp(parsed.role)) {
          await api.setToken(null);
          await prefs.remove('hr_user');
        } else {
          user = parsed;
          try {
            await api.request('/auth/me');
            await refreshTeamLead();
          } on ApiException catch (e) {
            if (e.statusCode == 401) {
              user = null;
              await api.setToken(null);
              await prefs.remove('hr_user');
            }
          }
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
      body: {'email': email.trim(), 'password': password.trim()},
    ) as Map<String, dynamic>;

    final token = data['token']?.toString() ?? data['Token']?.toString() ?? '';
    if (token.isEmpty) {
      throw ApiException('Login succeeded but no token was returned.');
    }

    final rawUser = data['user'] ?? data['User'];
    if (rawUser is! Map) {
      throw ApiException('Login succeeded but user profile was missing.');
    }

    final u = AuthUser.fromJson(Map<String, dynamic>.from(rawUser));
    if (!canUseMobileApp(u.role)) {
      throw ApiException(
        'Administrator accounts use the HR web portal. Employees sign in here.',
      );
    }
    if (u.employeeId == null) {
      throw ApiException(
        'This login is not linked to an employee profile. Ask HR admin to fix the account.',
      );
    }

    await api.setToken(token);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('hr_user', jsonEncode(u.toJson()));
    user = u;
    await refreshTeamLead();
    notifyListeners();
  }

  Future<void> refreshTeamLead() async {
    if (user?.employeeId == null) {
      isTeamLead = false;
      pendingTeamApprovals = 0;
      return;
    }
    try {
      final data = await api.request('/leave/team/summary') as Map<String, dynamic>;
      isTeamLead = data['isTeamLead'] == true;
      pendingTeamApprovals = (data['pendingApprovals'] as num?)?.toInt() ?? 0;
    } catch (_) {
      isTeamLead = false;
      pendingTeamApprovals = 0;
    }
    notifyListeners();
  }

  Future<void> logout() async {
    user = null;
    isTeamLead = false;
    pendingTeamApprovals = 0;
    await api.setToken(null);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('hr_user');
    notifyListeners();
  }
}
