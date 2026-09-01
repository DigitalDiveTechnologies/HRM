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

const POLL_MS = 45_000;

export function usePortalAlerts(pathname, enabled) {
  const [rawCounts, setRawCounts] = useState({});
  const [seenBaseline, setSeenBaseline] = useState({});
  const [toast, setToast] = useState(null);
  const prevRawRef = useRef(null);
  const toastTimerRef = useRef(null);

  const visible = visibleBadgeCounts(rawCounts, seenBaseline);
  const menuCategories = countAlertCategories(visible);

  const badgeFor = useCallback(
    (href) => visible[normalizePath(href)] || 0,
    [visible],
  );

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback(
    (path) => {
      dismissToast();
      setToast({ id: Date.now(), message: toastMessageForPath(path), path: normalizePath(path) });
      toastTimerRef.current = setTimeout(() => setToast(null), 6000);
    },
    [dismissToast],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const counts = await fetchPortalBadgeCounts(api);
      const prevRaw = prevRawRef.current;
      if (prevRaw) {
        for (const [href, count] of Object.entries(counts)) {
          if ((count || 0) > (prevRaw[href] || 0)) {
            showToast(href);
            break;
          }
        }
      }
      prevRawRef.current = counts;
      setRawCounts(counts);
    } catch {
      /* silent — badges optional */
    }
  }, [enabled, showToast]);

  useEffect(() => {
    if (!enabled) return undefined;
    setSeenBaseline(loadSeenBaselines());
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const path = normalizePath(pathname);
    setSeenBaseline((prev) => {
      const current = rawCounts[path] || 0;
      if ((prev[path] || 0) >= current) return prev;
      const next = { ...prev, [path]: current };
      saveSeenBaselines(next);
      return next;
    });
  }, [pathname, enabled, rawCounts]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  return {
    badgeFor,
    menuCategories,
    toast,
    dismissToast,
    refresh,
    labelForPath,
  };
}
