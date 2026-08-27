'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';

export default function CompliancePage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';

  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    title: '',
    category: 'document',
    dueDate: todayISO(),
    notes: '',
  });

  const load = useCallback(() => {
    setError('');
    Promise.all([api('/compliance'), api('/employees')])
      .then(([items, emps]) => {
        setRows(items || []);
        setEmployees(emps || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createItem(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/compliance', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          dueDate: form.dueDate || null,
          notes: form.notes || null,
          employeeId: form.employeeId ? Number(form.employeeId) : 0,
        }),
      });
      setMsg('Compliance item created.');
      setForm({
        employeeId: '',
        title: '',
        category: 'document',
        dueDate: todayISO(),
        notes: '',
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(id, status) {
    setMsg('');
    setError('');
    try {
      await api(`/compliance/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(`Marked ${status}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title="Compliance Management" subtitle="Labour law, visa, documents & audit follow-ups">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Add compliance item</h3>
          </div>
          <form className="stack" onSubmit={createItem}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Employee (optional)
                <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                  <option value="">Company-wide</option>
                  {employees.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Category
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="labor_law">Labour law</option>
                  <option value="visa">Visa</option>
                  <option value="document">Document</option>
                  <option value="audit">Audit</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                Title
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="field">
                Due date
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </label>
            </div>
            <label className="field">
              Notes
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <button className="btn" type="submit">
              Create item
            </button>
          </form>
        </div>
      ) : null}

      <div className="card">
        <div className="panel-title">
          <h3>Compliance tracker</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Employee</th>
                <th>Category</th>
                <th>Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = v(r, 'id');
                const status = String(v(r, 'status') || '');
                return (
                  <tr key={id}>
                    <td>
                      {v(r, 'title')}
                      {v(r, 'notes') ? <div className="muted">{v(r, 'notes')}</div> : null}
                    </td>
                    <td>
                      {v(r, 'fullName', 'full_name') || '—'}
                      {v(r, 'empCode', 'emp_code') ? <div className="muted">{v(r, 'empCode', 'emp_code')}</div> : null}
                    </td>
                    <td>{String(v(r, 'category') || '').replace('_', ' ')}</td>
                    <td>{formatDate(v(r, 'dueDate', 'due_date'))}</td>
                    <td>
                      <Badge status={status} />
                    </td>
                    <td>
                      {isAdmin && status !== 'compliant' && status !== 'closed' ? (
                        <div className="row-actions">
                          <button type="button" className="btn ok" onClick={() => setStatus(id, 'compliant')}>
                            Compliant
                          </button>
                          <button type="button" className="btn secondary" onClick={() => setStatus(id, 'closed')}>
                            Close
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={6}>No compliance items yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
