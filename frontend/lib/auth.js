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
  const user = loginResponse.user || loginResponse;
  const token = loginResponse.token || '';
  localStorage.setItem('hr_user', JSON.stringify(user));
  localStorage.setItem('hr_token', token);
}

export function clearSession() {
  localStorage.removeItem('hr_user');
  localStorage.removeItem('hr_token');
}

export function normalizeRole(user) {
  const role = String(user?.role || 'employee').toLowerCase();
  if (role === 'admin' || role === 'manager' || role === 'employee') return role;
  return 'employee';
}

export function homeForRole(user) {
  const role = normalizeRole(user);
  if (role === 'employee') return '/ess';
  if (role === 'manager') return '/approvals';
  return '/dashboard';
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.title || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/** Multipart upload — do not set Content-Type (browser sets boundary). */
export async function apiUpload(path, formData) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || data.title || `Upload failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export { API_BASE };
