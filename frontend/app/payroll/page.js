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
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [busy, setBusy] = useState(false);
  const [emiratisation, setEmiratisation] = useState(null);

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api('/payroll'),
      api(`/payroll/summary?period=${encodeURIComponent(period)}`).catch(() => []),
      api('/payroll/runs').catch(() => []),
      api('/payroll/emiratisation').catch(() => null),
    ])
      .then(([payroll, sum, runList, emi]) => {
        setRows(payroll);
        setSummary(sum || []);
        setRuns(runList || []);
        setEmiratisation(emi);
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
      const runId = v(res?.run, 'id');
      setMsg(
        `Calculated run #${runId || '—'} · ${res.lineCount || res.created || 0} lines · `
        + `WPS: ${res.wpsCount ?? 0} · Bank: ${res.bankTransferCount ?? 0}`,
      );
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function transition(runId, action, forceSelfApprove = false) {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await api(`/payroll/runs/${runId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action, forceSelfApprove }),
      });
      setMsg(`Run #${runId} → ${action}`);
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

  async function downloadSifPreview() {
    setError('');
    try {
      const [y, m] = String(period).split('-').map((x) => parseInt(x, 10));
      const blob = await apiBlob(`/payroll/sif/preview?year=${y}&month=${m}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WPS_SIF_PREVIEW_${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Downloaded SIF preview (TEST/PREVIEW — plug bank map later).');
    } catch (e) {
      setError(e.message);
    }
  }

  async function downloadRunSif(runId) {
    setError('');
    try {
      const blob = await apiBlob(`/payroll/runs/${runId}/sif`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WPS_SIF_run${runId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`SIF from locked run #${runId} (still PREVIEW until bank validates field map).`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function runEosbPreview() {
    setError('');
    setMsg('');
    try {
      const res = await api('/payroll/eosb/preview', {
        method: 'POST',
        body: JSON.stringify({
          basicSalary: 5000,
          serviceYears: 6.5,
          unpaidLeaveDays: 0,
          jurisdictionProfile: 'uae_mainland',
        }),
      });
      setMsg(
        `EOSB preview: AED ${res.eosbAmount} · ${res.formulaVersion || ''} · ${res.previewLabel || 'PREVIEW'}`,
      );
    } catch (e) {
      setError(e.message);
    }
  }

  const periodRows = rows.filter((p) => String(v(p, 'periodLabel', 'period_label')) === period);
  const periodRun = runs.find((r) => {
    const y = Number(v(r, 'periodYear', 'period_year'));
    const m = Number(v(r, 'periodMonth', 'period_month'));
    const [py, pm] = String(period).split('-').map(Number);
    return y === py && m === pm && String(v(r, 'status')) !== 'reversed';
  });

  return (
    <AppShell title="Payroll Management" subtitle="Controlled UAE payroll — calculate → review → approve/lock → pay → SIF">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>1. Calculate payroll</h3>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Feeds: attendance OT (period dates) + approved unpaid leave (overlap days) + GPSSA preview for Emirati/GPSSA staff.
          Creates a control run and payslips together.
        </p>
        <div className="toolbar-row">
          <label className="field field-inline">
            Period (YYYY-MM)
            <input value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
          <div className="toolbar-actions">
            <button className="btn" type="button" disabled={busy} onClick={runPayroll}>
              {busy ? 'Running…' : 'Calculate / generate'}
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

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>2. Control run lifecycle</h3>
        </div>
        {periodRun ? (
          <div style={{ marginBottom: 10 }}>
            <p style={{ marginTop: 0 }}>
              Run <strong>#{v(periodRun, 'id')}</strong>
              {' · '}
              <Badge status={v(periodRun, 'status')} />
              {' · '}
              lines {v(periodRun, 'lineCount', 'line_count') ?? '—'}
              {' · '}
              net {money(v(periodRun, 'totalNet', 'total_net'))}
              {Number(v(periodRun, 'notReadyCount', 'not_ready_count')) > 0 ? (
                <span className="muted"> · {v(periodRun, 'notReadyCount', 'not_ready_count')} WPS issues</span>
              ) : null}
            </p>
            <div className="toolbar-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn secondary" type="button" disabled={busy} onClick={() => transition(v(periodRun, 'id'), 'submit')}>
                Submit review
              </button>
              <button className="btn secondary" type="button" disabled={busy} onClick={() => transition(v(periodRun, 'id'), 'approve', true)}>
                Approve + lock
              </button>
              <button className="btn secondary" type="button" disabled={busy} onClick={() => transition(v(periodRun, 'id'), 'pay')}>
                Mark paid
              </button>
              <button className="btn secondary" type="button" disabled={busy} onClick={() => transition(v(periodRun, 'id'), 'close')}>
                Close
              </button>
              <button className="btn secondary" type="button" disabled={busy} onClick={() => transition(v(periodRun, 'id'), 'reject')}>
                Reject → draft
              </button>
              <button className="btn secondary" type="button" disabled={busy} onClick={() => transition(v(periodRun, 'id'), 'reverse')}>
                Reverse
              </button>
              <button className="btn" type="button" onClick={() => downloadRunSif(v(periodRun, 'id'))}>
                SIF from locked run
              </button>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>
              Approve uses maker-checker (same user blocked unless preview force). SIF export only after approve.
            </p>
          </div>
        ) : (
          <p className="muted">No open control run for {period} — calculate first.</p>
        )}

        {runs.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Lines</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 12).map((r) => (
                  <tr key={v(r, 'id')}>
                    <td>{v(r, 'id')}</td>
                    <td>{v(r, 'periodYear', 'period_year')}-{String(v(r, 'periodMonth', 'period_month')).padStart(2, '0')}</td>
                    <td><Badge status={v(r, 'status')} /></td>
                    <td>{v(r, 'lineCount', 'line_count')}</td>
                    <td>{money(v(r, 'totalNet', 'total_net'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(245, 158, 11, 0.45)' }}>
        <div className="panel-title">
          <h3>Preview tools (sir bank map later)</h3>
        </div>
        <div className="toolbar-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn secondary" type="button" onClick={downloadSifPreview}>
            Download SIF skeleton
          </button>
          <button className="btn secondary" type="button" onClick={runEosbPreview}>
            Run EOSB preview (sample)
          </button>
        </div>
        {emiratisation ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Emiratisation: {emiratisation.emiratiCount}/{emiratisation.activeHeadcount}
            {' '}({emiratisation.emiratisationPct}%) · GPSSA eligible {emiratisation.gpssaEligible}
            {' · '}Nafis {emiratisation.nafisRegistered}
          </p>
        ) : null}
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
                  <td colSpan={9}>No payslips yet — calculate payroll for this period.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
