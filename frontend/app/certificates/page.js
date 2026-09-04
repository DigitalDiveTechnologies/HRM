'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getApiBase, getToken } from '../../lib/auth';
import { formatDate, v } from '../../lib/format';

const TYPE_LABELS = {
  bank: 'Bank Certificate',
  salary: 'Salary Certificate',
  noc_travel: 'NOC (Travel)',
};

function typeLabel(row) {
  const t = String(v(row, 'certificateType', 'certificate_type') || '').toLowerCase();
  return TYPE_LABELS[t] || t || '—';
}

export default function CertificatesPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [noteById, setNoteById] = useState({});

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api('/certificates');
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id, status) {
    if (busyId) return;
    setMsg('');
    setError('');
    setBusyId(id);
    try {
      await api(`/certificates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, hrNote: noteById[id] || '' }),
      });
      setMsg(status === 'approved' ? 'Request approved.' : 'Request rejected.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function issue(id) {
    if (busyId) return;
    setMsg('');
    setError('');
    setBusyId(id);
    try {
      await api(`/certificates/${id}/issue`, { method: 'POST', body: '{}' });
      setMsg('Certificate generated and issued.');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function download(id) {
    setError('');
    try {
      const token = getToken();
      const res = await fetch(`${getApiBase()}/api/certificates/${id}/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GOCs-Certificate-${id}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  const pending = rows.filter((r) => String(v(r, 'status')).toLowerCase() === 'pending');
  const other = rows.filter((r) => String(v(r, 'status')).toLowerCase() !== 'pending');

  return (
    <AppShell title="Certificates" subtitle="Employee certificate requests — review, approve & generate">
      {error ? <div className="error">{error}</div> : null}
      {msg ? (
        <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>
          {msg}
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Pending queue ({pending.length})</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Review pending employee certificate requests, approve or reject, and generate official employment certificates.
        </p>
        {!pending.length ? (
          <p className="muted">No pending requests.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Salary snapshot</th>
                  <th>Requested</th>
                  <th>HR note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => {
                  const id = v(r, 'id');
                  const status = String(v(r, 'status')).toLowerCase();
                  const certType = String(v(r, 'certificateType', 'certificate_type')).toLowerCase();
                  const details = [
                    v(r, 'purpose') ? `Purpose: ${v(r, 'purpose')}` : null,
                    certType === 'bank' && v(r, 'bankName', 'bank_name')
                      ? `Bank: ${v(r, 'bankName', 'bank_name')}`
                      : null,
                    certType === 'noc_travel' && v(r, 'travelDestination', 'travel_destination')
                      ? `Destination: ${v(r, 'travelDestination', 'travel_destination')}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <tr key={id}>
                      <td>
                        <strong>{v(r, 'fullName', 'full_name') || v(r, 'employeeName', 'employee_name')}</strong>
                        <div className="muted">{v(r, 'empCode', 'emp_code') || v(r, 'employeeCode', 'employee_code')}</div>
                      </td>
                      <td>{typeLabel(r)}</td>
                      <td>{details || '—'}</td>
                      <td>{v(r, 'basicSalary', 'basic_salary') ? `AED ${Number(v(r, 'basicSalary', 'basic_salary')).toLocaleString()}` : '—'}</td>
                      <td>{formatDate(v(r, 'createdAt', 'created_at'))}</td>
                      <td>
                        <input
                          type="text"
                          placeholder="Optional note"
                          value={noteById[id] || ''}
                          onChange={(e) => setNoteById((m) => ({ ...m, [id]: e.target.value }))}
                          style={{ minWidth: 120 }}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn"
                          disabled={busyId === id}
                          onClick={() => issue(id)}
                        >
                          Approve &amp; issue
                        </button>{' '}
                        <button
                          type="button"
                          className="btn secondary"
                          disabled={busyId === id}
                          onClick={() => decide(id, 'rejected')}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>All requests</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Issued</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {other.map((r) => {
                const id = v(r, 'id');
                const status = String(v(r, 'status')).toLowerCase();
                return (
                  <tr key={id}>
                    <td>{v(r, 'fullName', 'full_name') || v(r, 'employeeName', 'employee_name')}</td>
                    <td>{typeLabel(r)}</td>
                    <td>
                      <Badge status={status} />
                    </td>
                    <td>{formatDate(v(r, 'createdAt', 'created_at'))}</td>
                    <td>{formatDate(v(r, 'issuedAt', 'issued_at'))}</td>
                    <td>
                      {status === 'approved' ? (
                        <button type="button" className="btn secondary" disabled={busyId === id} onClick={() => issue(id)}>
                          Generate
                        </button>
                      ) : null}
                      {status === 'issued' ? (
                        <button type="button" className="btn secondary" onClick={() => download(id)}>
                          Download
                        </button>
                      ) : null}
                      {status === 'rejected' && v(r, 'hrNote', 'hr_note') ? (
                        <span className="muted">{v(r, 'hrNote', 'hr_note')}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!other.length ? (
                <tr>
                  <td colSpan={6}>No processed requests yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
