'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, apiUpload, getUser, normalizeRole } from '../../lib/auth';
import { downloadDocumentFile, formatDate, todayISO, v } from '../../lib/format';

export default function DocumentsPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';

  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    employeeId: '',
    docType: 'passport',
    title: '',
    issueDate: todayISO(),
    expiryDate: '',
  });

  const load = useCallback(() => {
    setError('');
    const role = normalizeRole(getUser());
    const tasks = [api('/documents')];
    if (role === 'admin') tasks.push(api('/employees'));
    Promise.all(tasks)
      .then(([docs, emps]) => {
        setRows(docs || []);
        setEmployees(emps || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('employeeId', String(Number(form.employeeId)));
      fd.append('docType', form.docType);
      fd.append('title', form.title);
      if (form.issueDate) fd.append('issueDate', form.issueDate);
      if (form.expiryDate) fd.append('expiryDate', form.expiryDate);
      fd.append('file', file);

      await apiUpload('/documents/upload', fd);
      setMsg('Document uploaded.');
      setFile(null);
      setForm({
        employeeId: '',
        docType: 'passport',
        title: '',
        issueDate: todayISO(),
        expiryDate: '',
      });
      const input = document.getElementById('doc-file-input');
      if (input) input.value = '';
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Document Management" subtitle="Contracts, passport, Emirates ID, visa, expiry">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Upload document</h3>
          </div>
          <form className="stack" onSubmit={onCreate}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Employee
                <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.map((emp) => (
                    <option key={v(emp, 'id')} value={v(emp, 'id')}>
                      {v(emp, 'fullName', 'full_name')} ({v(emp, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Type
                <select value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })}>
                  <option value="passport">Passport</option>
                  <option value="emirates_id">Emirates ID</option>
                  <option value="visa">Visa</option>
                  <option value="contract">Contract</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                Title
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="field">
                File upload
                <input
                  id="doc-file-input"
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <label className="field">
                Issue date
                <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
              </label>
              <label className="field">
                Expiry date
                <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
              </label>
            </div>
            {file ? <div className="muted">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</div> : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Uploading…' : 'Upload document'}
            </button>
          </form>
        </div>
      ) : null}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Title</th>
                <th>Issue</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={v(d, 'id')}>
                  <td>{v(d, 'fullName', 'full_name')}</td>
                  <td>{v(d, 'docType', 'doc_type')}</td>
                  <td>{v(d, 'title')}</td>
                  <td>{formatDate(v(d, 'issueDate', 'issue_date'))}</td>
                  <td>{formatDate(v(d, 'expiryDate', 'expiry_date'))}</td>
                  <td>
                    <Badge status={v(d, 'status')} />
                  </td>
                  <td>
                    <button type="button" className="btn secondary" onClick={() => downloadDocumentFile(d)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7}>No documents yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
