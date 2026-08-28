'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { api, apiBlob } from '../../lib/auth';
import { money, v } from '../../lib/format';

export default function PayrollPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api('/payroll')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runPayroll() {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await api('/payroll/run', {
        method: 'POST',
        body: JSON.stringify({ periodLabel: period, otRatePerHour: 50 }),
      });
      setMsg(`Payroll run complete · ${res.created || 0} new slips · batch ${res.batch || ''}`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadWps() {
    setError('');
    try {
      const blob = await apiBlob(`/payroll/wps?period=${encodeURIComponent(period)}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WPS_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <AppShell title="Payroll Management" subtitle="Salary run, OT, allowances, WPS export">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Run payroll / WPS</h3>
        </div>
        <div className="toolbar-row">
          <label className="field field-inline">
            Period (YYYY-MM)
            <input value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
          <div className="toolbar-actions">
            <button className="btn" type="button" disabled={busy} onClick={runPayroll}>
              {busy ? 'Running…' : 'Generate payslips'}
            </button>
            <button className="btn secondary" type="button" onClick={downloadWps}>
              Download WPS CSV
            </button>
          </div>
        </div>
      </div>

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
