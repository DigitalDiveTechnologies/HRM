/**
 * Lightweight pub/sub so Settings → Users / Roles / Permissions stay in sync
 * without a full page refresh (same idea as gocs_company_changed).
 */
const EVENT = 'gocs_settings_rbac_changed';

export function notifySettingsRbacChanged(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export function subscribeSettingsRbacChanged(handler) {
  if (typeof window === 'undefined') return () => {};
  const onEvent = (e) => {
    try {
      handler(e.detail || {});
    } catch {
      /* ignore subscriber errors */
    }
  };
  window.addEventListener(EVENT, onEvent);
  return () => window.removeEventListener(EVENT, onEvent);
}
