'use client';

const fallbackApi = 'https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment';
const apiBase = () => (process.env.NEXT_PUBLIC_API_URL || fallbackApi).replace(/\/$/, '');

export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem('users_portal_session') || 'null');
    } catch {
      return null;
    }
  },
  set(value) {
    localStorage.setItem('users_portal_session', JSON.stringify(value));
  },
  clear() {
    localStorage.removeItem('users_portal_session');
  },
};

export function isSuperAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'super_admin';
}

export async function api(path, options = {}) {
  const current = session.get();
  const response = await fetch(`${apiBase()}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(current?.token ? { Authorization: `Bearer ${current.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
