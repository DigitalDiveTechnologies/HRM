import 'dart:ui' show PlatformDispatcher;

import 'package:intl/intl.dart';

String pick(Map<String, dynamic> m, List<String> keys, [String fallback = '-']) {
  for (final k in keys) {
    final v = m[k];
    if (v != null && v.toString().isNotEmpty) return v.toString();
  }
  return fallback;
}

String formatDate(dynamic value) {
  if (value == null) return '-';
  final s = value.toString();
  return s.length >= 10 ? s.substring(0, 10) : s;
}

/// Region-based currency from device locale country.
/// Optional override: --dart-define=CURRENCY=AED
String currencyCode([String? overrideCountry]) {
  const forced = String.fromEnvironment('CURRENCY', defaultValue: '');
  if (forced.trim().isNotEmpty) return forced.trim().toUpperCase();

  final country = (overrideCountry ?? PlatformDispatcher.instance.locale.countryCode ?? '')
      .toUpperCase();
  switch (country) {
    case 'PK':
      return 'PKR';
    case 'AE':
      return 'AED';
    case 'SA':
      return 'SAR';
    case 'QA':
      return 'QAR';
    case 'KW':
      return 'KWD';
    case 'BH':
      return 'BHD';
    case 'OM':
      return 'OMR';
    case 'IN':
      return 'INR';
    case 'US':
      return 'USD';
    case 'GB':
      return 'GBP';
    default:
      // No country on locale → soft fallback (not forced PKR for UAE devices)
      return 'PKR';
  }
}

String money(dynamic n) {
  final val = num.tryParse(n?.toString() ?? '0') ?? 0;
  final code = currencyCode();
  final locale = PlatformDispatcher.instance.locale.toString();
  try {
    return NumberFormat.currency(
      locale: locale,
      name: code,
      symbol: '$code ',
      decimalDigits: val % 1 == 0 ? 0 : 2,
    ).format(val);
  } catch (_) {
    return '$code ${val.toStringAsFixed(val % 1 == 0 ? 0 : 2)}';
  }
}

String formatLate(dynamic minutes) {
  final m = int.tryParse(minutes?.toString() ?? '0') ?? 0;
  if (m <= 0) return '0m';
  if (m < 60) return '${m}m';
  final h = m ~/ 60;
  final rem = m % 60;
  return rem == 0 ? '${h}h' : '${h}h ${rem}m';
}

String todayIso() {
  final d = DateTime.now();
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '${d.year}-$m-$day';
}

String initials(String? name) {
  if (name == null || name.trim().isEmpty) return '?';
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
}
