import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient();

  String? _token;

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('hr_token');
  }

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token == null || token.isEmpty) {
      await prefs.remove('hr_token');
    } else {
      await prefs.setString('hr_token', token);
    }
  }

  String? get token => _token;

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBase}/api$path');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (_token != null && _token!.isNotEmpty) 'Authorization': 'Bearer $_token',
    };

    late http.Response res;
    switch (method.toUpperCase()) {
      case 'POST':
        res = await http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
        break;
      case 'PATCH':
        res = await http.patch(uri, headers: headers, body: jsonEncode(body ?? {}));
        break;
      default:
        res = await http.get(uri, headers: headers);
    }

    final decoded = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final msg = decoded is Map && decoded['error'] != null
          ? decoded['error'].toString()
          : 'Request failed (${res.statusCode})';
      throw ApiException(msg);
    }
    return decoded;
  }
}
