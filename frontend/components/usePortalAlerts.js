'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/auth';
import {
  countAlertCategories,
  fetchPortalBadgeCounts,
  labelForPath,
  normalizePath,
  toastMessageForPath,
  visibleBadgeCounts,
} from '../lib/alertBadges';

/** Near-instant alerts (was 45s). */
const POLL_MS = 5_000;

export function usePortalAlerts(pathname, enabled) {
  const [rawCounts, setRawCounts] = useState({});
  const [toast, setToast] = useState(null);
  const prevRawRef = useRef(null);
  const toastTimerRef = useRef(null);

  const visible = visibleBadgeCounts(rawCounts, {});
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
    menuCategories,
    toast,
    dismissToast,
    refresh,
    labelForPath,
  };
}
