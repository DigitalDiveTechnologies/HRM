'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../../../components/AppShell';
import { api } from '../../../lib/auth';

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="var(--ok)" />
      <path d="M6 10.2l2.4 2.4L14 7.2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="var(--danger)" />
      <path d="M7 7l6 6M13 7l-6 6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function SettingsPermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [grants, setGrants] = useState({});
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await api('/rbac/permission-matrix');
    setRoles(Array.isArray(data.roles) ? data.roles : []);
    setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
    setGrants(data.grants && typeof data.grants === 'object' ? data.grants : {});
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err.message || 'Failed to load permissions.'))
      .finally(() => setLoading(false));
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const p of permissions) {
      const key = p.groupCode || 'other';
      if (!map.has(key)) map.set(key, { code: key, name: p.groupName || key, items: [] });
      map.get(key).items.push(p);
    }
    return Array.from(map.values());
  }, [permissions]);

  function isGranted(roleCode, permCode) {
    const list = grants[roleCode] || grants[String(roleCode).toLowerCase()] || [];
    return list.map((c) => String(c).toLowerCase()).includes(String(permCode).toLowerCase());
  }

  function toggle(roleCode, permCode) {
    setOk('');
    setGrants((prev) => {
      const key = roleCode;
      const current = new Set((prev[key] || []).map((c) => String(c)));
      const code = String(permCode);
      if (current.has(code)) current.delete(code);
      else current.add(code);
      return { ...prev, [key]: Array.from(current) };
    });
  }

  async function save() {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const payload = { grants: {} };
      for (const role of roles) {
        payload.grants[role.code] = grants[role.code] || [];
      }
      const data = await api('/rbac/permission-matrix', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setRoles(Array.isArray(data.roles) ? data.roles : roles);
      setPermissions(Array.isArray(data.permissions) ? data.permissions : permissions);
      setGrants(data.grants && typeof data.grants === 'object' ? data.grants : grants);
      setOk('Permissions saved.');
    } catch (err) {
      setError(err.message || 'Could not save permissions.');
    } finally {
      setBusy(false);
    }
  }

  function indentClass(p) {
    if (!p.parentCode) return '';
    if (String(p.parentCode).includes('.')) return 'perm-indent-2';
    return 'perm-indent-1';
  }

  return (
    <AppShell title="Permissions" subtitle="Tick = assigned · Cross = denied. Save to apply for each role.">
      {error ? <div className="error">{error}</div> : null}
      {ok ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{ok}</div> : null}

      <div className="card perm-matrix-card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="table-wrap perm-matrix-wrap">
              <table className="perm-matrix">
                <thead>
                  <tr>
                    <th className="perm-col-name">Permission</th>
                    {roles.map((r) => (
                      <th key={r.code} className="perm-col-role">{r.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <FragmentGroup key={g.code} group={g} roles={roles} isGranted={isGranted} toggle={toggle} indentClass={indentClass} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="perm-matrix-actions">
              <button type="button" className="btn btn-fit" disabled={busy} onClick={save}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function FragmentGroup({ group, roles, isGranted, toggle, indentClass }) {
  return (
    <Fragment>
      <tr className="perm-group-row">
        <td colSpan={roles.length + 1}>{group.name}</td>
      </tr>
      {group.items.map((p) => (
        <tr key={p.code}>
          <td className={`perm-col-name ${indentClass(p)}`}>{p.name}</td>
          {roles.map((r) => {
            const on = isGranted(r.code, p.code);
            return (
              <td key={r.code} className="perm-col-role">
                <label className="perm-check">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(r.code, p.code)}
                    aria-label={`${p.name} for ${r.name}`}
                  />
                  <span className="perm-icon">{on ? <CheckIcon /> : <CrossIcon />}</span>
                </label>
              </td>
            );
          })}
        </tr>
      ))}
    </Fragment>
  );
}
