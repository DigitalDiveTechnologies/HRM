'use client';

import { useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { formatDate, v } from '../../lib/format';

export default function EmployeesPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/employees')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AppShell title="Employee Information" subtitle="Profiles, org info, ID / passport / visa">
      {error ? <div className="error">{error}</div> : null}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Title</th>
                <th>Passport Exp</th>
                <th>Visa Exp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={v(e, 'id')}>
                  <td>{v(e, 'empCode', 'emp_code')}</td>
                  <td>
                    {v(e, 'fullName', 'full_name')}
                    <div className="muted">{v(e, 'email')}</div>
                  </td>
                  <td>{v(e, 'departmentName', 'department_name') || '-'}</td>
                  <td>{v(e, 'jobTitle', 'job_title') || '-'}</td>
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
    </AppShell>
  );
}
