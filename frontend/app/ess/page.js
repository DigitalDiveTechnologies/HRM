'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { downloadDocumentFile, formatDate, money, v } from '../../lib/format';

export default function EssPage() {
  const [user, setUser] = useState(null);
  const role = normalizeRole(user);
  const employeeId = user?.employeeId || user?.employee_id;
  const [data, setData] = useState(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    if (!user) return;
    const eid = user.employeeId || user.employee_id;
    if (!eid) {
      setError('No employee profile linked to this user.');
      return;
    }
    api(`/ess/${eid}`)
      .then((d) => {
        setData(d);
        setPhone(v(d.profile || {}, 'phone') || '');
      })
      .catch((e) => setError(e.message));
  }, [user]);

  async function savePhone(e) {
    e.preventDefault();
    const eid = user?.employeeId || user?.employee_id;
    setMsg('');
    try {
      await api(`/ess/${eid}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ phone }),
      });
      setMsg('Profile updated.');
    } catch (err) {
      setError(err.message);
    }
  }

  const p = data?.profile || {};

  return (
    <AppShell title="Employee Self-Service" subtitle="Leave, payslips, profile, documents, attendance">
      {error ? <div className="error">{error}</div> : null}
      {!data && !error ? <div className="muted">Loading…</div> : null}
      {data ? (
        <div className="stack">
          <div className="grid-2" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
            <div className="card">
              <div className="panel-title">
                <h3>My profile</h3>
              </div>
              <p>
                <strong>{v(p, 'fullName', 'full_name') || '-'}</strong>
                <br />
                <span className="muted">
                  {v(p, 'jobTitle', 'job_title') || ''} · {v(p, 'departmentName', 'department_name') || ''}
                </span>
              </p>
              <p className="muted">{v(p, 'email')}</p>
              {msg ? <div style={{ color: 'var(--ok)', marginBottom: 8 }}>{msg}</div> : null}
              <form className="stack" onSubmit={savePhone}>
                <div className="field">
                  <label>Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <button className="btn" type="submit">
                  Update personal info
                </button>
              </form>
            </div>
            <div className="card">
              <div className="panel-title">
                <h3>Quick actions</h3>
              </div>
              <div className="row-actions">
                <Link className="btn secondary" href="/leave">
                  Apply leave
                </Link>
                <Link className="btn secondary" href="/attendance">
                  Attendance
                </Link>
                <Link className="btn secondary" href="/notifications">
                  Notifications
                </Link>
                {role === 'admin' ? (
                  <Link className="btn secondary" href="/employees">
                    Directory
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="panel-title">
              <h3>My payslips</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Net pay</th>
                    <th>WPS</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.payslips || []).map((x) => (
                    <tr key={v(x, 'id')}>
                      <td>{v(x, 'periodLabel', 'period_label')}</td>
                      <td>{money(v(x, 'netPay', 'net_pay'))}</td>
                      <td>{v(x, 'wpsRef', 'wps_ref') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="panel-title">
              <h3>My leave</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.leave || []).map((x) => (
                    <tr key={v(x, 'id')}>
                      <td>{v(x, 'leaveType', 'leave_type')}</td>
                      <td>
                        {formatDate(v(x, 'startDate', 'start_date'))} → {formatDate(v(x, 'endDate', 'end_date'))}
                      </td>
                      <td>{v(x, 'days')}</td>
                      <td>
                        <Badge status={v(x, 'status')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="panel-title">
              <h3>Attendance history</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.attendance || []).map((x) => (
                    <tr key={v(x, 'id')}>
                      <td>{formatDate(v(x, 'workDate', 'work_date'))}</td>
                      <td>{String(v(x, 'checkIn', 'check_in') || '-').slice(0, 5)}</td>
                      <td>{String(v(x, 'checkOut', 'check_out') || '-').slice(0, 5)}</td>
                      <td>
                        <Badge status={v(x, 'status')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="panel-title">
              <h3>My documents</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Expiry</th>
                    <th>File</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.documents || []).map((d) => (
                    <tr key={v(d, 'id')}>
                      <td>{v(d, 'docType', 'doc_type')}</td>
                      <td>{v(d, 'title')}</td>
                      <td>{formatDate(v(d, 'expiryDate', 'expiry_date'))}</td>
                      <td>
                        <button type="button" className="btn secondary" onClick={() => downloadDocumentFile(d)}>
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
