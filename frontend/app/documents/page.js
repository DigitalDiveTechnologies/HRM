'use client';

import { useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { downloadDocumentFile, formatDate, v } from '../../lib/format';

export default function DocumentsPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/documents')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AppShell title="Document Management" subtitle="Contracts, passport, Emirates ID, visa, expiry">
      {error ? <div className="error">{error}</div> : null}
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
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
