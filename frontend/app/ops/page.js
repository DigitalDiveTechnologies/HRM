'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getToken, getApiBase } from '../../lib/auth';
import { formatDate, v } from '../../lib/format';

async function downloadReportCsv(reportKey) {
  const token = getToken();
  const res = await fetch(`${getApiBase()}/api/reports/export/${reportKey}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let msg = `Export failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportKey}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OpsPage() {
  const [ready, setReady] = useState(null);
  const [config, setConfig] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [exports, setExports] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api('/ops/ready', { skipAuth: true }),
      api('/ops/config'),
      api('/ops/jobs'),
      api('/ops/analytics'),
      api('/ops/exports'),
    ])
      .then(([r, c, j, a, e]) => {
        setReady(r);
        setConfig(c || []);
        setJobs(j || []);
        setAnalytics(a || null);
        setExports(e || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveConfig(e) {
    e.preventDefault();
    if (!editKey) return;
    setMsg('');
    setError('');
    try {
      await api(`/ops/config/${encodeURIComponent(editKey)}`, {
        method: 'PUT',
        body: JSON.stringify({ value: editValue }),
      });
      setMsg(`Saved ${editKey}`);
      setEditKey('');
      setEditValue('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function runAlerts() {
    setMsg('');
    setError('');
    try {
      const r = await api('/notifications/generate', { method: 'POST' });
      setMsg(`Alert job #${r.jobId} — inserted ${r.result?.inserted ?? 0}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportCsv(key) {
    setMsg('');
    setError('');
    try {
      await downloadReportCsv(key);
      setMsg(`Downloaded ${key}.csv`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const attr = analytics?.attrition || {};
  const emi = analytics?.emiratisation || {};
  const ops = analytics?.ops || {};

  return (
    <AppShell title="Ops & Scale" subtitle="Health, tenant config, job runs, analytics pack (Phase 5)">
      {error ? <div className="error" style={{ marginBottom: 12 }}>{error}</div> : null}
      {msg ? <div style={{ color: 'var(--ok)', marginBottom: 12 }}>{msg}</div> : null}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="card">
          <div className="panel-title"><h3>Readiness</h3></div>
          <p>
            <Badge status={ready?.ready ? 'active' : 'exited'} />{' '}
            <span className="muted">{ready?.service || '—'} · {ready?.phase || ''}</span>
          </p>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
            {ready?.checks
              ? Object.entries(ready.checks).map(([k, val]) => (
                  <li key={k}>
                    {k}: {val?.ok === false ? `FAIL ${val.error || ''}` : 'ok'}
                  </li>
                ))
              : null}
          </ul>
          <div className="row-actions" style={{ marginTop: 10 }}>
            <button type="button" className="btn secondary" onClick={load}>
              Refresh
            </button>
            <button type="button" className="btn" onClick={runAlerts}>
              Run alert generator
            </button>
          </div>
        </div>

        <div className="card">
          <div className="panel-title"><h3>Ops snapshot</h3></div>
          <div className="toolbar-metrics" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <div className="metric-chip"><span className="chip-label">Active</span><span className="chip-val">{v(attr, 'active') ?? '—'}</span></div>
            <div className="metric-chip"><span className="chip-label">Exited</span><span className="chip-val">{v(attr, 'exited') ?? '—'}</span></div>
            <div className="metric-chip"><span className="chip-label">Emiratisation %</span><span className="chip-val">{emi.percent ?? '—'}*</span></div>
            <div className="metric-chip"><span className="chip-label">Open exits</span><span className="chip-val">{ops.openExits ?? '—'}</span></div>
            <div className="metric-chip"><span className="chip-label">Unread alerts</span><span className="chip-val">{ops.unreadNotifs ?? '—'}</span></div>
            <div className="metric-chip"><span className="chip-label">Pending leave</span><span className="chip-val">{ops.pendingLeave ?? '—'}</span></div>
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>* Emiratisation preview until policy sign-off</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title"><h3>CSV exports</h3></div>
        <div className="row-actions">
          {['headcount', 'compliance', 'wps-gaps', 'audit', 'attrition'].map((k) => (
            <button key={k} type="button" className="btn secondary" onClick={() => exportCsv(k)}>
              {k}.csv
            </button>
          ))}
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Report</th>
                <th>Rows</th>
                <th>By</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {exports.map((x) => (
                <tr key={v(x, 'id')}>
                  <td>{v(x, 'reportKey', 'report_key')}</td>
                  <td>{v(x, 'rowCount', 'row_count')}</td>
                  <td>{v(x, 'actorEmail', 'actor_email') || '—'}</td>
                  <td>{formatDate(v(x, 'createdAt', 'created_at'))}</td>
                </tr>
              ))}
              {!exports.length ? (
                <tr><td colSpan={4} className="muted">No exports yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card">
          <div className="panel-title"><h3>System config</h3></div>
          <form className="stack" onSubmit={saveConfig} style={{ marginBottom: 12 }}>
            <label className="field">
              Key
              <select required value={editKey} onChange={(e) => {
                const k = e.target.value;
                setEditKey(k);
                const row = config.find((c) => v(c, 'key') === k);
                setEditValue(row ? String(v(row, 'value') ?? '') : '');
              }}>
                <option value="">Select…</option>
                {config.map((c) => (
                  <option key={v(c, 'key')} value={v(c, 'key')}>{v(c, 'key')}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Value
              <input value={editValue} onChange={(e) => setEditValue(e.target.value)} />
            </label>
            <button className="btn" type="submit">Save config</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Key</th><th>Value</th><th>Updated</th></tr></thead>
              <tbody>
                {config.map((c) => (
                  <tr key={v(c, 'key')}>
                    <td>{v(c, 'key')}</td>
                    <td>{v(c, 'value')}</td>
                    <td className="muted">{formatDate(v(c, 'updatedAt', 'updated_at'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="panel-title"><h3>Job runs</h3></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Detail</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={v(j, 'id')}>
                    <td>{v(j, 'jobName', 'job_name')}</td>
                    <td><Badge status={v(j, 'status')} /></td>
                    <td className="muted">{v(j, 'detail') || '—'}</td>
                    <td>{formatDate(v(j, 'startedAt', 'started_at'))}</td>
                  </tr>
                ))}
                {!jobs.length ? (
                  <tr><td colSpan={4} className="muted">No jobs yet — run alert generator.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {analytics?.wpsGaps?.length ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="panel-title"><h3>WPS readiness gaps</h3></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Name</th><th>Missing IBAN</th><th>Missing MOL</th></tr>
              </thead>
              <tbody>
                {analytics.wpsGaps.map((g, i) => (
                  <tr key={i}>
                    <td>{v(g, 'empCode', 'emp_code')}</td>
                    <td>{v(g, 'fullName', 'full_name')}</td>
                    <td>{String(v(g, 'missingIban', 'missing_iban'))}</td>
                    <td>{String(v(g, 'missingMol', 'missing_mol'))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
