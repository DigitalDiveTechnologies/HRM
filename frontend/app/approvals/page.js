'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { v } from '../../lib/format';

export default function ApprovalsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/approvals')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id, status) {
    try {
      await api(`/approvals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title="Approval Workflow" subtitle="Leave, travel, expense and exit approvals">
      {error ? <div className="error">{error}</div> : null}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Employee</th>
                <th>Level</th>
                <th>Approver</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={v(a, 'id')}>
                  <td>{v(a, 'title')}</td>
                  <td>{v(a, 'requestType', 'request_type')}</td>
                  <td>{v(a, 'fullName', 'full_name') || '-'}</td>
                  <td>L{v(a, 'levelNo', 'level_no')}</td>
                  <td>{v(a, 'approverRole', 'approver_role')}</td>
                  <td>
                    <Badge status={v(a, 'status')} />
                  </td>
                  <td>
                    {String(v(a, 'status')).toLowerCase() === 'pending' ? (
                      <div className="row-actions">
                        <button type="button" className="btn ok" onClick={() => setStatus(v(a, 'id'), 'approved')}>
                          Approve
                        </button>
                        <button type="button" className="btn danger" onClick={() => setStatus(v(a, 'id'), 'rejected')}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      '-'
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
