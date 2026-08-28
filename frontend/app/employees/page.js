'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';

const emptyCreateForm = () => ({
  fullName: '',
  email: '',
  password: '',
  jobTitle: '',
  phone: '',
  departmentId: '',
  managerId: '',
  joinDate: todayISO(),
  status: 'active',
});

export default function EmployeesPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';
  const [rows, setRows] = useState([]);
  const [chart, setChart] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [histForm, setHistForm] = useState({
    jobTitle: '',
    departmentName: '',
    managerName: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  const load = useCallback(() => {
    const tasks = [api('/employees'), api('/org/chart')];
    if (isAdmin) tasks.push(api('/employees/departments'));
    Promise.all(tasks)
      .then(([emps, org, depts]) => {
        setRows(emps || []);
        setChart(org || []);
        if (depts) setDepartments(depts || []);
      })
      .catch((e) => setError(e.message));
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(e) {
    setSelected(e);
    try {
      const h = await api(`/org/history/${v(e, 'id')}`);
      setHistory(h || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addHistory(ev) {
    ev.preventDefault();
    if (!selected) return;
    try {
      await api('/org/history', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(v(selected, 'id')),
          ...histForm,
          endDate: histForm.endDate || null,
        }),
      });
      setHistForm({ jobTitle: '', departmentName: '', managerName: '', startDate: '', endDate: '', notes: '' });
      openDetail(selected);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createEmployee(ev) {
    ev.preventDefault();
    setError('');
    setMsg('');
    setCreating(true);
    try {
      const res = await api('/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName: createForm.fullName.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          jobTitle: createForm.jobTitle.trim(),
          phone: createForm.phone.trim() || null,
          departmentId: createForm.departmentId ? Number(createForm.departmentId) : null,
          managerId: createForm.managerId ? Number(createForm.managerId) : null,
          joinDate: createForm.joinDate || null,
          status: createForm.status,
        }),
      });
      setMsg(
        res.message ||
          `Created ${v(res.employee, 'fullName', 'full_name')} — app login: ${res.login?.email || createForm.email}`,
      );
      setCreateForm(emptyCreateForm());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const roots = chart.filter((c) => !v(c, 'managerId', 'manager_id'));
  const childrenOf = (id) => chart.filter((c) => String(v(c, 'managerId', 'manager_id')) === String(id));

  function TreeNode({ node, depth = 0 }) {
    const kids = childrenOf(v(node, 'id'));
    return (
      <div style={{ marginLeft: depth * 18, marginBottom: 8 }}>
        <div style={{ padding: '8px 10px', borderLeft: '3px solid var(--brand)', background: 'var(--card-soft, transparent)' }}>
          <strong>{v(node, 'fullName', 'full_name')}</strong>
          <div className="muted">
            {v(node, 'jobTitle', 'job_title')} · {v(node, 'departmentName', 'department_name') || '-'}
          </div>
        </div>
        {kids.map((k) => (
          <TreeNode key={v(k, 'id')} node={k} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <AppShell title="Employee Information" subtitle="Profiles, org chart, employment history, ID / passport / visa">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Add employee + app login</h3>
          </div>
          <p className="muted" style={{ marginBottom: 12 }}>
            Creates the HR record and mobile app credentials (employee role). They sign in on the app — not the admin portal.
          </p>
          <form className="stack" onSubmit={createEmployee}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Full name
                <input
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                />
              </label>
              <label className="field">
                Work email (app login)
                <input
                  required
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </label>
              <label className="field">
                App password
                <input
                  required
                  type="password"
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </label>
              <label className="field">
                Category / job title
                <input
                  required
                  placeholder="e.g. Software Engineer, Team Lead, Office Boy"
                  value={createForm.jobTitle}
                  onChange={(e) => setCreateForm({ ...createForm, jobTitle: e.target.value })}
                />
              </label>
              <label className="field">
                Phone
                <input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
              </label>
              <label className="field">
                Department
                <select
                  value={createForm.departmentId}
                  onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {departments.map((d) => (
                    <option key={v(d, 'id')} value={v(d, 'id')}>
                      {v(d, 'name')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Manager
                <select
                  value={createForm.managerId}
                  onChange={(e) => setCreateForm({ ...createForm, managerId: e.target.value })}
                >
                  <option value="">— None —</option>
                  {rows.map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Join date
                <input
                  type="date"
                  value={createForm.joinDate}
                  onChange={(e) => setCreateForm({ ...createForm, joinDate: e.target.value })}
                />
              </label>
              <label className="field">
                Status
                <select
                  value={createForm.status}
                  onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                >
                  <option value="active">active</option>
                  <option value="onboarding">onboarding</option>
                </select>
              </label>
            </div>
            <button className="btn" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create employee'}
            </button>
          </form>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Org chart</h3>
        </div>
        {roots.length ? roots.map((r) => <TreeNode key={v(r, 'id')} node={r} />) : <div className="muted">No org data.</div>}
        {!roots.length && chart.length
          ? chart.map((n) => (
              <div key={v(n, 'id')} className="muted" style={{ marginBottom: 6 }}>
                {v(n, 'fullName', 'full_name')} → {v(n, 'managerName', 'manager_name') || '—'}
              </div>
            ))
          : null}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Title</th>
                <th>Manager</th>
                <th>Join</th>
                <th>Passport Exp</th>
                <th>Visa Exp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={v(e, 'id')} style={{ cursor: 'pointer' }} onClick={() => openDetail(e)}>
                  <td>{v(e, 'empCode', 'emp_code')}</td>
                  <td>
                    {v(e, 'fullName', 'full_name')}
                    <div className="muted">{v(e, 'email')}</div>
                  </td>
                  <td>{v(e, 'departmentName', 'department_name') || '-'}</td>
                  <td>{v(e, 'jobTitle', 'job_title') || '-'}</td>
                  <td>{v(e, 'managerName', 'manager_name') || '-'}</td>
                  <td>{formatDate(v(e, 'joinDate', 'join_date', 'hireDate', 'hire_date'))}</td>
                  <td>{formatDate(v(e, 'passportExpiry', 'passport_expiry'))}</td>
                  <td>{formatDate(v(e, 'visaExpiry', 'visa_expiry'))}</td>
                  <td>
                    <Badge status={v(e, 'status')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="panel-title">
            <h3>Profile · {v(selected, 'fullName', 'full_name')}</h3>
            <button type="button" className="btn secondary" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
            <div>
              <div className="muted">Phone</div>
              <div>{v(selected, 'phone') || '-'}</div>
            </div>
            <div>
              <div className="muted">Join date</div>
              <div>{formatDate(v(selected, 'joinDate', 'join_date'))}</div>
            </div>
            <div>
              <div className="muted">Passport</div>
              <div>{formatDate(v(selected, 'passportExpiry', 'passport_expiry'))}</div>
            </div>
            <div>
              <div className="muted">Visa</div>
              <div>{formatDate(v(selected, 'visaExpiry', 'visa_expiry'))}</div>
            </div>
          </div>

          <h4 style={{ marginBottom: 8 }}>Employment history</h4>
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Dept</th>
                  <th>Manager</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={v(h, 'id')}>
                    <td>{v(h, 'jobTitle', 'job_title')}</td>
                    <td>{v(h, 'departmentName', 'department_name') || '-'}</td>
                    <td>{v(h, 'managerName', 'manager_name') || '-'}</td>
                    <td>{formatDate(v(h, 'startDate', 'start_date'))}</td>
                    <td>{formatDate(v(h, 'endDate', 'end_date')) || 'Present'}</td>
                  </tr>
                ))}
                {!history.length ? (
                  <tr>
                    <td colSpan={5}>No history rows.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {isAdmin ? (
            <form className="stack" onSubmit={addHistory}>
              <div className="panel-title">
                <h3>Add history row</h3>
              </div>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label className="field">
                  Job title
                  <input required value={histForm.jobTitle} onChange={(e) => setHistForm({ ...histForm, jobTitle: e.target.value })} />
                </label>
                <label className="field">
                  Department
                  <input value={histForm.departmentName} onChange={(e) => setHistForm({ ...histForm, departmentName: e.target.value })} />
                </label>
                <label className="field">
                  Manager
                  <input value={histForm.managerName} onChange={(e) => setHistForm({ ...histForm, managerName: e.target.value })} />
                </label>
                <label className="field">
                  Start
                  <input required type="date" value={histForm.startDate} onChange={(e) => setHistForm({ ...histForm, startDate: e.target.value })} />
                </label>
                <label className="field">
                  End
                  <input type="date" value={histForm.endDate} onChange={(e) => setHistForm({ ...histForm, endDate: e.target.value })} />
                </label>
                <label className="field">
                  Notes
                  <input value={histForm.notes} onChange={(e) => setHistForm({ ...histForm, notes: e.target.value })} />
                </label>
              </div>
              <button className="btn" type="submit">
                Save history
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
