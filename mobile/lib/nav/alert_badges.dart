/// Maps backend notification categories to sidebar route ids.
library;

/// Sidebar route id for a notification row, or null if unread should be ignored.
String? notificationCategoryToRoute(String? category) {
  final cat = (category ?? '').toLowerCase().trim();
  switch (cat) {
    case 'leave':
      return 'leave';
    case 'certificate':
      return 'certificates';
    case 'visa':
    case 'training':
    case 'document':
    case 'compliance':
    case 'payroll':
    case 'payslip':
      return 'notifications';
    default:
      // General / unknown alerts live under Notifications.
      return 'notifications';
  }
}

/// Unread notification counts keyed by sidebar route id.
Map<String, int> computeNotificationBadges(List<dynamic> rows) {
  final counts = <String, int>{};
  for (final raw in rows) {
    if (raw is! Map) continue;
    final n = Map<String, dynamic>.from(raw);
    final read = n['isRead'] == true || n['is_read'] == true;
    if (read) continue;
    final route = notificationCategoryToRoute(n['category']?.toString());
    if (route == null) continue;
    counts[route] = (counts[route] ?? 0) + 1;
  }
  return counts;
}

/// Menu icon badge = how many sidebar sections have alerts (not total messages).
int countAlertCategories(Map<String, int> badges) =>
    badges.values.where((c) => c > 0).length;

/// Subtract "seen" baselines so opening a tab clears its badge until new alerts arrive.
Map<String, int> visibleBadgeCounts(
  Map<String, int> raw,
  Map<String, int> seenBaseline,
) {
  final out = <String, int>{};
  for (final entry in raw.entries) {
    final delta = entry.value - (seenBaseline[entry.key] ?? 0);
    if (delta > 0) out[entry.key] = delta;
  }
  return out;
}
