import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.isOffline = false});
  final String message;
  final int? statusCode;
  final bool isOffline;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient();

  static const _offlineMsg =
      'You are offline. Digital Dive HR needs an internet connection — offline mode is not available.';

  static const _timeout = Duration(seconds: 25);

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

  Map<String, String> _authHeaders({bool json = true}) => {
        if (json) 'Content-Type': 'application/json',
        if (_token != null && _token!.isNotEmpty) 'Authorization': 'Bearer $_token',
      };

  Never _throwOffline([Object? error]) {
    throw ApiException(_offlineMsg, isOffline: true);
  }

  bool _looksOffline(Object error) {
    final s = error.toString().toLowerCase();
    return s.contains('socketexception') ||
        s.contains('clientexception') ||
        s.contains('failed host lookup') ||
        s.contains('network is unreachable') ||
        s.contains('connection refused') ||
        s.contains('connection reset') ||
        s.contains('xmlhttprequest error') ||
        s.contains('failed to fetch') ||
        s.contains('networkerror');
  }

  Future<T> _guard<T>(Future<T> Function() run) async {
    try {
      return await run().timeout(_timeout);
    } on TimeoutException {
      _throwOffline();
    } on ApiException {
      rethrow;
    } on http.ClientException catch (e) {
      _throwOffline(e);
    } catch (e) {
      if (_looksOffline(e)) _throwOffline(e);
      throw ApiException(e.toString());
    }
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
  }) {
    return _guard(() async {
      final uri = Uri.parse('${AppConfig.apiBase}/api$path');
      final headers = _authHeaders();

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
        // Offline ≠ session kill. Only real auth expiry is 401 with a reachable API.
        throw ApiException(msg, statusCode: res.statusCode);
      }
      return decoded;
    });
  }

  Future<Uint8List> downloadBytes(String path) {
    return _guard(() async {
      final uri = Uri.parse('${AppConfig.apiBase}/api$path');
      final res = await http.get(uri, headers: _authHeaders(json: false));
      if (res.statusCode < 200 || res.statusCode >= 300) {
        String msg = 'Download failed (${res.statusCode})';
        try {
          final decoded = jsonDecode(res.body);
          if (decoded is Map && decoded['error'] != null) msg = decoded['error'].toString();
        } catch (_) {}
        throw ApiException(msg, statusCode: res.statusCode);
      }
      return res.bodyBytes;
    });
  }

  Future<dynamic> uploadMultipart(
    String path, {
    required Map<String, String> fields,
    required String fileField,
    required String fileName,
    required List<int> bytes,
  }) {
    return _guard(() async {
      final uri = Uri.parse('${AppConfig.apiBase}/api$path');
      final req = http.MultipartRequest('POST', uri);
      if (_token != null && _token!.isNotEmpty) {
        req.headers['Authorization'] = 'Bearer $_token';
      }
      req.fields.addAll(fields);
      req.files.add(http.MultipartFile.fromBytes(fileField, bytes, filename: fileName));
      final streamed = await req.send();
      final res = await http.Response.fromStream(streamed);
      final decoded = res.body.isEmpty ? <String, dynamic>{} : jsonDecode(res.body);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        final msg = decoded is Map && decoded['error'] != null
            ? decoded['error'].toString()
            : 'Upload failed (${res.statusCode})';
        throw ApiException(msg, statusCode: res.statusCode);
      }
      return decoded;
    });
  }
}
