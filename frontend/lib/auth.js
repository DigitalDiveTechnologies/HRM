const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5088';

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
    res = await fetch(`${API_BASE}/api${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch {
    throw new Error('Cannot reach API. Is the backend running on port 5088?');
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
    res = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch {
    throw new Error('Cannot reach API. Is the backend running on port 5088?');
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
    res = await fetch(`${API_BASE}/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('Cannot reach API. Is the backend running on port 5088?');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(statusMessage(res.status, data));
  }
  return res.blob();
}

export { API_BASE };
