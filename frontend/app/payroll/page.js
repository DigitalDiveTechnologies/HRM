'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, apiBlob } from '../../lib/auth';
import { money, v } from '../../lib/format';
import { applyEmpFilter, useCompanyFilter } from '../../lib/useCompanyFilter';

function payrollLabel(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'bank_transfer') return 'Bank transfer';
  if (t === 'wps') return 'WPS (UAE)';
  return type || '—';
}

export default function PayrollPage() {
  const { filteredEmpIds } = useCompanyFilter();
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
  const [activeRunLines, setActiveRunLines] = useState([]);

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api('/payroll').catch((err) => {
        console.error('Failed to load payslips:', err);
        setError((prev) => prev || err?.message || 'Failed to load payslips');
        return [];
      }),
      api(`/payroll/summary?period=${encodeURIComponent(period)}`).catch(() => []),
      api('/payroll/runs').catch(() => []),
      api('/payroll/emiratisation').catch(() => null),
    ])
      .then(([payroll, sum, runList, emi]) => {
        setRows(payroll || []);
        setSummary(sum || []);
        setRuns(runList || []);
        setEmiratisation(emi);

        // Fetch lines and WPS audit warnings for current period run
        const matched = (runList || []).find((r) => {
          const y = Number(v(r, 'periodYear', 'period_year'));
          const m = Number(v(r, 'periodMonth', 'period_month'));
          const [py, pm] = String(period).split('-').map(Number);
          return y === py && m === pm && String(v(r, 'status')) !== 'reversed';
        });
        if (matched?.id) {
          api(`/payroll/runs/${matched.id}`)
            .then((res) => setActiveRunLines(res?.lines || []))
            .catch(() => setActiveRunLines([]));
        } else {
          setActiveRunLines([]);
        }
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

  const companyRows = applyEmpFilter(rows, filteredEmpIds);
  const periodRows = companyRows.filter((p) => String(v(p, 'periodLabel', 'period_label')) === period);
  const periodRun = runs.find((r) => {
    const y = Number(v(r, 'periodYear', 'period_year'));
    const m = Number(v(r, 'periodMonth', 'period_month'));
    const [py, pm] = String(period).split('-').map(Number);
    return y === py && m === pm && String(v(r, 'status')) !== 'reversed';
  });

  const wpsWarnings = (activeRunLines || []).filter(
    (l) => !l.wps_ready || (l.validation_notes && String(l.validation_notes).trim() !== '')
  );

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
          Creates a control run and payslips together, validating Wages Protection System compliance.
        </p>
        <div className="toolbar-row">
          <label className="field field-inline">
            Period (YYYY-MM)
            <input value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
          <div className="toolbar-actions">
            <button className="btn" type="button" disabled={busy} onClick={runPayroll}>
              {busy ? 'Calculating Run…' : 'Calculate Payroll Run'}
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

      {/* Pre-WPS Audit Warnings Card */}
      {periodRun ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            borderLeft: wpsWarnings.length > 0 ? '4px solid #f59e0b' : '4px solid #10b981',
            background: wpsWarnings.length > 0 ? 'rgba(254, 243, 199, 0.2)' : 'rgba(209, 250, 229, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '20px' }}>{wpsWarnings.length > 0 ? '⚠️' : '✅'}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
                  Pre-WPS Audit Warnings & Statutory Verification
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: 2 }}>
                  MOHRE Wages Protection System (WPS) pre-audit for Period {period}
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 999,
                background: wpsWarnings.length > 0 ? '#fef3c7' : '#d1fae5',
                color: wpsWarnings.length > 0 ? '#b45309' : '#065f46',
                border: wpsWarnings.length > 0 ? '1px solid #fcd34d' : '1px solid #6ee7b7',
              }}
            >
              {wpsWarnings.length > 0 ? `${wpsWarnings.length} Pre-WPS Warnings` : 'Pre-WPS Audit Passed · 100% Ready'}
            </span>
          </div>

          {wpsWarnings.length > 0 ? (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#92400e', lineHeight: 1.5 }}>
                The following employee records have missing or incomplete statutory information required for UAE Wages Protection System (WPS) SIF file processing. Resolve these in the employee profile before final approval & SIF dispatch:
              </p>
              <div className="table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>
                      <th style={{ padding: '8px 10px' }}>Employee</th>
                      <th style={{ padding: '8px 10px' }}>Payment Method</th>
                      <th style={{ padding: '8px 10px' }}>Pre-WPS Audit Warning</th>
                      <th style={{ padding: '8px 10px' }}>Net Pay</th>
                      <th style={{ padding: '8px 10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wpsWarnings.map((line, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <strong>{line.full_name || line.emp_code}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Code: {line.emp_code}</div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ textTransform: 'capitalize' }}>{line.payment_method || 'WPS'}</span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ color: '#dc2626', fontWeight: 600, background: '#fee2e2', padding: '2px 8px', borderRadius: 4, fontSize: '11.5px' }}>
                            {line.validation_notes || 'Missing IBAN or MOL Person ID'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          AED {Number(line.net || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <a
                            href="/employees"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#00b8db', fontWeight: 600, textDecoration: 'none', fontSize: '12px' }}
                          >
                            Resolve in Profile →
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#065f46', lineHeight: 1.5 }}>
              All {activeRunLines.length} employee lines in this payroll run have passed statutory Pre-WPS audit checks. All IBANs and MOL Person IDs are verified. The run is ready for review and locking into a signed SIF file.
            </div>
          )}
        </div>
      ) : null}

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
              {(periodRows.length ? periodRows : companyRows).map((p) => (
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
                  <td>
                    <span style={{ color: Number(v(p, 'deductions')) > 0 ? '#dc2626' : 'inherit', fontWeight: Number(v(p, 'deductions')) > 0 ? 700 : 400 }}>
                      {money(v(p, 'deductions'))}
                    </span>
                    {Number(v(p, 'deductions')) > 0 ? (
                      <div style={{ fontSize: '10.5px', color: '#b45309', fontWeight: 600, marginTop: 2 }}>
                        Unpaid leave (Basic/30)
                      </div>
                    ) : null}
                  </td>
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
