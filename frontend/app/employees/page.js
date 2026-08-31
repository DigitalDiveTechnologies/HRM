'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, apiBlob, apiUpload, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';

const emptyCreateForm = () => ({
  fullName: '',
  email: '',
  password: '',
  designationId: '',
  employmentTypeId: '',
  phone: '',
  departmentId: '',
  divisionId: '',
  managerId: '',
  joinDate: todayISO(),
  status: 'active',
});

const editFormFromEmployee = (e) => ({
  phone: v(e, 'phone') || '',
  departmentId: String(v(e, 'departmentId', 'department_id') || ''),
  divisionId: String(v(e, 'divisionId', 'division_id') || ''),
  designationId: String(v(e, 'designationId', 'designation_id') || ''),
  employmentTypeId: String(v(e, 'employmentTypeId', 'employment_type_id') || ''),
  managerId: String(v(e, 'managerId', 'manager_id') || ''),
  joinDate: v(e, 'joinDate', 'join_date') ? String(v(e, 'joinDate', 'join_date')).slice(0, 10) : todayISO(),
  status: v(e, 'status') || 'active',
});

export default function EmployeesPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';
  const [rows, setRows] = useState([]);
  const [chart, setChart] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);
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
    if (isAdmin) {
      tasks.push(api('/employees/departments'));
      tasks.push(api('/divisions?activeOnly=true'));
      tasks.push(api('/designations?activeOnly=true'));
      tasks.push(api('/employment-types?activeOnly=true'));
    }
    Promise.all(tasks)
      .then(([emps, org, depts, divs, desigs, empTypes]) => {
        setRows(emps || []);
        setChart(org || []);
        if (depts) setDepartments(depts || []);
        if (divs) setDivisions(divs || []);
        if (desigs) setDesignations(desigs || []);
        if (empTypes) setEmploymentTypes(empTypes || []);
      })
      .catch((e) => setError(e.message));
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(e) {
    setSelected(e);
    setEditForm(editFormFromEmployee(e));
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
          password: createForm.password.trim(),
          designationId: createForm.designationId ? Number(createForm.designationId) : null,
          employmentTypeId: createForm.employmentTypeId ? Number(createForm.employmentTypeId) : null,
          jobTitle: '',
          phone: createForm.phone.trim() || null,
          departmentId: createForm.departmentId ? Number(createForm.departmentId) : null,
          divisionId: createForm.divisionId ? Number(createForm.divisionId) : null,
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

  async function saveEmployeeEdit(ev) {
    ev.preventDefault();
    if (!selected || !editForm) return;
    setError('');
    setMsg('');
    setSavingEdit(true);
    try {
      const res = await api(`/employees/${v(selected, 'id')}`, {
        method: 'PATCH',
        body: JSON.stringify({
          phone: editForm.phone.trim() || null,
          departmentId: editForm.departmentId ? Number(editForm.departmentId) : null,
          divisionId: editForm.divisionId ? Number(editForm.divisionId) : null,
          designationId: editForm.designationId ? Number(editForm.designationId) : null,
          employmentTypeId: editForm.employmentTypeId ? Number(editForm.employmentTypeId) : null,
          managerId: editForm.managerId ? Number(editForm.managerId) : null,
          joinDate: editForm.joinDate || null,
          status: editForm.status,
        }),
      });
      setMsg(res.message || 'Employee updated.');
      const updated = await api(`/employees/${v(selected, 'id')}`);
      setSelected(updated);
      setEditForm(editFormFromEmployee(updated));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function downloadBulkTemplate() {
    setError('');
    try {
      const blob = await apiBlob('/employees/bulk/template');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee-bulk-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadBulk(ev) {
    ev.preventDefault();
    if (!bulkFile) return;
    setError('');
    setMsg('');
    setBulkUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', bulkFile);
      const res = await apiUpload('/employees/bulk', fd);
      setMsg(`Bulk import: ${res.created || 0} created, ${res.failed || 0} failed.`);
      if (res.errors?.length) setError(res.errors.slice(0, 5).join(' · '));
      setBulkFile(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkUploading(false);
    }
  }

  async function resetAppPassword(ev) {
    ev.preventDefault();
    if (!selected || !resetPassword.trim()) return;
    setError('');
    setMsg('');
    setResetting(true);
    try {
      const res = await api(`/employees/${v(selected, 'id')}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword.trim() }),
      });
      setMsg(res.message || 'App password updated.');
      setResetPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
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
                Designation
                <select
                  required
                  value={createForm.designationId}
                  onChange={(e) => setCreateForm({ ...createForm, designationId: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {designations.map((d) => (
                    <option key={v(d, 'id')} value={v(d, 'id')}>
                      {v(d, 'name')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Employment type
                <select
                  value={createForm.employmentTypeId}
                  onChange={(e) => setCreateForm({ ...createForm, employmentTypeId: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {employmentTypes.map((d) => (
                    <option key={v(d, 'id')} value={v(d, 'id')}>
                      {v(d, 'name')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Phone
                <input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
              </label>
              <label className="field">
                Division / company
                <select
                  value={createForm.divisionId}
                  onChange={(e) => setCreateForm({ ...createForm, divisionId: e.target.value })}
                >
                  <option value="">— Select —</option>
                  {divisions.map((d) => (
                    <option key={v(d, 'id')} value={v(d, 'id')}>
                      {v(d, 'name')} ({v(d, 'code')})
                    </option>
                  ))}
                </select>
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

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Bulk employee upload</h3>
          </div>
          <p className="muted" style={{ marginBottom: 12 }}>
            Download the Excel template, fill rows, then upload. Default app password is <strong>demo123</strong> if column is blank.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button type="button" className="btn secondary" onClick={downloadBulkTemplate}>
              Download sample Excel
            </button>
          </div>
          <form className="stack" onSubmit={uploadBulk}>
            <label className="field">
              Excel file (.xlsx)
              <input
                required
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
              />
            </label>
            <button className="btn" type="submit" disabled={bulkUploading || !bulkFile}>
              {bulkUploading ? 'Uploading…' : 'Upload & import'}
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
                <th>Division</th>
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
                  <td>{v(e, 'divisionName', 'division_name') || '-'}</td>
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
              <div className="muted">Employee code (locked)</div>
              <div>{v(selected, 'empCode', 'emp_code') || '-'}</div>
            </div>
            <div>
              <div className="muted">Full name (locked)</div>
              <div>{v(selected, 'fullName', 'full_name') || '-'}</div>
            </div>
            <div>
              <div className="muted">App login email</div>
              <div>{v(selected, 'email') || '-'}</div>
            </div>
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

          {isAdmin && editForm ? (
            <form className="stack" onSubmit={saveEmployeeEdit} style={{ marginBottom: 16 }}>
              <div className="panel-title">
                <h3>Edit employee</h3>
              </div>
              <p className="muted">Employee code and full name cannot be changed after creation.</p>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <label className="field">
                  Phone
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </label>
                <label className="field">
                  Designation
                  <select value={editForm.designationId} onChange={(e) => setEditForm({ ...editForm, designationId: e.target.value })}>
                    <option value="">— Select —</option>
                    {designations.map((d) => (
                      <option key={v(d, 'id')} value={v(d, 'id')}>
                        {v(d, 'name')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Employment type
                  <select value={editForm.employmentTypeId} onChange={(e) => setEditForm({ ...editForm, employmentTypeId: e.target.value })}>
                    <option value="">— Select —</option>
                    {employmentTypes.map((d) => (
                      <option key={v(d, 'id')} value={v(d, 'id')}>
                        {v(d, 'name')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Division
                  <select value={editForm.divisionId} onChange={(e) => setEditForm({ ...editForm, divisionId: e.target.value })}>
                    <option value="">— Select —</option>
                    {divisions.map((d) => (
                      <option key={v(d, 'id')} value={v(d, 'id')}>
                        {v(d, 'name')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Department
                  <select value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}>
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
                  <select value={editForm.managerId} onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}>
                    <option value="">— None —</option>
                    {rows.filter((r) => String(v(r, 'id')) !== String(v(selected, 'id'))).map((e) => (
                      <option key={v(e, 'id')} value={v(e, 'id')}>
                        {v(e, 'fullName', 'full_name')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Join date
                  <input type="date" value={editForm.joinDate} onChange={(e) => setEditForm({ ...editForm, joinDate: e.target.value })} />
                </label>
                <label className="field">
                  Status
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="active">active</option>
                    <option value="onboarding">onboarding</option>
                    <option value="exited">exited (soft delete)</option>
                  </select>
                </label>
              </div>
              <button className="btn" type="submit" disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          ) : null}

          {isAdmin ? (
            <form className="stack" onSubmit={resetAppPassword} style={{ marginBottom: 16 }}>
              <div className="panel-title">
                <h3>Reset app password</h3>
              </div>
              <p className="muted">Use if the employee gets &quot;Invalid email or password&quot; on the mobile app.</p>
              <div className="grid" style={{ gridTemplateColumns: '1fr auto', alignItems: 'end' }}>
                <label className="field">
                  New app password
                  <input
                    required
                    type="password"
                    minLength={6}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                  />
                </label>
                <button className="btn" type="submit" disabled={resetting}>
                  {resetting ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>
          ) : null}

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
