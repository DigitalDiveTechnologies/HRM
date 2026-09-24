import { firstAllowedPath } from './nav';

/** Live backend on sir's FTP host — used when portal runs on Vercel/stage (not localhost). */
const PRODUCTION_API = 'https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment';

/** Resolve API base at runtime so static builds work without NEXT_PUBLIC_API_URL baked in. */
export function getApiBase() {
  const fromEnv = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5088';
    }
    return PRODUCTION_API;
  }

  return 'http://localhost:5088';
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('hr_token');
  } catch {
    return null;
  }
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('hr_user') || 'null');
  } catch {
    return null;
  }
}

export function setSession(loginResponse) {
  const user = loginResponse.user || loginResponse.User || loginResponse;
  const token = loginResponse.token || loginResponse.Token || '';
  localStorage.setItem('hr_user', JSON.stringify(user));
  localStorage.setItem('hr_token', token);
}

export function clearSession() {
  localStorage.removeItem('hr_user');
  localStorage.removeItem('hr_token');
}

/** True when both user profile and JWT are present. */
export function hasSession() {
  const token = getToken();
  const user = getUser();
  return Boolean(token && user);
}

export function normalizeRole(user) {
  return String(user?.role || 'employee').toLowerCase();
}

/** HR web portal — admin staff, custom roles, manager/employee self-service. */
export function canUsePortal(user) {
  const role = normalizeRole(user);
  return Boolean(role);
}

/** Landing path from granted permissions — /no-access if role has no portal pages. */
export function homeForRole(user) {
  const role = normalizeRole(user);
  const permissions = getPermissions(user);
  return firstAllowedPath(role, permissions) || '/no-access';
}

export function getPermissions(user) {
  const raw = user?.permissions || user?.Permissions || [];
  return Array.isArray(raw) ? raw.map((c) => String(c)) : [];
}

/** Portal keeps the session on 401 — admin signs out manually when needed. */
export function handleUnauthorized() {
  /* no-op: avoid forced redirect / auto logout on expired JWT */
}

function statusMessage(status, data) {
  if (data?.error || data?.title) return data.error || data.title;
  if (status === 401) return 'Session expired — please sign in again.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 502 || status === 503 || status === 504) {
    return 'Service is updating. Please try again in a moment.';
  }
  return `Request failed (${status})`;
}

const REACHABILITY_ERROR = 'Service is updating. Please try again in a moment.';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504 || status === 408;
}

/** Retry when API is briefly offline (IIS app_offline / recycle during deploy). */
async function fetchWithRetry(url, init, { retries = 8, delayMs = 1500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (isRetryableStatus(res.status) && attempt < retries) {
        await sleep(delayMs);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      await sleep(delayMs);
    }
  }
  throw lastErr || new Error(REACHABILITY_ERROR);
}

const inflightGetRequests = new Map();

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  // Deduplicate identical concurrent in-flight GET requests without body
  if (method === 'GET' && !options.body) {
    const key = `${path}::${options.skipAuth ? 'noauth' : (getToken() || '')}`;
    if (inflightGetRequests.has(key)) {
      return inflightGetRequests.get(key);
    }
    const promise = (async () => {
      try {
        return await executeApi(path, options);
      } finally {
        inflightGetRequests.delete(key);
      }
    })();
    inflightGetRequests.set(key, promise);
    return promise;
  }
  return executeApi(path, options);
}

async function executeApi(path, options = {}) {
  const skipAuth = options.skipAuth === true || path.startsWith('/auth/login');
  const { skipAuth: _omit, retries, delayMs, ...fetchOptions } = options;
  const token = skipAuth ? null : getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetchWithRetry(
      `${getApiBase()}/api${path}`,
      { ...fetchOptions, headers },
      { retries: retries ?? 8, delayMs: delayMs ?? 1500 },
    );
  } catch {
    throw new Error(REACHABILITY_ERROR);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(statusMessage(res.status, data));
  }
  return data;
}

/** Multipart upload — do not set Content-Type (browser sets boundary). */
export async function apiUpload(path, formData) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetchWithRetry(
      `${getApiBase()}/api${path}`,
      { method: 'POST', headers, body: formData },
      { retries: 6, delayMs: 1500 },
    );
  } catch {
    throw new Error(REACHABILITY_ERROR);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(statusMessage(res.status, data));
  }
  return data;
}

/** Authenticated binary/blob download (WPS, documents, etc.). */
export async function apiBlob(path) {
  const token = getToken();
  if (!token) {
    throw new Error('Session expired — please sign in again.');
  }

  let res;
  try {
    res = await fetchWithRetry(
      `${getApiBase()}/api${path}`,
      { headers: { Authorization: `Bearer ${token}` } },
      { retries: 6, delayMs: 1500 },
    );
  } catch {
    throw new Error(REACHABILITY_ERROR);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(statusMessage(res.status, data));
  }
  return res.blob();
}

/** @deprecated Prefer getApiBase() — kept for older imports. */
export const API_BASE = PRODUCTION_API;
