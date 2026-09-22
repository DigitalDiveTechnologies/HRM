'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { api, normalizeRole, getUser } from '../../../lib/auth';

const emptyForm = { email: '', password: '', displayName: '', roleCode: 'admin' };

export default function SettingsUsersPage() {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [edit, setEdit] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [showEditPass, setShowEditPass] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const assignableRoles = useMemo(
    () =>
      roles.filter((r) => {
        const code = String(r.code || '').toLowerCase();
        const portal = String(r.portal || '').toLowerCase();
        return (portal === 'admin' || portal === 'users') && code !== 'super_admin' && code !== 'employee';
      }),
    [roles],
  );

  const load = useCallback(async () => {
    const [roleRows, userRows] = await Promise.all([api('/rbac/roles'), api('/rbac/users')]);
    const rolesList = Array.isArray(roleRows) ? roleRows : [];
    setRoles(rolesList);
    setUsers(Array.isArray(userRows) ? userRows : []);
    const firstAssignable = rolesList.find((r) => {
      const code = String(r.code || '').toLowerCase();
      const portal = String(r.portal || '').toLowerCase();
      return (portal === 'admin' || portal === 'users') && code !== 'super_admin' && code !== 'employee';
    });
    if (firstAssignable) {
      setForm((f) => {
        const stillValid = rolesList.some(
          (r) => String(r.code).toLowerCase() === String(f.roleCode).toLowerCase(),
        );
        return stillValid ? f : { ...f, roleCode: firstAssignable.code };
      });
    }
  }, []);

  useEffect(() => {
    const me = getUser();
    const role = normalizeRole(me);
    if (role !== 'super_admin' && role !== 'admin') return;
    setLoading(true);
    load()
      .catch((err) => setError(err.message || 'Failed to load users.'))
      .finally(() => setLoading(false));
  }, [load]);

  async function createUser(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api('/rbac/users', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          displayName: form.displayName.trim() || null,
          roleCode: form.roleCode,
        }),
      });
      setShowPass(false);
      setForm({ ...emptyForm, roleCode: form.roleCode || 'admin' });
      setOk('User created.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not create user.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row) {
    if (String(row.role).toLowerCase() === 'super_admin') return;
    if (!window.confirm(row.isActive ? 'Deactivate this user? They will not be able to sign in.' : 'Activate this user?')) return;
    setError('');
    setOk('');
    try {
      await api(`/rbac/users/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      setOk(row.isActive ? 'User deactivated.' : 'User activated.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not update user.');
    }
  }

  async function deleteUser(row) {
    if (String(row.role).toLowerCase() === 'super_admin') return;
    if (!window.confirm('Delete this user permanently?')) return;
    setError('');
    setOk('');
    try {
      await api(`/rbac/users/${row.id}`, { method: 'DELETE' });
      setOk('User deleted.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete user.');
    }
  }

  function openEdit(row) {
    if (String(row.role).toLowerCase() === 'super_admin') return;
    setShowEditPass(false);
    setEdit({
      id: row.id,
      displayName: row.displayName || '',
      email: row.email,
      roleCode: row.role,
      password: '',
    });
    setError('');
    setOk('');
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError('');
    setOk('');
    try {
      const body = {
        displayName: edit.displayName.trim() || null,
        roleCode: edit.roleCode,
      };
      if (edit.password.trim()) body.password = edit.password.trim();
      await api(`/rbac/users/${edit.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setEdit(null);
      setOk('User updated.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not update user.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Users" subtitle="Create users and assign roles for the HR Admin portal">
      {error ? <div className="error">{error}</div> : null}
      {ok ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{ok}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Assigned users</h2>
        <p className="muted" style={{ marginTop: 0 }}>Only Super Admin and Admin portal users. Employees are not listed here.</p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">No portal users yet. Create one below.</td>
                  </tr>
                ) : (
                  users.map((row) => {
                    const isSa = String(row.role).toLowerCase() === 'super_admin';
                    return (
                      <tr key={row.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{row.displayName || row.email}</div>
                          <div className="muted" style={{ fontSize: '0.85rem' }}>{row.email}</div>
                        </td>
                        <td>
                          <span className="badge">{row.roleName || row.role}</span>
                        </td>
                        <td>
                          <span className={`badge ${row.isActive ? '' : 'off'}`}>
                            {row.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          {isSa ? (
                            <span className="muted">—</span>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button type="button" className="btn secondary" onClick={() => openEdit(row)}>Edit</button>
                              <button type="button" className="btn secondary" onClick={() => toggleActive(row)}>
                                {row.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button type="button" className="btn danger" onClick={() => deleteUser(row)}>Delete</button>
                            </div>
                          )}
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

      {edit ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Edit user</h2>
          <form className="form form-create" onSubmit={saveEdit}>
            <label>
              Display name
              <input value={edit.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })} />
            </label>
            <label>
              Email
              <input type="email" value={edit.email} disabled />
            </label>
            <label>
              New password (optional)
              <div className="password-field">
                <input
                  type={showEditPass ? 'text' : 'password'}
                  minLength={6}
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                />
                <button type="button" className="password-eye" onClick={() => setShowEditPass((v) => !v)}>
                  {showEditPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <label>
              Role
              <select value={edit.roleCode} onChange={(e) => setEdit({ ...edit, roleCode: e.target.value })}>
                {assignableRoles.map((r) => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-fit" disabled={busy}>Save</button>
              <button type="button" className="btn secondary btn-fit" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Create portal user</h2>
        <form className="form form-create" onSubmit={createUser}>
          <label>
            Display name
            <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </label>
          <label>
            Email
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button type="button" className="password-eye" onClick={() => setShowPass((v) => !v)}>
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          <label>
            Role
            <select required value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })}>
              {assignableRoles.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-fit" disabled={busy}>Create &amp; assign role</button>
        </form>
      </div>
    </AppShell>
  );
}
