'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { formatDate, v } from '../../lib/format';

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

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
      setMsg(`Generated ${res.inserted || 0} new alerts.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title="Notifications & Alerts" subtitle="Birthday, probation, contract, visa, training">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}
      <div style={{ marginBottom: 12 }}>
        <button type="button" className="btn" onClick={generate}>
          Run alert generator
        </button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Title</th>
                <th>Employee</th>
                <th>Due</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const read = v(n, 'isRead', 'is_read') === true;
                return (
                  <tr key={v(n, 'id')}>
                    <td>{v(n, 'category')}</td>
                    <td>
                      {v(n, 'title')}
                      <div className="muted">{v(n, 'message')}</div>
                    </td>
                    <td>{v(n, 'fullName', 'full_name') || '-'}</td>
                    <td>{formatDate(v(n, 'dueDate', 'due_date'))}</td>
                    <td>
                      <Badge status={read ? 'ok' : 'pending'} />
                    </td>
                    <td>
                      {!read ? (
                        <button type="button" className="btn secondary" onClick={() => markRead(v(n, 'id'))}>
                          Mark read
                        </button>
                      ) : (
                        <span className="muted">Read</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
