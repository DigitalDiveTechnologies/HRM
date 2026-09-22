'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { api } from '../../../lib/auth';

export default function SettingsRolesPage() {
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api('/rbac/roles')
      .then((rows) => setRoles(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err.message || 'Failed to load roles.'))
      .finally(() => setLoading(false));
  }, []);

  const adminRoles = useMemo(
    () =>
      roles.filter((r) => {
        const code = String(r.code || '').toLowerCase();
        const portal = String(r.portal || '').toLowerCase();
        return code !== 'employee' && (portal === 'admin' || portal === 'users' || code === 'super_admin');
      }),
    [roles],
  );

  return (
    <AppShell title="Roles" subtitle="Admin portal roles — not linked to employees or companies">
      {error ? <div className="error">{error}</div> : null}

      <div className="card roles-card">
        {loading ? (
          <p className="muted" style={{ padding: 16, margin: 0 }}>Loading…</p>
        ) : (
          <>
            <div className="table-wrap roles-table-wrap">
              <table className="roles-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Code</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {adminRoles.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted">No admin portal roles found.</td>
                    </tr>
                  ) : (
                    adminRoles.map((r) => (
                      <tr key={r.id}>
                        <td className="roles-name">{r.name}</td>
                        <td><span className="badge">{r.code}</span></td>
                        <td className="roles-desc">{r.description || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="roles-hint">
              Set access under <strong>Settings → Permissions</strong>. Create logins under <strong>Settings → Users</strong>.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
