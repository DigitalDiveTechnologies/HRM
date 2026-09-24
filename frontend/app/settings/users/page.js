'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import { api, normalizeRole, getUser } from '../../../lib/auth';
import { SETTINGS_USERS_ROLES_ENABLED } from '../../../lib/nav';
import { notifySettingsRbacChanged, subscribeSettingsRbacChanged } from '../../../lib/settingsSync';

const emptyForm = { email: '', password: '', displayName: '', roleCode: 'admin' };

export default function SettingsUsersPage() {
  const router = useRouter();
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
  const editRef = useRef(null);

  const assignableRoles = useMemo(() => {
    const preferred = ['admin', 'manager', 'hr_officer', 'finance', 'viewer'];
    const filtered = roles.filter((r) => {
      const code = String(r.code || '').toLowerCase();
      const portal = String(r.portal || '').toLowerCase();
      return (portal === 'admin' || portal === 'users') && code !== 'super_admin' && code !== 'employee';
    });
    return filtered.sort((a, b) => {
      const ac = String(a.code || '').toLowerCase();
      const bc = String(b.code || '').toLowerCase();
      const ai = preferred.indexOf(ac);
      const bi = preferred.indexOf(bc);
      if (ai === -1 && bi === -1) return String(a.name || '').localeCompare(String(b.name || ''));
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [roles]);

  const editRoleOptions = useMemo(() => {
    const list = [...assignableRoles];
    if (edit && String(edit.roleCode).toLowerCase() === 'super_admin'
      && !list.some((r) => String(r.code).toLowerCase() === 'super_admin')) {
      list.unshift({ code: 'super_admin', name: edit.roleName || 'Super Admin' });
    }
    return list;
  }, [assignableRoles, edit]);

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
    if (!SETTINGS_USERS_ROLES_ENABLED) {
      router.replace('/settings/permissions');
      return;
    }
    const me = getUser();
    const role = normalizeRole(me);
    if (role !== 'super_admin' && role !== 'admin') return;
    setLoading(true);
    load()
      .catch((err) => setError(err.message || 'Failed to load users.'))
      .finally(() => setLoading(false));
  }, [load, router]);

  useEffect(() => {
    if (!edit || !editRef.current) return;
    editRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [edit]);

  useEffect(() => {
    return subscribeSettingsRbacChanged((detail) => {
      const t = String(detail?.type || '');
      if (t.startsWith('role_') || t === 'rbac_reload') {
        // Soft-refresh roles for the dropdown — no loading flash
        api('/rbac/roles')
          .then((roleRows) => {
            const rolesList = Array.isArray(roleRows) ? roleRows : [];
            setRoles(rolesList);
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
          })
          .catch(() => {});
      }
    });
  }, []);

  function upsertUser(row) {
    if (!row?.id) return;
    setUsers((prev) => {
      const i = prev.findIndex((u) => u.id === row.id);
      if (i === -1) return [...prev, row];
      const next = prev.slice();
      next[i] = { ...prev[i], ...row };
      return next;
    });
  }

  async function createUser(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const created = await api('/rbac/users', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          displayName: form.displayName.trim() || null,
          roleCode: form.roleCode,
        }),
      });
      if (created?.id) upsertUser(created);
      else await load();
      setShowPass(false);
      setForm({ ...emptyForm, roleCode: form.roleCode || 'admin' });
      setOk('User created.');
      notifySettingsRbacChanged({ type: 'user_created', user: created });
    } catch (err) {
      setError(err.message || 'Could not create user.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row) {
    setError('');
    setOk('');
    try {
      const updated = await api(`/rbac/users/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (updated?.id) upsertUser(updated);
      else {
        setUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, isActive: !row.isActive } : u)));
      }
      setOk(row.isActive ? 'User deactivated.' : 'User activated.');
      notifySettingsRbacChanged({ type: 'user_updated', user: updated });
    } catch (err) {
      setError(err.message || 'Could not update user.');
    }
  }

  async function deleteUser(row) {
    setError('');
    setOk('');
    try {
      await api(`/rbac/users/${row.id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== row.id));
      setOk('User deleted.');
      if (edit?.id === row.id) setEdit(null);
      notifySettingsRbacChanged({ type: 'user_deleted', userId: row.id });
    } catch (err) {
      setError(err.message || 'Could not delete user.');
    }
  }

  function openEdit(row) {
    setShowEditPass(false);
    setEdit({
      id: row.id,
      displayName: row.displayName || row.DisplayName || '',
      email: row.email || row.Email || '',
      roleCode: String(row.role || row.Role || 'admin').toLowerCase(),
      roleName: row.roleName || row.RoleName || row.role || '',
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
        email: (edit.email || '').trim(),
        displayName: (edit.displayName || '').trim() || null,
        roleCode: String(edit.roleCode || '').trim().toLowerCase(),
      };
      if (!body.email || !body.email.includes('@')) {
        throw new Error('A valid email is required.');
      }
      const pw = (edit.password || '').trim();
      if (pw) {
        if (pw.length < 6) throw new Error('Password must be at least 6 characters.');
        body.password = pw;
      }
      const updated = await api(`/rbac/users/${edit.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (updated?.id) upsertUser(updated);
      else await load();
      setEdit(null);
      setOk('User updated.');
      notifySettingsRbacChanged({ type: 'user_updated', user: updated });
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

      {edit ? (
        <div className="card create-user-card" style={{ marginBottom: 16 }} ref={editRef}>
          <h2 className="create-user-title">Edit user</h2>
          <form className="create-user-form" onSubmit={saveEdit} autoComplete="off">
            <label className="create-user-field">
              <span>Display name</span>
              <input
                placeholder="e.g. Sara HR"
                value={edit.displayName}
                onChange={(e) => setEdit({ ...edit, displayName: e.target.value })}
              />
            </label>
            <label className="create-user-field">
              <span>Email</span>
              <input
                type="email"
                required
                value={edit.email}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
              />
            </label>
            <label className="create-user-field">
              <span>New password (optional)</span>
              <div className="password-field">
                <input
                  type={showEditPass ? 'text' : 'password'}
                  placeholder="Leave blank to keep current"
                  autoComplete="new-password"
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                />
                <button type="button" className="password-eye" onClick={() => setShowEditPass((v) => !v)}>
                  {showEditPass ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <label className="create-user-field">
              <span>Role</span>
              <select
                required
                value={edit.roleCode}
                onChange={(e) => setEdit({ ...edit, roleCode: e.target.value })}
              >
                {editRoleOptions.map((r) => (
                  <option key={r.code} value={String(r.code).toLowerCase()}>{r.name}</option>
                ))}
              </select>
            </label>
            <div className="create-user-actions">
              <button type="submit" className="btn btn-fit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn secondary btn-fit" onClick={() => setEdit(null)} disabled={busy}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Assigned users</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Portal users you create. Super Admin is the master login and is not listed here — delete all here can go to 0.
        </p>
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
                          <label className="status-toggle" title={row.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}>
                            <input
                              type="checkbox"
                              checked={Boolean(row.isActive)}
                              onChange={() => toggleActive(row)}
                            />
                            <span className="status-toggle-ui" aria-hidden="true" />
                            <span className="status-toggle-text">{row.isActive ? 'Active' : 'Inactive'}</span>
                          </label>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="btn secondary" onClick={() => openEdit(row)}>Edit</button>
                            <button type="button" className="btn danger" onClick={() => deleteUser(row)}>Delete</button>
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

      <div className="card create-user-card">
        <h2 className="create-user-title">Create portal user</h2>
        <form className="create-user-form" onSubmit={createUser} autoComplete="off">
          <label className="create-user-field">
            <span>Display name</span>
            <input
              placeholder="e.g. Sara HR"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </label>
          <label className="create-user-field">
            <span>Email</span>
            <input
              type="email"
              required
              placeholder="name@company.com"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="create-user-field">
            <span>Password</span>
            <div className="password-field">
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button type="button" className="password-eye" onClick={() => setShowPass((v) => !v)}>
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          <label className="create-user-field">
            <span>Role</span>
            <select
              required
              value={form.roleCode}
              onChange={(e) => setForm({ ...form, roleCode: e.target.value })}
            >
              {assignableRoles.length === 0 ? (
                <option value="">No roles available</option>
              ) : (
                assignableRoles.map((r) => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))
              )}
            </select>
          </label>
          <button type="submit" className="btn btn-fit create-user-submit" disabled={busy || !assignableRoles.length}>
            Create User
          </button>
        </form>
      </div>
    </AppShell>
  );
}
