'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { api } from '../../../lib/auth';

const emptyRole = { name: '', code: '', description: '' };

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export default function SettingsRolesPage() {
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyRole);

  const load = useCallback(async () => {
    const rows = await api('/rbac/roles');
    setRoles(Array.isArray(rows) ? rows : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err.message || 'Failed to load roles.'))
      .finally(() => setLoading(false));
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
      const code = form.code.trim() || slugify(form.name);
      await api('/rbac/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          code: code || null,
          description: form.description.trim() || null,
        }),
      });
      setForm(emptyRole);
      setShowAdd(false);
      setOk('Role created. Assign permissions under Settings → Permissions, then use it in Users.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not create role.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole(row) {
    if (row.isSystem) return;
    if (!window.confirm(`Delete role “${row.name}”? This cannot be undone.`)) return;
    setError('');
    setOk('');
    try {
      await api(`/rbac/roles/${row.id}`, { method: 'DELETE' });
      setOk('Role deleted.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete role.');
    }
  }

  return (
    <AppShell
      title="Roles"
      subtitle="Create roles and control what each role can access on the HR Admin portal."
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
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name,
                    code: f.codeLocked ? f.code : slugify(name),
                  }));
                }}
              />
            </label>
            <label className="create-user-field">
              <span>Code</span>
              <input
                required
                placeholder="e.g. auditor"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: slugify(e.target.value), codeLocked: true })}
              />
            </label>
            <label className="create-user-field">
              <span>Description (optional)</span>
              <input
                placeholder="Short description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <div className="create-user-actions">
              <button type="submit" className="btn btn-fit" disabled={busy}>{busy ? 'Saving…' : 'Create Role'}</button>
              <button
                type="button"
                className="btn secondary btn-fit"
                disabled={busy}
                onClick={() => { setShowAdd(false); setForm(emptyRole); }}
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
                    adminRoles.map((r) => {
                      const custom = !r.isSystem;
                      return (
                        <tr key={r.id}>
                          <td className="roles-name">
                            <span className="roles-name-row">
                              {r.name}
                              {custom ? (
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
                          <td><span className="badge">{r.code}</span></td>
                          <td className="roles-desc">{r.description || '—'}</td>
                        </tr>
                      );
                    })
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
