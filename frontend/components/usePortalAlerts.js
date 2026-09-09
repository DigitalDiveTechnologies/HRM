'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/auth';
import {
  countAlertCategories,
  fetchPortalBadgeCounts,
  labelForPath,
  loadSeenBaselines,
  normalizePath,
  saveSeenBaselines,
  toastMessageForPath,
  visibleBadgeCounts,
} from '../lib/alertBadges';

/** Near-instant alerts (was 45s). */
const POLL_MS = 5_000;

export function usePortalAlerts(pathname, enabled) {
  const [rawCounts, setRawCounts] = useState({});
  const [seenBaselines, setSeenBaselines] = useState(() => loadSeenBaselines());
  const [toast, setToast] = useState(null);
  const prevRawRef = useRef(null);
  const toastTimerRef = useRef(null);

  // Synchronize seen baseline when user visits or clicks a tab
  const markSeen = useCallback((href, explicitCount) => {
    if (!href) return;
    const p = normalizePath(href);
    setSeenBaselines((prev) => {
      const currentRaw = explicitCount !== undefined ? explicitCount : (rawCounts[p] || 0);
      const next = { ...prev, [p]: Math.max(prev[p] || 0, currentRaw) };
      saveSeenBaselines(next);
      return next;
    });
  }, [rawCounts]);

  // When pathname changes or rawCounts update, auto-mark current route as seen
  useEffect(() => {
    if (!pathname || !enabled) return;
    const norm = normalizePath(pathname);
    setSeenBaselines((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const href of Object.keys(rawCounts)) {
        const normHref = normalizePath(href);
        if (norm === normHref || norm.startsWith(`${normHref}/`)) {
          const raw = rawCounts[href] || 0;
          if ((next[normHref] || 0) < raw) {
            next[normHref] = raw;
            changed = true;
          }
        }
      }
      if (changed) {
        saveSeenBaselines(next);
        return next;
      }
      return prev;
    });
  }, [pathname, rawCounts, enabled]);

  const visible = visibleBadgeCounts(rawCounts, seenBaselines, pathname);
  const menuCategories = countAlertCategories(visible);

  const badgeFor = useCallback(
    (href) => visible[normalizePath(href)] || 0,
    [visible],
  );

  const clearBadge = useCallback(
    (href) => {
      markSeen(href);
    },
    [markSeen],
  );

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback(
    (path) => {
      dismissToast();
      setToast({ id: Date.now(), message: toastMessageForPath(path), path: normalizePath(path) });
      toastTimerRef.current = setTimeout(() => setToast(null), 7000);
    },
    [dismissToast],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const counts = await fetchPortalBadgeCounts(api);
      const prevRaw = prevRawRef.current;
      if (prevRaw) {
        const priority = ['/leave', '/certificates', '/attendance', '/approvals', '/documents', '/notifications'];
        const paths = [
          ...priority.filter((p) => Object.prototype.hasOwnProperty.call(counts, p)),
          ...Object.keys(counts).filter((p) => !priority.includes(p)),
        ];
        for (const href of paths) {
          if ((counts[href] || 0) > (prevRaw[href] || 0)) {
            showToast(href);
            break;
          }
        }
      }
      prevRawRef.current = counts;

      // Adjust seen baselines downwards if backend counts dropped (e.g. approved/deleted)
      setSeenBaselines((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [p, baselineVal] of Object.entries(next)) {
          const currentRaw = counts[p] || 0;
          if (baselineVal > currentRaw) {
            next[p] = currentRaw;
            changed = true;
          }
        }
        if (changed) {
          saveSeenBaselines(next);
          return next;
        }
        return prev;
      });

      setRawCounts(counts);
    } catch {
      /* silent — badges optional */
    }
  }, [enabled, showToast]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [enabled, refresh]);

  // Refresh immediately when switching sidebar pages.
  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [pathname, enabled, refresh]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  return {
    badgeFor,
    clearBadge,
    menuCategories,
    toast,
    dismissToast,
    refresh,
    labelForPath,
  };
}
