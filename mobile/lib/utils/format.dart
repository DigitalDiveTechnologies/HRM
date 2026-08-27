import 'dart:ui' show PlatformDispatcher;

/// Region-based currency: device timezone / locale country.
/// Pakistan → PKR, Dubai → AED. Override: --dart-define=CURRENCY=AED
/// Windows often reports en_US language even in PK — timezone fixes that.

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

String _countryFromTimezoneName(String name) {
  final n = name.toUpperCase();
  if (n.contains('PAKISTAN') || n == 'PKT') return 'PK';
  if (n.contains('ARABIAN') || n.contains('DUBAI') || n == 'GST') return 'AE';
  if (n.contains('INDIA') || n == 'IST' && n.contains('INDIA')) return 'IN';
  if (n.contains('SAUDI') || n.contains('RIYADH')) return 'SA';
  if (n.contains('QATAR')) return 'QA';
  if (n.contains('KUWAIT')) return 'KW';
  if (n.contains('BAHRAIN')) return 'BH';
  if (n.contains('MUSCAT') || n.contains('OMAN')) return 'OM';
  if (n.contains('BRITAIN') || n.contains('LONDON') || n == 'GMT' || n == 'BST') return 'GB';
  if (n.contains('EASTERN') || n.contains('PACIFIC') || n.contains('CENTRAL') || n.contains('MOUNTAIN')) {
    // Ambiguous US names — only treat as US when offset looks American is weak; skip
  }
  return '';
}

String _codeForCountry(String country) {
  switch (country.toUpperCase()) {
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
      return '';
  }
}

String currencyCode([String? overrideCountry]) {
  const forced = String.fromEnvironment('CURRENCY', defaultValue: '');
  if (forced.trim().isNotEmpty) return forced.trim().toUpperCase();

  if (overrideCountry != null && overrideCountry.trim().isNotEmpty) {
    final c = _codeForCountry(overrideCountry.trim());
    if (c.isNotEmpty) return c;
  }

  final fromTz = _codeForCountry(_countryFromTimezoneName(DateTime.now().timeZoneName));
  if (fromTz.isNotEmpty) return fromTz;

  // Offset fallback: Pakistan UTC+5, UAE UTC+4 (no DST typically)
  final offsetHours = DateTime.now().timeZoneOffset.inHours;
  final tzName = DateTime.now().timeZoneName.toUpperCase();
  if (offsetHours == 5 && (tzName.contains('PAKISTAN') || tzName == 'PKT' || tzName.contains('ISLAMABAD') || tzName == 'UTC+05' || tzName.contains('+05'))) {
    return 'PKR';
  }
  if (offsetHours == 5) {
    // Common for Pakistan when name is generic
    final localeCountry = (PlatformDispatcher.instance.locale.countryCode ?? '').toUpperCase();
    if (localeCountry.isEmpty || localeCountry == 'US' || localeCountry == 'PK') return 'PKR';
  }
  if (offsetHours == 4) {
    final localeCountry = (PlatformDispatcher.instance.locale.countryCode ?? '').toUpperCase();
    if (localeCountry.isEmpty || localeCountry == 'US' || localeCountry == 'AE') return 'AED';
  }

  final localeCountry = (PlatformDispatcher.instance.locale.countryCode ?? '').toUpperCase();
  final fromLocale = _codeForCountry(localeCountry);
  // Don't trust en_US alone when not clearly in Americas (offset -12..-3 roughly)
  if (fromLocale == 'USD' && offsetHours > -3) {
    return 'PKR';
  }
  if (fromLocale.isNotEmpty) return fromLocale;

  return 'PKR';
}

String money(dynamic n) {
  final val = num.tryParse(n?.toString() ?? '0') ?? 0;
  final code = currencyCode();
  final digits = val % 1 == 0 ? 0 : 2;
  final raw = val.toStringAsFixed(digits);
  final parts = raw.split('.');
  final whole = parts[0].replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  );
  final frac = parts.length > 1 ? '.${parts[1]}' : '';
  return '$code $whole$frac';
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
