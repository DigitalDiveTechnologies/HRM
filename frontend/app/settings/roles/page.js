'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { api } from '../../../lib/auth';
import { SETTINGS_USERS_ROLES_ENABLED } from '../../../lib/nav';
import { notifySettingsRbacChanged, subscribeSettingsRbacChanged } from '../../../lib/settingsSync';

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export default function SettingsRolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    const rows = await api('/rbac/roles');
    setRoles(Array.isArray(rows) ? rows : []);
  }, []);

  useEffect(() => {
    if (!SETTINGS_USERS_ROLES_ENABLED) {
      router.replace('/settings/permissions');
      return;
    }
    setLoading(true);
    load()
      .catch((err) => setError(err.message || 'Failed to load roles.'))
      .finally(() => setLoading(false));
  }, [load, router]);

  useEffect(() => {
    return subscribeSettingsRbacChanged((detail) => {
      const t = String(detail?.type || '');
      if (t.startsWith('role_') || t === 'rbac_reload') {
        load().catch(() => {});
      }
    });
  }, [load]);

  const adminRoles = useMemo(
    () =>
      roles.filter((r) => {
        const code = String(r.code || '').toLowerCase();
        const portal = String(r.portal || '').toLowerCase();
        return code !== 'employee' && (portal === 'admin' || portal === 'users' || code === 'super_admin');
      }),
    [roles],
  );

  async function createRole(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const trimmed = name.trim();
      const created = await api('/rbac/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
          code: slugify(trimmed) || null,
        }),
      });
      if (created?.id) {
        setRoles((prev) => {
          if (prev.some((r) => r.id === created.id)) return prev;
          return [...prev, created];
        });
      } else {
        await load();
      }
      setName('');
      setShowAdd(false);
      setOk('Role created.');
      notifySettingsRbacChanged({ type: 'role_created', role: created });
    } catch (err) {
      setError(err.message || 'Could not create role.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole(row) {
    if (String(row.code || '').toLowerCase() === 'employee') return;
    setError('');
    setOk('');
    try {
      await api(`/rbac/roles/${row.id}`, { method: 'DELETE' });
      setRoles((prev) => prev.filter((r) => r.id !== row.id));
      setOk('Role deleted.');
      notifySettingsRbacChanged({ type: 'role_deleted', roleId: row.id, code: row.code });
    } catch (err) {
      setError(err.message || 'Could not delete role.');
    }
  }

  return (
    <AppShell
      title="Roles"
      subtitle="Portal roles list. Add a role or delete any role."
      actions={(
        <button type="button" className="btn btn-fit" onClick={() => { setShowAdd(true); setError(''); setOk(''); }}>
          Add New Role
        </button>
      )}
    >
      {error ? <div className="error">{error}</div> : null}
      {ok ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{ok}</div> : null}

      {showAdd ? (
        <div className="card create-user-card" style={{ marginBottom: 16 }}>
          <h2 className="create-user-title">Add New Role</h2>
          <form className="create-user-form" onSubmit={createRole} autoComplete="off">
            <label className="create-user-field">
              <span>Role name</span>
              <input
                required
                minLength={2}
                placeholder="e.g. Auditor"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="create-user-actions">
              <button type="submit" className="btn btn-fit" disabled={busy}>{busy ? 'Saving…' : 'Create Role'}</button>
              <button
                type="button"
                className="btn secondary btn-fit"
                disabled={busy}
                onClick={() => { setShowAdd(false); setName(''); }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="card roles-card">
        {loading ? (
          <p className="muted" style={{ padding: 16, margin: 0 }}>Loading…</p>
        ) : (
          <div className="table-wrap roles-table-wrap">
            <table className="roles-table">
              <thead>
                <tr>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {adminRoles.length === 0 ? (
                  <tr>
                    <td className="muted">No admin portal roles found.</td>
                  </tr>
                ) : (
                  adminRoles.map((r) => {
                    const canDelete = String(r.code || '').toLowerCase() !== 'employee';
                    return (
                      <tr key={r.id}>
                        <td className="roles-name">
                          <span className="roles-name-row">
                            {r.name}
                            {canDelete ? (
                              <button
                                type="button"
                                className="roles-delete-btn"
                                title="Delete role"
                                aria-label={`Delete ${r.name}`}
                                onClick={() => deleteRole(r)}
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                              </button>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
