import { NAV } from './nav';

const SEEN_KEY = 'hr_portal_seen_badges';

export function normalizePath(path) {
  if (!path) return '';
  let s = path.startsWith('/') ? path : `/${path}`;
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

export function labelForPath(path) {
  const p = normalizePath(path);
  for (const group of NAV) {
    for (const link of group.links) {
      if (normalizePath(link.href) === p) return link.label;
    }
  }
  return 'Alert';
}

export function loadSeenBaselines() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveSeenBaselines(baselines) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(baselines));
  } catch {
    /* ignore */
  }
}

export function visibleBadgeCounts(raw, seenBaseline) {
  // Live pending/unread counts — stay visible until cleared (0), not cleared on page open.
  const out = {};
  for (const [href, count] of Object.entries(raw || {})) {
    if ((count || 0) > 0) out[href] = count;
  }
  return out;
}

export function countAlertCategories(visible) {
  return Object.values(visible || {}).filter((c) => c > 0).length;
}

function pendingRows(rows) {
  return (rows || []).filter((r) => {
    const s = String(r.status || '').toLowerCase();
    return s === 'pending' || s === 'requested' || s === 'submitted';
  }).length;
}

function bump(counts, path, n) {
  const p = normalizePath(path);
  const v = Number(n) || 0;
  if (v <= 0) return;
  counts[p] = Math.max(counts[p] || 0, v);
}

/** Map unread notification categories → sidebar routes (for toast + badges). */
function applyNotificationCategoryCounts(counts, notifications) {
  const byCat = {};
  for (const n of notifications || []) {
    const read = n.isRead === true || n.is_read === true;
    if (read) continue;
    const cat = String(n.category || '').toLowerCase().trim();
    byCat[cat] = (byCat[cat] || 0) + 1;
  }

  bump(counts, '/leave', byCat.leave);
  bump(counts, '/certificates', byCat.certificate);
  bump(counts, '/attendance', byCat.attendance);
  bump(counts, '/documents', (byCat.document || 0) + (byCat.visa || 0));
  bump(counts, '/notifications', byCat.training || 0);

  // leftover unread notifications still count on Notifications
  const mapped =
    (byCat.leave || 0) +
    (byCat.certificate || 0) +
    (byCat.attendance || 0) +
    (byCat.document || 0) +
    (byCat.visa || 0) +
    (byCat.training || 0);
  const totalUnread = Object.values(byCat).reduce((a, b) => a + b, 0);
  const other = totalUnread - mapped;
  if (other > 0) bump(counts, '/notifications', other);
}

/** Fetch per-sidebar-route alert counts for HR admin portal. */
export async function fetchPortalBadgeCounts(api) {
  const results = await Promise.allSettled([
    api('/dashboard'),
    api('/approvals'),
    api('/certificates'),
    api('/notifications'),
  ]);

  const dashboard = results[0].status === 'fulfilled' ? results[0].value : null;
  const approvals = results[1].status === 'fulfilled' ? results[1].value : null;
  const certificates = results[2].status === 'fulfilled' ? results[2].value : null;
  const notifications = results[3].status === 'fulfilled' ? results[3].value : null;

  const counts = {};

  bump(counts, '/leave', dashboard?.pendingLeave);
  bump(counts, '/notifications', dashboard?.unreadNotifications);
  bump(counts, '/documents', dashboard?.expiringDocs);
  bump(counts, '/certificates', dashboard?.pendingCertificates);

  const pendingApprovals = pendingRows(approvals);
  bump(counts, '/approvals', pendingApprovals);

  const pendingCerts = pendingRows(certificates);
  bump(counts, '/certificates', pendingCerts);

  applyNotificationCategoryCounts(counts, notifications);

  return counts;
}

/** Specific toast copy: leave / certificate / attendance / etc. */
export function toastMessageForPath(path) {
  const p = normalizePath(path);
  switch (p) {
    case '/leave':
      return 'New leave request — action needed';
    case '/certificates':
      return 'New certificate request — action needed';
    case '/attendance':
      return 'New attendance alert — action needed';
    case '/approvals':
      return 'New approval — action needed';
    case '/documents':
      return 'New document alert — action needed';
    case '/notifications':
      return 'New notification — action needed';
    default:
      return `New ${labelForPath(p)} — action needed`;
  }
}
