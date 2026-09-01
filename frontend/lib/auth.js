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
  const role = String(user?.role || 'employee').toLowerCase();
  if (role === 'admin' || role === 'manager' || role === 'employee') return role;
  return 'employee';
}

/** HR web portal — administrators only. */
export function canUsePortal(user) {
  return normalizeRole(user) === 'admin';
}

export function homeForRole(user) {
  return '/dashboard';
}

/** Portal keeps the session on 401 — admin signs out manually when needed. */
export function handleUnauthorized() {
  /* no-op: avoid forced redirect / auto logout on expired JWT */
}

function statusMessage(status, data) {
  if (data?.error || data?.title) return data.error || data.title;
  if (status === 401) return 'Session expired — please sign in again.';
  if (status === 403) return 'You do not have permission for this action.';
  return `Request failed (${status})`;
}

export async function api(path, options = {}) {
  const skipAuth = options.skipAuth === true || path.startsWith('/auth/login');
  const { skipAuth: _omit, ...fetchOptions } = options;
  const token = skipAuth ? null : getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${getApiBase()}/api${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch {
    throw new Error('Cannot reach the HR API. Check that the backend is running and CORS allows this portal URL.');
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
    res = await fetch(`${getApiBase()}/api${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch {
    throw new Error('Cannot reach the HR API. Check that the backend is running and CORS allows this portal URL.');
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
    res = await fetch(`${getApiBase()}/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('Cannot reach the HR API. Check that the backend is running and CORS allows this portal URL.');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(statusMessage(res.status, data));
  }
  return res.blob();
}

/** @deprecated Prefer getApiBase() — kept for older imports. */
export const API_BASE = PRODUCTION_API;
