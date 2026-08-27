'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { formatDate, v } from '../../lib/format';

export default function OnboardingPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/onboarding')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markDone(id) {
    try {
      await api(`/onboarding/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title="Onboarding" subtitle="Checklist, documents, assets, training, signatures">
      {error ? <div className="error">{error}</div> : null}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Task</th>
                <th>Category</th>
                <th>Due</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={v(t, 'id')}>
                  <td>
                    {v(t, 'fullName', 'full_name')}
                    <div className="muted">{v(t, 'empCode', 'emp_code')}</div>
                  </td>
                  <td>{v(t, 'title')}</td>
                  <td>{v(t, 'category') || '-'}</td>
                  <td>{formatDate(v(t, 'dueDate', 'due_date'))}</td>
                  <td>
                    <Badge status={v(t, 'status')} />
                  </td>
                  <td>
                    {String(v(t, 'status')).toLowerCase() !== 'done' ? (
                      <button type="button" className="btn ok" onClick={() => markDone(v(t, 'id'))}>
                        Mark done
                      </button>
                    ) : (
                      <span className="muted">Signed {formatDate(v(t, 'signedAt', 'signed_at'))}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
