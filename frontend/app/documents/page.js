'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { downloadDocumentFile, formatDate, todayISO, v } from '../../lib/format';

export default function DocumentsPage() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';

  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    docType: 'passport',
    title: '',
    fileRef: '',
    issueDate: todayISO(),
    expiryDate: '',
  });

  const load = useCallback(() => {
    setError('');
    Promise.all([api('/documents'), api('/employees')])
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
    try {
      await api('/documents', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          employeeId: Number(form.employeeId),
          expiryDate: form.expiryDate || null,
          fileRef: form.fileRef || null,
        }),
      });
      setMsg('Document recorded.');
      setForm({
        employeeId: '',
        docType: 'passport',
        title: '',
        fileRef: '',
        issueDate: todayISO(),
        expiryDate: '',
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AppShell title="Document Management" subtitle="Contracts, passport, Emirates ID, visa, expiry">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Add document</h3>
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
                File ref
                <input placeholder="optional path / URL" value={form.fileRef} onChange={(e) => setForm({ ...form, fileRef: e.target.value })} />
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
            <button className="btn" type="submit">
              Save document
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
