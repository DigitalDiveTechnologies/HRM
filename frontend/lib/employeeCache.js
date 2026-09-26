import { api } from './auth';
import { fetchEmployeesDirect } from './dbDirect';
import { v } from './format';

export function sortEmployeesLatest(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const idA = Number(v(a, 'id') || 0);
    const idB = Number(v(b, 'id') || 0);
    if (idA !== idB && !isNaN(idA) && !isNaN(idB)) return idB - idA;
    const codeA = parseInt(String(v(a, 'empCode', 'emp_code') || '').replace(/\D/g, ''), 10) || 0;
    const codeB = parseInt(String(v(b, 'empCode', 'emp_code') || '').replace(/\D/g, ''), 10) || 0;
    if (codeA !== codeB) return codeB - codeA;
    const tA = new Date(v(a, 'createdAt', 'created_at', 'joinDate', 'join_date') || 0).getTime();
    const tB = new Date(v(b, 'createdAt', 'created_at', 'joinDate', 'join_date') || 0).getTime();
    return tB - tA;
  });
}

/**
 * Synchronously retrieves cached employees immediately (0ms latency).
 * Checks both gocs_cached_employees and gocs_cached_dashboard.
 */
export function getInstantEmployees() {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem('gocs_cached_employees');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortEmployeesLatest(parsed);
      }
    }
    const dashCached = localStorage.getItem('gocs_cached_dashboard');
    if (dashCached) {
      const d = JSON.parse(dashCached);
      if (Array.isArray(d?.employees) && d.employees.length > 0) {
        return sortEmployeesLatest(d.employees);
      }
    }
  } catch {}
  return [];
}

/**
 * Persists employees to cache and broadcasts update to all components.
 */
export function writeEmployeesCache(list) {
  if (typeof window === 'undefined' || !Array.isArray(list) || !list.length) return;
  const sorted = sortEmployeesLatest(list);
  try {
    localStorage.setItem('gocs_cached_employees', JSON.stringify(sorted));
    const dashCached = localStorage.getItem('gocs_cached_dashboard');
    if (dashCached) {
      const d = JSON.parse(dashCached);
      if (d && typeof d === 'object') {
        d.employees = sorted;
        if (d.dash) {
          d.dash.headcount = Math.max(Number(d.dash.headcount || 0), sorted.length);
          d.dash.totalEmployees = Math.max(Number(d.dash.totalEmployees || 0), sorted.length);
        }
        localStorage.setItem('gocs_cached_dashboard', JSON.stringify(d));
      }
    }
    window.dispatchEvent(new CustomEvent('gocs_employees_updated', { detail: sorted }));
  } catch {}
}

/**
 * Loads employees with multi-tier speed:
 * 1. Calls onData immediately if cached data exists (0ms).
 * 2. Fetches via direct Neon SQL query (<150ms).
 * 3. Fetches via backend API endpoint.
 * Also subscribes to change events so dropdowns everywhere stay updated.
 */
export function loadEmployeesFast(onData) {
  if (typeof onData !== 'function') return () => {};

  // Step 1: Instant cache
  const instant = getInstantEmployees();
  if (instant.length > 0) {
    onData(instant);
  }

  let isMounted = true;

  // Step 2: Direct DB query (Neon HTTP SQL - ultra fast)
  fetchEmployeesDirect()
    .then((directRows) => {
      if (!isMounted || !Array.isArray(directRows) || !directRows.length) return;
      const sorted = sortEmployeesLatest(directRows);
      onData(sorted);
      writeEmployeesCache(sorted);
    })
    .catch(() => {});

  // Step 3: Backend API fallback / sync
  api('/employees')
    .then((apiRows) => {
      if (!isMounted || !Array.isArray(apiRows) || !apiRows.length) return;
      const sorted = sortEmployeesLatest(apiRows);
      onData(sorted);
      writeEmployeesCache(sorted);
    })
    .catch(() => {
      // If /employees requires employees.list, try safe directory endpoint
      api('/employees/directory')
        .then((dirRows) => {
          if (!isMounted || !Array.isArray(dirRows) || !dirRows.length) return;
          const sorted = sortEmployeesLatest(dirRows);
          onData(sorted);
          writeEmployeesCache(sorted);
        })
        .catch(() => {});
    });

  // Step 4: Sync listener
  const handleUpdate = (e) => {
    if (!isMounted) return;
    if (e?.detail && Array.isArray(e.detail)) {
      onData(sortEmployeesLatest(e.detail));
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('gocs_employees_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
  }

  return () => {
    isMounted = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('gocs_employees_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    }
  };
}
