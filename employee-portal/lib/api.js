'use client';

const apiBase = () => {
  const configured = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://localhost:5088';
  }
  throw new Error('NEXT_PUBLIC_API_URL is not configured');
};

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry transient IIS Softaculous 403 / network blips (same host stability as admin portal). */
async function fetchWithRetry(url, init, { retries = 12, delayMs = 1200 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if ((res.status === 502 || res.status === 503 || res.status === 504 || res.status === 408) && attempt < retries) {
        await sleep(delayMs);
        continue;
      }
      if (res.status === 403 && attempt < retries) {
        const clone = res.clone();
        const data = await clone.json().catch(() => ({}));
        // Empty IIS 403 (IP ban) — retry. Real API permission error has JSON.
        if (!data?.error && !data?.title) {
          await sleep(delayMs);
          continue;
        }
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      await sleep(delayMs);
    }
  }
  throw lastErr || new Error('Unable to reach the server. Check your connection and try again.');
}

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
    response = await fetchWithRetry(`${apiBase()}/api${path}`, {
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
  const response = await fetchWithRetry(url, {
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
