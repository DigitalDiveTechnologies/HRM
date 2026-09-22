'use client';

import { useEffect, useState } from 'react';
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

  return (
    <AppShell title="Roles" subtitle="System roles available for Admin portal users">
      {error ? <div className="error">{error}</div> : null}
      <div className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Code</th>
                  <th>Portal</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td><span className="badge">{r.code}</span></td>
                    <td>{r.portal}</td>
                    <td className="muted">{r.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Assign what each role can open under Settings → Permissions. Create users under Settings → Users.
        </p>
      </div>
    </AppShell>
  );
}
