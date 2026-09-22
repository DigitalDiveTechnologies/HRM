'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, isSuperAdmin, session } from '@/lib/api';
import { useLocale } from '@/lib/LocaleContext';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';

const emptyForm = { email: '', password: '', displayName: '', roleCode: 'admin' };

export default function UsersHome() {
  const router = useRouter();
  const { t } = useLocale();
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

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
      setOk(t('createdOk'));
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
      setOk(t('roleUpdated'));
      await load();
    } catch (err) {
      setError(err.message || 'Could not update role.');
    }
  }

  async function toggleActive(row) {
    if (String(row.role).toLowerCase() === 'super_admin') return;
    const confirmMsg = row.isActive ? t('confirmDeactivate') : t('confirmActivate');
    if (!window.confirm(confirmMsg)) return;
    setError('');
    setOk('');
    try {
      await api(`/rbac/users/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      setOk(row.isActive ? t('deactivated') : t('activated'));
      await load();
    } catch (err) {
      setError(err.message || 'Could not update user.');
    }
  }

  async function deleteUser(row) {
    if (String(row.role).toLowerCase() === 'super_admin') return;
    if (!window.confirm(t('confirmDelete'))) return;
    setError('');
    setOk('');
    try {
      await api(`/rbac/users/${row.id}`, { method: 'DELETE' });
      setOk(t('deleted'));
      if (edit?.id === row.id) setEdit(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not delete user.');
    }
  }

  function openEdit(row) {
    if (String(row.role).toLowerCase() === 'super_admin') return;
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
    setError('');
    setOk('');
    setBusy(true);
    try {
      const body = {
        displayName: edit.displayName.trim() || null,
        roleCode: edit.roleCode,
      };
      if (edit.password.trim()) body.password = edit.password.trim();
      await api(`/rbac/users/${edit.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setOk(t('userUpdated'));
      setEdit(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not update user.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="muted">{t('loading')}</div>
      </div>
    );
  }

  const chipName = user?.fullName || user?.email || 'Super Admin';

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
          <h4>{t('overview')}</h4>
          <div className="nav">
            <a className="active" href="/">
              {t('navUsers')}
            </a>
          </div>
        </div>

        <button className="btn logout-btn block" type="button" onClick={logout}>
          {t('logout')}
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="topbar-left">
            <div>
              <h2>{t('portalUsers')}</h2>
              <p>{t('portalUsersSub')}</p>
            </div>
          </div>
          <div className="topbar-right">
            <LanguageToggle />
            <ThemeToggle />
            <div className="user-chip">{chipName} · super_admin</div>
          </div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}
        {ok ? <div className="ok-box">{ok}</div> : null}

        <div className="stack">
          <section className="panel">
            <h2>{t('assignedUsers')}</h2>
            <p className="hint">{t('assignedHint')}</p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('user')}</th>
                    <th>{t('role')}</th>
                    <th>{t('portalAccess')}</th>
                    <th>{t('status')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        {t('emptyUsers')}
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
                                  borderRadius: 6,
                                  border: '1px solid var(--line)',
                                  background: 'var(--chip-bg)',
                                  color: 'var(--ink)',
                                  fontFamily: 'var(--font)',
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
                              {row.portal === 'users' ? t('usersPortal') : t('hrAdminPortal')}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${row.isActive ? 'admin' : 'off'}`}>
                              {row.isActive ? t('active') : t('off')}
                            </span>
                          </td>
                          <td>
                            {!isSa ? (
                              <div className="row-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => openEdit(row)}>
                                  {t('edit')}
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={() => toggleActive(row)}>
                                  {row.isActive ? t('deactivate') : t('activate')}
                                </button>
                                <button type="button" className="btn btn-danger" onClick={() => deleteUser(row)}>
                                  {t('delete')}
                                </button>
                              </div>
                            ) : (
                              <span className="muted">{t('protected')}</span>
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
            <h2>{t('createUser')}</h2>
            <form className="form" onSubmit={createUser} style={{ maxWidth: 520 }}>
              <label>
                {t('displayName')}
                <input
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="e.g. Sara HR"
                />
              </label>
              <label>
                {t('email')}
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@company.com"
                />
              </label>
              <label>
                {t('password')}
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
              <label>
                {t('role')}
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
                {busy ? t('creating') : t('createAssign')}
              </button>
            </form>
          </section>
        </div>
      </main>

      {edit ? (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{t('editUser')}</h3>
            <form className="form" onSubmit={saveEdit}>
              <label>
                {t('displayName')}
                <input
                  value={edit.displayName}
                  onChange={(e) => setEdit({ ...edit, displayName: e.target.value })}
                />
              </label>
              <label>
                {t('email')}
                <input value={edit.email} disabled />
              </label>
              <label>
                {t('role')}
                <select
                  required
                  value={edit.roleCode}
                  onChange={(e) => setEdit({ ...edit, roleCode: e.target.value })}
                >
                  {assignableRoles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('newPasswordOptional')}
                <input
                  type="password"
                  minLength={6}
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>
                  {t('cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
