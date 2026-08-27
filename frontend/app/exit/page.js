'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';

export default function ExitPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';

  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    exitType: 'resignation',
    reason: '',
    noticeDate: todayISO(),
    lastWorkingDate: todayISO(),
    settlementNotes: '',
  });

  const load = useCallback(() => {
    setError('');
    Promise.all([api('/exit'), api('/employees')])
      .then(([exits, emps]) => {
        setRows(exits || []);
        setEmployees(emps || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openChecklist(id) {
    setSelectedId(id);
    try {
      const items = await api(`/exit/${id}/checklist`);
      setChecklist(items || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function createExit(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/exit', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          employeeId: Number(form.employeeId),
        }),
      });
      setMsg('Exit case opened with clearance checklist.');
      setForm({
        employeeId: '',
        exitType: 'resignation',
        reason: '',
        noticeDate: todayISO(),
        lastWorkingDate: todayISO(),
        settlementNotes: '',
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markItem(id, status) {
    try {
      await api(`/exit/checklist/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (selectedId) openChecklist(selectedId);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function setCaseStatus(id, status) {
    try {
      await api(`/exit/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(status === 'completed' ? 'Exit completed — employee marked exited.' : `Case marked ${status}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title="Employee Exit" subtitle="Resignation, clearance, settlement & asset recovery">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Open exit case</h3>
          </div>
          <form className="stack" onSubmit={createExit}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Employee
                <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Type
                <select value={form.exitType} onChange={(e) => setForm({ ...form, exitType: e.target.value })}>
                  <option value="resignation">Resignation</option>
                  <option value="termination">Termination</option>
                  <option value="end_of_contract">End of contract</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                Notice date
                <input type="date" value={form.noticeDate} onChange={(e) => setForm({ ...form, noticeDate: e.target.value })} />
              </label>
              <label className="field">
                Last working day
                <input type="date" value={form.lastWorkingDate} onChange={(e) => setForm({ ...form, lastWorkingDate: e.target.value })} />
              </label>
            </div>
            <label className="field">
              Reason
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
            <label className="field">
              Settlement notes
              <textarea rows={2} value={form.settlementNotes} onChange={(e) => setForm({ ...form, settlementNotes: e.target.value })} />
            </label>
            <button className="btn" type="submit">
              Start exit process
            </button>
          </form>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Exit cases</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Last day</th>
                <th>Settlement / EOSB</th>
                <th>Clearance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={v(r, 'id')}>
                  <td>
                    {v(r, 'fullName', 'full_name')}
                    <div className="muted">{v(r, 'empCode', 'emp_code')}</div>
                  </td>
                  <td>{v(r, 'exitType', 'exit_type')}</td>
                  <td>{formatDate(v(r, 'lastWorkingDate', 'last_working_date'))}</td>
                  <td style={{ maxWidth: 220 }}>
                    <div className="muted" style={{ fontSize: 12 }}>{v(r, 'settlementNotes', 'settlement_notes') || '—'}</div>
                  </td>
                  <td>
                    {v(r, 'checklistDone', 'checklist_done') || 0}/{v(r, 'checklistTotal', 'checklist_total') || 0}
                  </td>
                  <td>
                    <Badge status={v(r, 'status')} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn secondary" onClick={() => openChecklist(v(r, 'id'))}>
                        Checklist
                      </button>
                      {isAdmin && String(v(r, 'status')) !== 'completed' ? (
                        <button type="button" className="btn ok" onClick={() => setCaseStatus(v(r, 'id'), 'completed')}>
                          Complete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7}>No exit cases yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId ? (
        <div className="card">
          <div className="panel-title">
            <h3>Clearance checklist #{selectedId}</h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((c) => (
                  <tr key={v(c, 'id')}>
                    <td>{v(c, 'title')}</td>
                    <td>{v(c, 'category')}</td>
                    <td>
                      <Badge status={v(c, 'status')} />
                    </td>
                    <td>
                      {String(v(c, 'status')) !== 'done' ? (
                        <button type="button" className="btn secondary" onClick={() => markItem(v(c, 'id'), 'done')}>
                          Mark done
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
