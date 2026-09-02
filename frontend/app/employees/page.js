'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import EmployeeMasterForm from '../../components/EmployeeMasterForm';
import { api, apiBlob, apiUpload, getUser, normalizeRole } from '../../lib/auth';
import {
  emptyMasterForm,
  masterFormFromEmployee,
  masterPayloadFromForm,
} from '../../lib/employeeMaster';
import { formatDate, v } from '../../lib/format';

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
  const [masterForm, setMasterForm] = useState(emptyMasterForm());
  const [savingEdit, setSavingEdit] = useState(false);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [createForm, setCreateForm] = useState(emptyMasterForm());
  const [creating, setCreating] = useState(false);
  const [createLoginPopup, setCreateLoginPopup] = useState(null);
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
    setMasterForm(masterFormFromEmployee(e));
    try {
      const full = await api(`/employees/${v(e, 'id')}`);
      setSelected(full);
      setMasterForm(masterFormFromEmployee(full));
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
      const payload = masterPayloadFromForm(createForm, { includePassword: true });
      const res = await api('/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const empId = v(res.employee, 'id');
      const appEmail = String(res.login?.email || createForm.email || '')
        .trim()
        .toLowerCase();
      const appPassword = String(createForm.password || '').trim();
      const employeeName =
        v(res.employee, 'fullName', 'full_name') ||
        createForm.fullName ||
        [createForm.firstName, createForm.lastName].filter(Boolean).join(' ') ||
        'Employee';
      if (createForm.photoFile && empId) {
        const fd = new FormData();
        fd.append('file', createForm.photoFile);
        await apiUpload(`/employees/${empId}/photo`, fd);
      }
      setCreateLoginPopup({
        name: employeeName,
        email: appEmail,
        password: appPassword,
      });
      setMsg(`Employee created: ${employeeName}`);
      if (createForm.photoPreview) {
        try {
          URL.revokeObjectURL(createForm.photoPreview);
        } catch {
          /* ignore */
        }
      }
      setCreateForm(emptyMasterForm());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function saveEmployeeEdit(ev) {
    ev.preventDefault();
    if (!selected) return;
    setError('');
    setMsg('');
    setSavingEdit(true);
    try {
      const payload = masterPayloadFromForm(masterForm);
      const res = await api(`/employees/${v(selected, 'id')}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (masterForm.photoFile) {
        const fd = new FormData();
        fd.append('file', masterForm.photoFile);
        await apiUpload(`/employees/${v(selected, 'id')}/photo`, fd);
      }
      setMsg(res.message || 'Employee updated.');
      const updated = await api(`/employees/${v(selected, 'id')}`);
      setSelected(updated);
      setMasterForm(masterFormFromEmployee(updated));
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

      {createLoginPopup ? (
        <>
          <div
            className="backdrop show"
            onClick={() => setCreateLoginPopup(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-login-title"
            style={{
              position: 'fixed',
              left: '50%',
              top: '12%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              width: 'min(440px, calc(100vw - 32px))',
              background: 'var(--card, #fff)',
              border: '1px solid var(--border, #d7e3ef)',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(2, 11, 31, 0.2)',
              padding: 20,
            }}
          >
            <h3 id="create-login-title" style={{ margin: '0 0 8px' }}>
              Employee created
            </h3>
            <p className="muted" style={{ margin: '0 0 14px' }}>
              {createLoginPopup.name} — app login credentials
            </p>
            <div className="stack" style={{ gap: 10, marginBottom: 14 }}>
              <label className="field">
                App email
                <input readOnly value={createLoginPopup.email} />
              </label>
              <label className="field">
                App password
                <input readOnly value={createLoginPopup.password} />
              </label>
            </div>
            <p style={{ margin: '0 0 16px', lineHeight: 1.45 }}>
              Employee created. Sign in to the mobile app with these credentials.
            </p>
            <button type="button" className="btn block" onClick={() => setCreateLoginPopup(null)}>
              OK
            </button>
          </div>
        </>
      ) : null}

      {isAdmin ? (
        <div className="card emp-master-card" style={{ marginBottom: 14 }}>
          <EmployeeMasterForm
            mode="create"
            form={createForm}
            setForm={setCreateForm}
            departments={departments}
            divisions={divisions}
            designations={designations}
            employmentTypes={employmentTypes}
            managers={rows}
            saving={creating}
            onSubmit={createEmployee}
          />
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
        <div className="card emp-master-card" style={{ marginTop: 14 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>
            <h3>Profile · {v(selected, 'fullName', 'full_name')}</h3>
            <button type="button" className="btn secondary" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>

          {isAdmin ? (
            <EmployeeMasterForm
              mode="edit"
              form={masterForm}
              setForm={setMasterForm}
              departments={departments}
              divisions={divisions}
              designations={designations}
              employmentTypes={employmentTypes}
              managers={rows.filter((r) => String(v(r, 'id')) !== String(v(selected, 'id')))}
              saving={savingEdit}
              onSubmit={saveEmployeeEdit}
              extraFooter={
                <>
                  <div className="emp-master-readonly grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 16 }}>
                    <div>
                      <div className="muted">Passport expiry</div>
                      <div>{formatDate(v(selected, 'passportExpiry', 'passport_expiry'))}</div>
                    </div>
                    <div>
                      <div className="muted">Visa expiry</div>
                      <div>{formatDate(v(selected, 'visaExpiry', 'visa_expiry'))}</div>
                    </div>
                    <div>
                      <div className="muted">App login</div>
                      <div>{v(selected, 'email') || '-'}</div>
                    </div>
                  </div>

                  <form className="stack" onSubmit={resetAppPassword} style={{ marginTop: 16 }}>
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

                  <h4 style={{ marginBottom: 8, marginTop: 8 }}>Employment history</h4>
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
                    <button className="btn secondary" type="submit">
                      Save history
                    </button>
                  </form>
                </>
              }
            />
          ) : (
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
              <div>
                <div className="muted">Employee code</div>
                <div>{v(selected, 'empCode', 'emp_code') || '-'}</div>
              </div>
              <div>
                <div className="muted">Email</div>
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
            </div>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}
