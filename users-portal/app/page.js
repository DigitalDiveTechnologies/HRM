'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isSuperAdmin, session } from '@/lib/api';

const emptyForm = { email: '', password: '', displayName: '', roleCode: 'admin' };

export default function UsersHome() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Only HR Admin portal roles (not employee, not another super admin)
  const assignableRoles = useMemo(
    () =>
      roles.filter((r) => {
        const code = String(r.code || '').toLowerCase();
        const portal = String(r.portal || '').toLowerCase();
        return portal === 'admin' && code !== 'super_admin' && code !== 'employee';
      }),
    [roles],
  );

  const load = useCallback(async () => {
    const [roleRows, userRows] = await Promise.all([api('/rbac/roles'), api('/rbac/users')]);
    setRoles(Array.isArray(roleRows) ? roleRows : []);
    setUsers(Array.isArray(userRows) ? userRows : []);
  }, []);

  useEffect(() => {
    const s = session.get();
    if (!s?.token || !isSuperAdmin(s.user)) {
      session.clear();
      router.replace('/login');
      return;
    }
    setUser(s.user);
    (async () => {
      try {
        await load();
      } catch (err) {
        setError(err.message || 'Failed to load users.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router, load]);

  function logout() {
    session.clear();
    router.replace('/login');
  }

  async function createUser(e) {
    e.preventDefault();
    setError('');
    setOk('');
    setBusy(true);
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
      setOk('Portal user created. They can sign in to the HR Admin portal with this role.');
      setForm({ ...emptyForm, roleCode: form.roleCode || 'admin' });
      await load();
    } catch (err) {
      setError(err.message || 'Could not create user.');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId, roleCode) {
    setError('');
    setOk('');
    try {
      await api(`/rbac/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ roleCode }),
      });
      setOk('Role updated.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not update role.');
    }
  }

  async function toggleActive(row) {
    if (String(row.role).toLowerCase() === 'super_admin') return;
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

  if (loading) {
    return (
      <div className="login-page">
        <div className="muted">Loading…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="logo">
            GOCs <span>Users</span>
          </div>
          <div className="tag">Users Portal · UAE</div>
        </div>
        <div className="nav-group">
          <h4>Access</h4>
          <div className="nav">
            <a className="active" href="/">
              Portal users
            </a>
            <button type="button" className="nav-btn" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="page-head">
          <div>
            <h1>Portal users</h1>
            <p>
              Super Admin creates main users and assigns HR Admin / Manager roles. Employee accounts are not listed
              here — they stay on the Employee portal.
            </p>
          </div>
          <div className="user-chip">{user?.fullName || user?.email || 'Super Admin'}</div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}
        {ok ? <div className="ok-box">{ok}</div> : null}

        <div className="grid-2">
          <section className="panel">
            <h2>Assigned users</h2>
            <p className="hint">
              Only users for the HR Admin portal (and Super Admin). Employees created in HR are not shown.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Portal access</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        No portal users yet. Create one on the right.
                      </td>
                    </tr>
                  ) : (
                    users.map((row) => {
                      const isSa = String(row.role).toLowerCase() === 'super_admin';
                      return (
                        <tr key={row.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{row.displayName || row.email}</div>
                            <div className="muted">{row.email}</div>
                          </td>
                          <td>
                            {isSa ? (
                              <span className="badge users">{row.roleName || row.role}</span>
                            ) : (
                              <select
                                value={row.role}
                                onChange={(e) => changeRole(row.id, e.target.value)}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: 8,
                                  border: '1px solid var(--line)',
                                  background: '#fff',
                                }}
                              >
                                {assignableRoles.map((r) => (
                                  <option key={r.code} value={r.code}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${row.portal === 'users' ? 'users' : 'admin'}`}>
                              {row.portal === 'users' ? 'Users portal' : 'HR Admin portal'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${row.isActive ? 'admin' : 'off'}`}>
                              {row.isActive ? 'Active' : 'Off'}
                            </span>
                          </td>
                          <td>
                            {!isSa ? (
                              <button type="button" className="btn btn-ghost" onClick={() => toggleActive(row)}>
                                {row.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            ) : (
                              <span className="muted">Protected</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Create portal user</h2>
            <p className="hint">Assign Admin or Manager — they sign in to the existing HR Admin portal.</p>
            <form className="form" onSubmit={createUser}>
              <label>
                Display name
                <input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="e.g. Sara HR"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@company.com"
                />
              </label>
              <label>
                Temporary password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 characters"
                />
              </label>
              <label>
                Role
                <select
                  required
                  value={form.roleCode}
                  onChange={(e) => setForm({ ...form, roleCode: e.target.value })}
                >
                  {assignableRoles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create & assign role'}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
