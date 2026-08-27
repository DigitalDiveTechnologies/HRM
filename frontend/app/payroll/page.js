'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { api } from '../../lib/auth';
import { money, v } from '../../lib/format';

export default function PayrollPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/payroll')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AppShell title="Payroll Management" subtitle="Salary, OT, allowances, WPS refs, payslips">
      {error ? <div className="error">{error}</div> : null}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Basic</th>
                <th>OT</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net</th>
                <th>WPS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={v(p, 'id')}>
                  <td>
                    {v(p, 'fullName', 'full_name')}
                    <div className="muted">{v(p, 'empCode', 'emp_code')}</div>
                  </td>
                  <td>{v(p, 'periodLabel', 'period_label')}</td>
                  <td>{money(v(p, 'basicSalary', 'basic_salary'))}</td>
                  <td>{money(v(p, 'overtimePay', 'overtime_pay'))}</td>
                  <td>{money(v(p, 'allowances'))}</td>
                  <td>{money(v(p, 'deductions'))}</td>
                  <td>
                    <strong>{money(v(p, 'netPay', 'net_pay'))}</strong>
                  </td>
                  <td>{v(p, 'wpsRef', 'wps_ref') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
