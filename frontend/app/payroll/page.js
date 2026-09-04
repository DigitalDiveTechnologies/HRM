'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, apiBlob } from '../../lib/auth';
import { money, v } from '../../lib/format';

function payrollLabel(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'bank_transfer') return 'Bank transfer';
  if (t === 'wps') return 'WPS (UAE)';
  return type || '—';
}

export default function PayrollPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api('/payroll'),
      api(`/payroll/summary?period=${encodeURIComponent(period)}`).catch(() => []),
    ])
      .then(([payroll, sum]) => {
        setRows(payroll);
        setSummary(sum || []);
      })
      .catch((e) => setError(e.message));
  }, [period]);

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
      setMsg(
        `Payroll complete · ${res.created || 0} new slips · `
        + `WPS: ${res.wpsCount ?? 0} · Bank: ${res.bankTransferCount ?? 0}`,
      );
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport(kind) {
    setError('');
    try {
      const path = kind === 'bank' ? '/payroll/bank-transfer' : '/payroll/wps';
      const blob = await apiBlob(`${path}?period=${encodeURIComponent(period)}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = kind === 'bank' ? `BankTransfer_${period}.csv` : `WPS_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  const periodRows = rows.filter((p) => String(v(p, 'periodLabel', 'period_label')) === period);

  return (
    <AppShell title="Payroll Management" subtitle="Company-wise salary run — WPS vs bank transfer">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Run payroll by company</h3>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Each employee&apos;s payment method follows their company setting (Alkidma/Alqat/Royal Oceans → WPS, Overseas → bank transfer).
        </p>
        <div className="toolbar-row">
          <label className="field field-inline">
            Period (YYYY-MM)
            <input value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
          <div className="toolbar-actions">
            <button className="btn" type="button" disabled={busy} onClick={runPayroll}>
              {busy ? 'Running…' : 'Generate payslips'}
            </button>
            <button className="btn secondary" type="button" onClick={() => downloadExport('wps')}>
              Download WPS CSV
            </button>
            <button className="btn secondary" type="button" onClick={() => downloadExport('bank')}>
              Download Bank CSV
            </button>
          </div>
        </div>
      </div>

      {summary.length > 0 ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginTop: 0 }}>Company summary — {period}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Payment</th>
                  <th>Slips</th>
                  <th>Total net</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={v(s, 'divisionId', 'division_id') || v(s, 'divisionCode', 'division_code')}>
                    <td>{v(s, 'divisionName', 'division_name') || 'Unassigned'}</td>
                    <td>
                      <Badge status={v(s, 'payrollType', 'payroll_type')} />
                      {' '}
                      {payrollLabel(v(s, 'payrollType', 'payroll_type'))}
                    </td>
                    <td>{v(s, 'slipCount', 'slip_count')}</td>
                    <td>{money(v(s, 'totalNet', 'total_net'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Payslips {period ? `· ${period}` : ''}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Company</th>
                <th>Method</th>
                <th>Basic</th>
                <th>OT</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              {(periodRows.length ? periodRows : rows).map((p) => (
                <tr key={v(p, 'id')}>
                  <td>
                    {v(p, 'fullName', 'full_name')}
                    <div className="muted">{v(p, 'empCode', 'emp_code')}</div>
                  </td>
                  <td>{v(p, 'divisionName', 'division_name') || '—'}</td>
                  <td>{payrollLabel(v(p, 'paymentMethod', 'payment_method'))}</td>
                  <td>{money(v(p, 'basicSalary', 'basic_salary'))}</td>
                  <td>{money(v(p, 'overtimePay', 'overtime_pay'))}</td>
                  <td>{money(v(p, 'allowances'))}</td>
                  <td>{money(v(p, 'deductions'))}</td>
                  <td>
                    <strong>{money(v(p, 'netPay', 'net_pay'))}</strong>
                  </td>
                  <td className="muted">{v(p, 'wpsRef', 'wps_ref') || '—'}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9}>No payslips yet — run payroll for this period.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
