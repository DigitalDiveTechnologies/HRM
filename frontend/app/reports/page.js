'use client';

import { useEffect, useState } from 'react';
import AppShell from '../../components/AppShell';
import { api } from '../../lib/auth';
import { money, v } from '../../lib/format';

function Bars({ items, labelKey, valueKey }) {
  const max = Math.max(1, ...items.map((i) => Number(v(i, valueKey) || 0)));
  return (
    <div className="stack">
      {items.map((item, idx) => {
        const val = Number(v(item, valueKey) || 0);
        const pct = Math.round((val / max) * 100);
        return (
          <div key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{v(item, labelKey)}</span>
              <strong>{val}</strong>
            </div>
            <div className="bar-track" style={{ height: 8, borderRadius: 4, background: 'var(--bar-track)' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 4,
                  background: 'var(--brand)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [dash, setDash] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/reports'), api('/reports/dashboard')])
      .then(([r, d]) => {
        setData(r);
        setDash(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  const attrition = data?.attrition || {};
  const widgets = dash?.widgets || {};

  return (
    <AppShell title="Reports & Analytics" subtitle="Attendance, payroll, headcount, leave, attrition + live widgets">
      {error ? <div className="error">{error}</div> : null}
      {!data && !error ? <div className="muted">Loading…</div> : null}

      {dash ? (
        <div className="grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 14 }}>
          {[
            ['Pending approvals', widgets.pendingApprovals],
            ['Open jobs', widgets.openJobs],
            ['Open exits', widgets.openExits],
            ['Visas ≤60d', widgets.expiringVisa],
          ].map(([label, val]) => (
            <div className="card" key={label} style={{ padding: 14 }}>
              <div className="muted">{label}</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{val ?? 0}</div>
            </div>
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="grid-2" style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <div className="panel-title">
              <h3>Attendance report</h3>
            </div>
            <Bars items={data.attendanceByStatus || []} labelKey="status" valueKey="total" />
          </div>
          <div className="card">
            <div className="panel-title">
              <h3>Leave utilization</h3>
            </div>
            <Bars items={data.leaveByType || []} labelKey="leaveType" valueKey="days" />
          </div>
          <div className="card">
            <div className="panel-title">
              <h3>Headcount by department</h3>
            </div>
            <Bars items={data.headcountByDept || []} labelKey="name" valueKey="total" />
          </div>
          <div className="card">
            <div className="panel-title">
              <h3>Payroll summary</h3>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Slips</th>
                    <th>Total net</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.payrollSummary || []).map((p, i) => (
                    <tr key={i}>
                      <td>{v(p, 'periodLabel', 'period_label')}</td>
                      <td>{v(p, 'slips')}</td>
                      <td>{money(v(p, 'totalNet', 'total_net'))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="panel-title">
              <h3>Attrition</h3>
            </div>
            <div className="muted">
              Active {v(attrition, 'active') || 0} · Exited {v(attrition, 'exited') || 0} · Rate{' '}
              {v(attrition, 'ratePct', 'rate_pct') || 0}%
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
