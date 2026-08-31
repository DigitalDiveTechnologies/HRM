'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { v } from '../../lib/format';

const emptyForm = () => ({
  code: '',
  name: '',
  payrollType: 'wps',
});

export default function DivisionsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError('');
    api('/divisions')
      .then((data) => setRows(data || []))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createDivision(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    setSaving(true);
    try {
      await api('/divisions', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          payrollType: form.payrollType,
        }),
      });
      setMsg('Division created.');
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id, status) {
    setMsg('');
    setError('');
    try {
      await api(`/divisions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMsg(status === 'inactive' ? 'Division deactivated (soft delete).' : 'Division reactivated.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function payrollLabel(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'bank_transfer') return 'Bank transfer';
    return 'WPS (UAE)';
  }

  return (
    <AppShell title="Division Master" subtitle="GOCs companies — Alkidma, Alqat, Overseas, Royal Oceans">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Add division</h3>
        </div>
        <p className="muted" style={{ marginBottom: 12 }}>
          Divisions are never hard-deleted — use <strong>Deactivate</strong> to set inactive.
        </p>
        <form className="stack" onSubmit={createDivision}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <label className="field">
              Code
              <input
                required
                placeholder="e.g. ALKIDMA"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </label>
            <label className="field">
              Name
              <input
                required
                placeholder="e.g. Alkidma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="field">
              Payroll type
              <select value={form.payrollType} onChange={(e) => setForm({ ...form, payrollType: e.target.value })}>
                <option value="wps">WPS (UAE)</option>
                <option value="bank_transfer">Bank transfer (Overseas)</option>
              </select>
            </label>
          </div>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Create division'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="panel-title">
          <h3>All divisions</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Payroll</th>
                <th>Employees</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={v(d, 'id')}>
                  <td>{v(d, 'code')}</td>
                  <td>{v(d, 'name')}</td>
                  <td>{payrollLabel(v(d, 'payrollType', 'payroll_type'))}</td>
                  <td>{v(d, 'employeeCount', 'employee_count') ?? 0}</td>
                  <td>
                    <Badge status={v(d, 'status')} />
                  </td>
                  <td>
                    {String(v(d, 'status')).toLowerCase() === 'active' ? (
                      <button type="button" className="btn secondary" onClick={() => setStatus(v(d, 'id'), 'inactive')}>
                        Deactivate
                      </button>
                    ) : (
                      <button type="button" className="btn secondary" onClick={() => setStatus(v(d, 'id'), 'active')}>
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6}>No divisions yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
