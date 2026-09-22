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

  const assignableRoles = useMemo(
    () => roles.filter((r) => String(r.code).toLowerCase() !== 'super_admin'),
    [roles],
  );

  const load = useCallback(async () => {
    const [roleRows, userRows] = await Promise.all([api('/rbac/roles'), api('/rbac/users')]);
    setRoles(Array.isArray(roleRows) ? roleRows : []);
    setUsers(Array.isArray(userRows) ? userRows : []);
    if (!form.roleCode && roleRows?.length) {
      const first = roleRows.find((r) => r.code !== 'super_admin');
      if (first) setForm((f) => ({ ...f, roleCode: first.code }));
    }
  }, [form.roleCode]);

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
      setOk('User created and role assigned.');
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
    return <div className="login-wrap"><div className="muted">Loading…</div></div>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <div className="brand">GOCs <span>Users</span></div>
          <div className="brand-tag">Super Admin portal</div>
        </div>
        <nav className="nav">
          <a className="active" href="/">Users &amp; roles</a>
          <button type="button" onClick={logout}>Sign out</button>
        </nav>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>Users &amp; roles</h1>
            <p>Create users and assign which portal they can access (RBAC).</p>
          </div>
          <div className="badge users">{user?.fullName || user?.email || 'Super Admin'}</div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}
        {ok ? <div className="ok-box">{ok}</div> : null}

        <div className="grid-2">
          <section className="card">
            <h2 style={{ marginTop: 0, fontSize: 16 }}>All users</h2>
            <p className="muted" style={{ marginTop: -4 }}>
              Role decides portal: Admin → HR portal · Employee → Employee portal · Super Admin → this portal.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Portal</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => {
                    const isSa = String(row.role).toLowerCase() === 'super_admin';
                    return (
                      <tr key={row.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{row.displayName || row.email}</div>
                          <div className="muted">{row.email}</div>
                        </td>
                        <td>
                          {isSa ? (
                            <span className="badge users">{row.roleName || row.role}</span>
                          ) : (
                            <select
                              value={row.role}
                              onChange={(e) => changeRole(row.id, e.target.value)}
                              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)' }}
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
                          <span className={`badge ${row.portal || ''}`}>{row.portal || '—'}</span>
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
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Create user</h2>
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
                Role (portal access)
                <select
                  required
                  value={form.roleCode}
                  onChange={(e) => setForm({ ...form, roleCode: e.target.value })}
                >
                  {assignableRoles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} → {r.portal} portal
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
