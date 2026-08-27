'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, v } from '../../lib/format';

export default function AssetsPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';

  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    assetTag: '',
    name: '',
    category: 'laptop',
    serialNo: '',
  });
  const [assign, setAssign] = useState({ assetId: '', employeeId: '', notes: '' });

  const load = useCallback(() => {
    setError('');
    Promise.all([api('/assets'), api('/employees')])
      .then(([a, e]) => {
        setAssets(a || []);
        setEmployees(e || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createAsset(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/assets', { method: 'POST', body: JSON.stringify(form) });
      setMsg('Asset created.');
      setForm({ assetTag: '', name: '', category: 'laptop', serialNo: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function assignAsset(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api(`/assets/${assign.assetId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(assign.employeeId),
          notes: assign.notes || null,
        }),
      });
      setMsg('Asset assigned.');
      setAssign({ assetId: '', employeeId: '', notes: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function returnAsset(assignmentId) {
    try {
      await api(`/assets/assignments/${assignmentId}/return`, { method: 'PATCH', body: JSON.stringify({}) });
      setMsg('Asset returned.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const available = assets.filter((a) => String(v(a, 'status')) === 'available');

  return (
    <AppShell title="Asset Management" subtitle="Laptops, phones, access cards and assignments">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {isAdmin ? (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="panel-title">
              <h3>Add asset</h3>
            </div>
            <form className="stack" onSubmit={createAsset}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label className="field">
                  Asset tag
                  <input required value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} />
                </label>
                <label className="field">
                  Name
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label className="field">
                  Category
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="laptop">Laptop</option>
                    <option value="phone">Phone</option>
                    <option value="access_card">Access card</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="field">
                  Serial no
                  <input value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} />
                </label>
              </div>
              <button className="btn" type="submit">
                Create asset
              </button>
            </form>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="panel-title">
              <h3>Assign asset</h3>
            </div>
            <form className="stack" onSubmit={assignAsset}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label className="field">
                  Asset
                  <select required value={assign.assetId} onChange={(e) => setAssign({ ...assign, assetId: e.target.value })}>
                    <option value="">Select available…</option>
                    {available.map((a) => (
                      <option key={v(a, 'id')} value={v(a, 'id')}>
                        {v(a, 'assetTag', 'asset_tag')} — {v(a, 'name')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Employee
                  <select required value={assign.employeeId} onChange={(e) => setAssign({ ...assign, employeeId: e.target.value })}>
                    <option value="">Select…</option>
                    {employees.map((e) => (
                      <option key={v(e, 'id')} value={v(e, 'id')}>
                        {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                Notes
                <input value={assign.notes} onChange={(e) => setAssign({ ...assign, notes: e.target.value })} />
              </label>
              <button className="btn" type="submit">
                Assign
              </button>
            </form>
          </div>
        </>
      ) : null}

      <div className="card">
        <div className="panel-title">
          <h3>Inventory</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Name</th>
                <th>Category</th>
                <th>Assigned to</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={v(a, 'id')}>
                  <td>{v(a, 'assetTag', 'asset_tag')}</td>
                  <td>
                    {v(a, 'name')}
                    {v(a, 'serialNo', 'serial_no') ? <div className="muted">{v(a, 'serialNo', 'serial_no')}</div> : null}
                  </td>
                  <td>{String(v(a, 'category') || '').replace('_', ' ')}</td>
                  <td>
                    {v(a, 'assignedTo', 'assigned_to') || '—'}
                    {v(a, 'assignedAt', 'assigned_at') ? <div className="muted">{formatDate(v(a, 'assignedAt', 'assigned_at'))}</div> : null}
                  </td>
                  <td>
                    <Badge status={v(a, 'status')} />
                  </td>
                  <td>
                    {isAdmin && v(a, 'assignmentId', 'assignment_id') ? (
                      <button type="button" className="btn secondary" onClick={() => returnAsset(v(a, 'assignmentId', 'assignment_id'))}>
                        Return
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
              {!assets.length ? (
                <tr>
                  <td colSpan={6}>No assets yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
