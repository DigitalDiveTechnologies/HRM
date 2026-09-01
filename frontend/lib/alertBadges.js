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
  const out = {};
  for (const [href, count] of Object.entries(raw || {})) {
    const delta = (count || 0) - (seenBaseline[href] || 0);
    if (delta > 0) out[href] = delta;
  }
  return out;
}

export function countAlertCategories(visible) {
  return Object.values(visible || {}).filter((c) => c > 0).length;
}

function pendingRows(rows) {
  return (rows || []).filter((r) => String(r.status || '').toLowerCase() === 'pending').length;
}

/** Fetch per-sidebar-route alert counts for HR admin portal. */
export async function fetchPortalBadgeCounts(api) {
  const [dashboard, approvals, certificates] = await Promise.all([
    api('/dashboard'),
    api('/approvals'),
    api('/certificates'),
  ]);

  const counts = {};

  if ((dashboard?.pendingLeave || 0) > 0) {
    counts['/leave'] = dashboard.pendingLeave;
  }
  if ((dashboard?.unreadNotifications || 0) > 0) {
    counts['/notifications'] = dashboard.unreadNotifications;
  }
  if ((dashboard?.expiringDocs || 0) > 0) {
    counts['/documents'] = dashboard.expiringDocs;
  }

  const pendingApprovals = pendingRows(approvals);
  if (pendingApprovals > 0) counts['/approvals'] = pendingApprovals;

  const pendingCerts = pendingRows(certificates);
  if (pendingCerts > 0) counts['/certificates'] = pendingCerts;

  return counts;
}

export function toastMessageForPath(path) {
  const label = labelForPath(path);
  return `New ${label} — action needed`;
}
