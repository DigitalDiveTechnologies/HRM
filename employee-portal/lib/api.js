'use client';

const fallbackApi = 'https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment';
const apiBase = () => (process.env.NEXT_PUBLIC_API_URL || fallbackApi).replace(/\/$/, '');

export const ACCOUNT_DEACTIVATED_EVENT = 'employee_portal_account_deactivated';

function isDeactivatedError(status, message) {
  if (status !== 401 && status !== 403) return false;
  const msg = String(message || '');
  return /deactivat|inactive/i.test(msg);
}

function notifyDeactivated() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ACCOUNT_DEACTIVATED_EVENT));
    }
  } catch {
    /* ignore */
  }
}

export const session = {
  get() { try { return JSON.parse(localStorage.getItem('employee_portal_session') || 'null'); } catch { return null; } },
  set(value) { localStorage.setItem('employee_portal_session', JSON.stringify(value)); },
  clear() { localStorage.removeItem('employee_portal_session'); },
};

export async function api(path, options = {}) {
  const current = session.get();
  const headers = {
    ...(current?.token ? { Authorization: `Bearer ${current.token}` } : {}),
    ...(options.headers || {}),
  };
  // Only set JSON content-type when sending a body (avoids unnecessary CORS preflight on GETs)
  if (options.body !== undefined && options.body !== null && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  let response;
  try {
    response = await fetch(`${apiBase()}/api${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    const msg = String(err?.message || '');
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      throw new Error('Unable to reach the server. Check your connection and try again.');
    }
    throw err;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || `Request failed (${response.status})`;
    if (isDeactivatedError(response.status, message)) notifyDeactivated();
    throw new Error(message);
  }
  return data;
}

export async function apiBlob(path, options = {}) {
  const current = session.get();
  const base = apiBase();
  const url = path.startsWith('http') ? path : `${base}/api${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(current?.token ? { Authorization: `Bearer ${current.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data.error || `Failed to download file (${response.status})`;
    if (isDeactivatedError(response.status, message)) notifyDeactivated();
    throw new Error(message);
  }
  return response.blob();
}

export function value(row, ...keys) {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  return '';
}
