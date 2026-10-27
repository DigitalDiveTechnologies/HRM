'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { formatDate, v } from '../../lib/format';
import { useCompanyFilter, applyEmpFilter } from '../../lib/useCompanyFilter';

/** Admin portal: show employee name instead of employee-facing "Your …". */
function adminNotificationMessage(row) {
  const raw = String(v(row, 'message') || '');
  const name = String(v(row, 'fullName', 'full_name') || '').trim();
  if (!name || !raw) return raw || '-';
  let msg = raw.replace(/^Your\b/i, `${name}'s`);
  msg = msg.replace(/\byour manager\b/gi, 'their manager');
  msg = msg.replace(/\byour HR\b/gi, 'HR');
  return msg;
}

function getRenewalUrgency(dueDate) {
  if (!dueDate) return null;
  const target = new Date(dueDate);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const diffDays = Math.ceil((target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      bg: 'rgba(239, 68, 68, 0.12)',
      color: '#dc2626',
      border: 'rgba(239, 68, 68, 0.3)',
      icon: '⚠️',
    };
  }
  if (diffDays <= 15) {
    return {
      label: `Urgent: ${diffDays}d left`,
      bg: 'rgba(249, 115, 22, 0.12)',
      color: '#ea580c',
      border: 'rgba(249, 115, 22, 0.3)',
      icon: '🔥',
    };
  }
  if (diffDays <= 30) {
    return {
      label: `30-Day Window: ${diffDays}d left`,
      bg: 'rgba(234, 179, 8, 0.12)',
      color: '#ca8a04',
      border: 'rgba(234, 179, 8, 0.3)',
      icon: '⏳',
    };
  }
  return {
    label: `${diffDays}d remaining`,
    bg: 'rgba(14, 165, 233, 0.12)',
    color: '#0284c7',
    border: 'rgba(14, 165, 233, 0.3)',
    icon: '🗓️',
  };
}

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const { filteredEmpIds } = useCompanyFilter();
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const load = useCallback(() => {
    api('/notifications')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id) {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH', body: '{}' });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function generate() {
    setMsg('');
    setError('');
    try {
      const res = await api('/notifications/generate', { method: 'POST', body: '{}' });
      setMsg(`Generated ${res.inserted || 0} alert(s) across operations and compliance.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function markAllRead() {
    setMsg('');
    setError('');
    setMarkingAll(true);
    try {
      const res = await api('/notifications/read-all', { method: 'PATCH', body: '{}' });
      setMsg(res.message || `Marked ${res.updated || 0} notification(s) as read.`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setMarkingAll(false);
    }
  }

  async function dispatchRenewalReminders() {
    setMsg('');
    setError('');
    setDispatching(true);
    try {
      const res = await api('/notifications/dispatch-renewal-reminders', { method: 'POST', body: '{}' });
      const count = res.dispatched || 0;
      setMsg(`Dispatched ${count} 30-day renewal notice email(s) to employees and HR admins.`);
      load();
    } catch (e) {
      setError(e.message || 'Failed to dispatch renewal reminders.');
    } finally {
      setDispatching(false);
    }
  }

  const filteredRows = useMemo(() => {
    const list = applyEmpFilter(rows, filteredEmpIds);
    if (activeTab === 'all') return list;
    if (activeTab === 'renewals') {
      return list.filter((r) => {
        const cat = String(v(r, 'category') || '').toLowerCase();
        const title = String(v(r, 'title') || '').toLowerCase();
        return (
          cat === 'passport' ||
          cat === 'visa' ||
          cat === 'emirates_id' ||
          cat === 'document' ||
          title.includes('renewal') ||
          title.includes('expired')
        );
      });
    }
    if (activeTab === 'visapass') {
      return list.filter((r) => {
        const cat = String(v(r, 'category') || '').toLowerCase();
        return cat === 'passport' || cat === 'visa' || cat === 'emirates_id';
      });
    }
    if (activeTab === 'probation') {
      return list.filter((r) => {
        const cat = String(v(r, 'category') || '').toLowerCase();
        return cat === 'probation' || cat === 'contract';
      });
    }
    if (activeTab === 'training') {
      return list.filter((r) => {
        const cat = String(v(r, 'category') || '').toLowerCase();
        return cat === 'training' || cat === 'certification';
      });
    }
    return list;
  }, [rows, filteredEmpIds, activeTab]);

  const renewalCount = useMemo(() => {
    return applyEmpFilter(rows, filteredEmpIds).filter((r) => {
      const cat = String(v(r, 'category') || '').toLowerCase();
      const title = String(v(r, 'title') || '').toLowerCase();
      return (
        cat === 'passport' ||
        cat === 'visa' ||
        cat === 'emirates_id' ||
        cat === 'document' ||
        title.includes('renewal') ||
        title.includes('expired')
      );
    }).length;
  }, [rows, filteredEmpIds]);

  return (
    <AppShell title="Notifications & Alerts" subtitle="30-Day Passport & Visa Renewals, Probation, Contract, Training">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 14, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {/* Compliance banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(0, 184, 219, 0.08) 0%, rgba(14, 165, 233, 0.04) 100%)',
          border: '1px solid rgba(0, 184, 219, 0.25)',
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🛡️</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0f172a' }}>
              Statutory 30-Day Passport & UAE Visa Renewal Tracking Active
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Automatic countdown scans UAE visas, Passports & Emirates IDs across employee records and attachments with automated email triggers.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={dispatchRenewalReminders}
            disabled={dispatching}
            style={{ fontSize: 12.5, background: '#0284c7', borderColor: '#0284c7', color: '#fff' }}
          >
            {dispatching ? 'Dispatching…' : '📧 Send 30-Day Renewal Emails'}
          </button>
        </div>
      </div>

      {/* Tabs and Actions bar */}
      <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'all' ? '' : 'secondary'}`}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setActiveTab('all')}
          >
            All Alerts ({applyEmpFilter(rows, filteredEmpIds).length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'renewals' ? '' : 'secondary'}`}
            style={{
              fontSize: 12,
              padding: '5px 12px',
              border: activeTab === 'renewals' ? '1px solid #ea580c' : undefined,
              color: activeTab === 'renewals' ? '#ea580c' : undefined,
            }}
            onClick={() => setActiveTab('renewals')}
          >
            30-Day Document Renewals ({renewalCount})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'visapass' ? '' : 'secondary'}`}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setActiveTab('visapass')}
          >
            Visa & Passport
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'probation' ? '' : 'secondary'}`}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setActiveTab('probation')}
          >
            Probation & Contract
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'training' ? '' : 'secondary'}`}
            style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => setActiveTab('training')}
          >
            Training & Certs
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={generate}>
            🔄 Scan & Refresh Alerts
          </button>
          <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={markAllRead} disabled={markingAll}>
            {markingAll ? 'Marking…' : '✓ Mark all read'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Category</th>
                <th>Alert Title & Details</th>
                <th>Employee</th>
                <th style={{ width: 140 }}>Due Date & Urgency</th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 120 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--muted)' }}>
                    No alerts found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((n) => {
                  const read = v(n, 'isRead', 'is_read') === true;
                  const cat = String(v(n, 'category') || '').toLowerCase();
                  const dueDate = v(n, 'dueDate', 'due_date');
                  const urgency = getRenewalUrgency(dueDate);
                  const isDocumentAlert =
                    cat === 'passport' ||
                    cat === 'visa' ||
                    cat === 'emirates_id' ||
                    cat === 'document' ||
                    String(v(n, 'title') || '').toLowerCase().includes('renewal');

                  return (
                    <tr key={v(n, 'id')} style={!read && isDocumentAlert ? { background: 'rgba(0, 184, 219, 0.02)' } : undefined}>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            background:
                              cat === 'visa' || cat === 'passport' || cat === 'emirates_id'
                                ? 'rgba(0, 184, 219, 0.12)'
                                : cat === 'probation'
                                ? 'rgba(168, 85, 247, 0.12)'
                                : 'rgba(100, 116, 139, 0.12)',
                            color:
                              cat === 'visa' || cat === 'passport' || cat === 'emirates_id'
                                ? '#008fa8'
                                : cat === 'probation'
                                ? '#9333ea'
                                : '#475569',
                          }}
                        >
                          {v(n, 'category')}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {v(n, 'title')}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                          {adminNotificationMessage(n)}
                        </div>
                      </td>
                      <td>
                        {v(n, 'employeeId', 'employee_id') ? (
                          <Link
                            href={`/employees/${v(n, 'employeeId', 'employee_id')}`}
                            style={{ fontWeight: 500, color: '#008fa8', textDecoration: 'none' }}
                          >
                            {v(n, 'fullName', 'full_name') || `Employee #${v(n, 'employeeId', 'employee_id')}`} &rarr;
                          </Link>
                        ) : (
                          <span>{v(n, 'fullName', 'full_name') || '—'}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{formatDate(dueDate)}</div>
                        {isDocumentAlert && urgency ? (
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: 3,
                              padding: '2px 7px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: urgency.bg,
                              color: urgency.color,
                              border: `1px solid ${urgency.border}`,
                            }}
                          >
                            {urgency.icon} {urgency.label}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <Badge status={read ? 'ok' : 'pending'} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!read ? (
                            <button
                              type="button"
                              className="btn secondary"
                              style={{ fontSize: 11.5, padding: '4px 8px' }}
                              onClick={() => markRead(v(n, 'id'))}
                            >
                              Mark read
                            </button>
                          ) : (
                            <span className="muted" style={{ fontSize: 12 }}>Read</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
