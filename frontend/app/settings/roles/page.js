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
  const [edit, setEdit] = useState(null);

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

  function openEdit(row) {
    setShowAdd(false);
    setError('');
    setOk('');
    setEdit({
      id: row.id,
      name: String(row.name || ''),
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!edit?.id) return;
    setBusy(true);
    setError('');
    setOk('');
    try {
      const updated = await api(`/rbac/roles/${edit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: String(edit.name || '').trim() }),
      });
      if (updated?.id) {
        setRoles((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      } else {
        await load();
      }
      setEdit(null);
      setOk('Role updated.');
      notifySettingsRbacChanged({ type: 'role_updated', role: updated });
    } catch (err) {
      setError(err.message || 'Could not update role.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole(row) {
    const code = String(row.code || '').toLowerCase();
    if (code === 'employee' || code === 'admin') return;
    if (!window.confirm(`Delete role “${row.name}”? Users keep their login; re-assign a role if needed.`)) return;
    setError('');
    setOk('');
    try {
      await api(`/rbac/roles/${row.id}`, { method: 'DELETE' });
      setRoles((prev) => prev.filter((r) => r.id !== row.id));
      if (edit?.id === row.id) setEdit(null);
      setOk('Role deleted.');
      notifySettingsRbacChanged({ type: 'role_deleted', roleId: row.id, code: row.code });
    } catch (err) {
      setError(err.message || 'Could not delete role.');
    }
  }

  return (
    <AppShell
      title="Roles"
      subtitle="Add, rename, or delete portal roles."
      actions={(
        <button
          type="button"
          className="btn btn-fit"
          onClick={() => {
            setEdit(null);
            setShowAdd(true);
            setError('');
            setOk('');
          }}
        >
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

      {edit ? (
        <div className="card create-user-card" style={{ marginBottom: 16 }}>
          <h2 className="create-user-title">Edit Role</h2>
          <form className="create-user-form" onSubmit={saveEdit} autoComplete="off">
            <label className="create-user-field">
              <span>Role name</span>
              <input
                required
                minLength={2}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </label>
            <div className="create-user-actions">
              <button type="submit" className="btn btn-fit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn secondary btn-fit" onClick={() => setEdit(null)} disabled={busy}>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminRoles.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="muted">No admin portal roles found.</td>
                  </tr>
                ) : (
                  adminRoles.map((r) => {
                    const code = String(r.code || '').toLowerCase();
                    const canDelete = code !== 'employee' && code !== 'admin';
                    return (
                      <tr key={r.id}>
                        <td className="roles-name">{r.name}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="btn secondary" onClick={() => openEdit(r)}>
                              Edit
                            </button>
                            {canDelete ? (
                              <button type="button" className="btn danger" onClick={() => deleteRole(r)}>
                                Delete
                              </button>
                            ) : null}
                          </div>
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
