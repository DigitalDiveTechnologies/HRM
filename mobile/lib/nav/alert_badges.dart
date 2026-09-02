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
    case 'attendance':
      return 'attendance';
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

/// Human-readable toast for a sidebar route (matches portal wording).
String toastMessageForRoute(String routeId) {
  switch (routeId) {
    case 'leave':
      return 'New leave request — action needed';
    case 'certificates':
      return 'New certificate request — action needed';
    case 'attendance':
      return 'New attendance alert — action needed';
    case 'team_approvals':
      return 'New team approval — action needed';
    case 'notifications':
      return 'New notification — action needed';
    default:
      return 'New alert — action needed';
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
/// Portal now shows live counts; mobile still supports baselines but AppState may pass empty.
Map<String, int> visibleBadgeCounts(
  Map<String, int> raw,
  Map<String, int> seenBaseline,
) {
  // Live counts: show while pending/unread > 0 (same as portal).
  final out = <String, int>{};
  for (final entry in raw.entries) {
    if (entry.value > 0) out[entry.key] = entry.value;
  }
  return out;
}
