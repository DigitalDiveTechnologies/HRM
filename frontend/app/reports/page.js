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
  const [error, setError] = useState('');

  useEffect(() => {
    api('/reports')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const attrition = data?.attrition || {};

  return (
    <AppShell title="Reports & Analytics" subtitle="Attendance, payroll, headcount, leave, attrition">
      {error ? <div className="error">{error}</div> : null}
      {!data && !error ? <div className="muted">Loading…</div> : null}
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
              <h3>Attrition snapshot</h3>
            </div>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <div className="stat">
                <h3>Active</h3>
                <div className="value">{v(attrition, 'active') ?? 0}</div>
              </div>
              <div className="stat">
                <h3>Onboarding</h3>
                <div className="value">{v(attrition, 'onboarding') ?? 0}</div>
              </div>
              <div className="stat">
                <h3>Exited</h3>
                <div className="value">{v(attrition, 'exited') ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
