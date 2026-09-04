'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { api } from '../../lib/auth';
import { money, v } from '../../lib/format';

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Interactive filters for easy understanding
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [hideZeroDepts, setHideZeroDepts] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState('all');

  useEffect(() => {
    api('/reports')
      .then((r) => {
        setData(r || {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Department Calculations
  const rawDepts = data?.headcountByDept || [];
  const totalEmployees = useMemo(() => {
    return rawDepts.reduce((acc, d) => acc + Number(v(d, 'total') || 0), 0);
  }, [rawDepts]);

  const depts = useMemo(() => {
    if (hideZeroDepts) {
      return rawDepts.filter((d) => Number(v(d, 'total') || 0) > 0);
    }
    return rawDepts;
  }, [rawDepts, hideZeroDepts]);

  const maxDeptCount = Math.max(1, ...rawDepts.map((d) => Number(v(d, 'total') || 0)));

  // Attendance Calculations
  const attendanceList = data?.attendanceByStatus || [];
  const totalAttendanceRecords = useMemo(() => {
    return attendanceList.reduce((acc, a) => acc + Number(v(a, 'total') || 0), 0);
  }, [attendanceList]);
  const maxAttendanceCount = Math.max(1, ...attendanceList.map((a) => Number(v(a, 'total') || 0)));

  // Leave Calculations
  const leavesList = data?.leaveByType || [];
  const totalLeaveDays = useMemo(() => {
    return leavesList.reduce((acc, l) => acc + Number(v(l, 'days') || 0), 0);
  }, [leavesList]);
  const maxLeaveDays = Math.max(1, ...leavesList.map((l) => Number(v(l, 'days') || 0)));

  // Payroll Calculations
  const payrollList = data?.payrollSummary || [];
  const totalDisbursed = useMemo(() => {
    return payrollList.reduce((acc, p) => acc + Number(v(p, 'totalNet', 'total_net') || 0), 0);
  }, [payrollList]);
  const totalSlips = useMemo(() => {
    return payrollList.reduce((acc, p) => acc + Number(v(p, 'slips') || 0), 0);
  }, [payrollList]);

  const filteredPayroll = useMemo(() => {
    if (payrollPeriod === 'all') return payrollList;
    return payrollList.filter((p) => String(v(p, 'periodLabel', 'period_label')) === payrollPeriod);
  }, [payrollList, payrollPeriod]);

  // Color helper for attendance statuses
  function getAttendanceColor(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('present')) return '#10b981'; // Green
    if (s.includes('late')) return '#f59e0b'; // Amber
    if (s.includes('leave')) return '#00b8db'; // Cyan / Brand
    return '#64748b';
  }

  return (
    <AppShell
      title="Reports & Analytics"
      subtitle="Workforce distribution, attendance trends, leave utilization and payroll summaries"
    >
      {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {loading ? <div className="muted" style={{ padding: '24px 0' }}>Loading analytical reports…</div> : null}

      {!loading && data ? (
        <div className="reports-container">
          {/* =========================================================================
              TOP CONTROL BAR: Category Filter & Key Metrics Strip
             ========================================================================= */}
          <div className="reports-toolbar card">
            <div className="toolbar-left">
              <label className="filter-label">
                <span>Report View:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="toolbar-select"
                >
                  <option value="all">All Reports (Complete Overview)</option>
                  <option value="departments">Employees by Department</option>
                  <option value="attendance">Attendance Report</option>
                  <option value="leave">Leave Utilization</option>
                  <option value="payroll">Payroll Summary</option>
                </select>
              </label>
            </div>
            <div className="toolbar-metrics">
              <div className="metric-chip">
                <span className="chip-label">Total Employees:</span>
                <span className="chip-val">{totalEmployees}</span>
              </div>
              <div className="metric-chip">
                <span className="chip-label">Attendance Logs:</span>
                <span className="chip-val">{totalAttendanceRecords}</span>
              </div>
              <div className="metric-chip">
                <span className="chip-label">Leaves Taken:</span>
                <span className="chip-val">{totalLeaveDays} days</span>
              </div>
              <div className="metric-chip">
                <span className="chip-label">Payroll Periods:</span>
                <span className="chip-val">{payrollList.length}</span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              REPORTS GRID: 4 Clean & Easy-to-Understand Analytical Cards
             ========================================================================= */}
          <div className="reports-grid">
            {/* -----------------------------------------------------------------------
                REPORT 1: Employees by Department
               ----------------------------------------------------------------------- */}
            {(categoryFilter === 'all' || categoryFilter === 'departments') && (
              <div className="card report-card">
                <div className="report-card-header">
                  <div>
                    <h3 className="report-title">Employees by department</h3>
                    <p className="report-subtitle">Workforce headcount distribution across company departments</p>
                  </div>
                  <div className="header-action">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={hideZeroDepts}
                        onChange={(e) => setHideZeroDepts(e.target.checked)}
                      />
                      <span>Active only</span>
                    </label>
                  </div>
                </div>

                <div className="report-content stack">
                  {depts.map((d, idx) => {
                    const count = Number(v(d, 'total') || 0);
                    const name = v(d, 'name') || 'Unassigned';
                    const pct = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0;
                    const barWidth = Math.round((count / maxDeptCount) * 100);

                    return (
                      <div key={idx} className="data-row">
                        <div className="data-row-top">
                          <span className="data-name">{name}</span>
                          <div className="data-meta">
                            <span className="pct-pill">{pct}%</span>
                            <strong className="data-count">{count} {count === 1 ? 'employee' : 'employees'}</strong>
                          </div>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${barWidth}%`,
                              background: 'linear-gradient(90deg, #00b8db 0%, #0284c7 100%)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {!depts.length ? (
                    <div className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                      No departments found.
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------------
                REPORT 2: Attendance Report
               ----------------------------------------------------------------------- */}
            {(categoryFilter === 'all' || categoryFilter === 'attendance') && (
              <div className="card report-card">
                <div className="report-card-header">
                  <div>
                    <h3 className="report-title">Attendance report</h3>
                    <p className="report-subtitle">Cumulative attendance logs by employee check-in status</p>
                  </div>
                  <div className="header-badge">
                    <span className="total-badge">{totalAttendanceRecords} Total Logs</span>
                  </div>
                </div>

                <div className="report-content stack">
                  {attendanceList.map((item, idx) => {
                    const status = v(item, 'status') || 'Unknown';
                    const count = Number(v(item, 'total') || 0);
                    const pct = totalAttendanceRecords > 0 ? Math.round((count / totalAttendanceRecords) * 100) : 0;
                    const barWidth = Math.round((count / maxAttendanceCount) * 100);
                    const color = getAttendanceColor(status);

                    return (
                      <div key={idx} className="data-row">
                        <div className="data-row-top">
                          <span className="data-name" style={{ textTransform: 'capitalize' }}>
                            <span
                              className="status-dot"
                              style={{ background: color, display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 6 }}
                            />
                            {status}
                          </span>
                          <div className="data-meta">
                            <span className="pct-pill">{pct}%</span>
                            <strong className="data-count">{count} records</strong>
                          </div>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${barWidth}%`,
                              background: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {!attendanceList.length ? (
                    <div className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                      No attendance data recorded yet.
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------------
                REPORT 3: Leave Utilization
               ----------------------------------------------------------------------- */}
            {(categoryFilter === 'all' || categoryFilter === 'leave') && (
              <div className="card report-card">
                <div className="report-card-header">
                  <div>
                    <h3 className="report-title">Leave utilization</h3>
                    <p className="report-subtitle">Breakdown of days consumed across different leave types</p>
                  </div>
                  <div className="header-badge">
                    <span className="total-badge">{totalLeaveDays} Total Days</span>
                  </div>
                </div>

                <div className="report-content stack">
                  {leavesList.map((item, idx) => {
                    const type = v(item, 'leaveType', 'leave_type') || 'Other';
                    const days = Number(v(item, 'days') || 0);
                    const requests = Number(v(item, 'total') || 0);
                    const pct = totalLeaveDays > 0 ? Math.round((days / totalLeaveDays) * 100) : 0;
                    const barWidth = Math.round((days / maxLeaveDays) * 100);

                    return (
                      <div key={idx} className="data-row">
                        <div className="data-row-top">
                          <span className="data-name">
                            {type} Leave
                            {requests > 0 ? <span className="req-count">({requests} {requests === 1 ? 'request' : 'requests'})</span> : null}
                          </span>
                          <div className="data-meta">
                            <span className="pct-pill">{pct}%</span>
                            <strong className="data-count">{days} {days === 1 ? 'day' : 'days'}</strong>
                          </div>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${barWidth}%`,
                              background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {!leavesList.length ? (
                    <div className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                      No leave requests on file.
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* -----------------------------------------------------------------------
                REPORT 4: Payroll Summary
               ----------------------------------------------------------------------- */}
            {(categoryFilter === 'all' || categoryFilter === 'payroll') && (
              <div className="card report-card">
                <div className="report-card-header">
                  <div>
                    <h3 className="report-title">Payroll summary</h3>
                    <p className="report-subtitle">Monthly salary disbursements and processed payslips</p>
                  </div>
                  <div className="header-action">
                    <select
                      value={payrollPeriod}
                      onChange={(e) => setPayrollPeriod(e.target.value)}
                      className="header-select"
                    >
                      <option value="all">All Periods ({payrollList.length})</option>
                      {payrollList.map((p, idx) => {
                        const lbl = v(p, 'periodLabel', 'period_label');
                        return <option key={idx} value={lbl}>{lbl}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div className="table-wrap" style={{ marginTop: 4 }}>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th style={{ textAlign: 'center' }}>Slips</th>
                        <th style={{ textAlign: 'right' }}>Total Net Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayroll.map((p, idx) => {
                        const period = v(p, 'periodLabel', 'period_label');
                        const slips = Number(v(p, 'slips') || 0);
                        const net = Number(v(p, 'totalNet', 'total_net') || 0);

                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{period}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="slips-pill">{slips}</span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>
                              {money(net)}
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredPayroll.length ? (
                        <tr>
                          <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                            No payroll records found.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                    {payrollList.length > 0 && payrollPeriod === 'all' ? (
                      <tfoot>
                        <tr className="tfoot-row">
                          <td style={{ fontWeight: 700 }}>Total All Periods</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{totalSlips}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#00b8db' }}>{money(totalDisbursed)}</td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .reports-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* --- Toolbar --- */
        .reports-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          padding: 14px 18px;
          border-radius: 12px;
          background: var(--surface);
          border: 1px solid var(--line);
        }

        .filter-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: var(--muted);
        }

        .toolbar-select {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--line);
          background: var(--surface-alt);
          color: var(--ink);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .toolbar-metrics {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .metric-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--surface-alt);
          padding: 5px 12px;
          border-radius: 999px;
          border: 1px solid var(--line);
          font-size: 12px;
        }

        .chip-label {
          color: var(--muted);
          font-weight: 500;
        }

        .chip-val {
          color: var(--ink);
          font-weight: 700;
        }

        /* --- Grid --- */
        .reports-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        @media (max-width: 900px) {
          .reports-grid {
            grid-template-columns: 1fr;
          }
        }

        /* --- Card Styles --- */
        .report-card {
          border-radius: 12px;
          border: 1px solid var(--line);
          padding: 20px 22px;
          background: var(--surface);
          display: flex;
          flex-direction: column;
        }

        .report-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--line);
        }

        .report-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 3px 0;
        }

        .report-subtitle {
          font-size: 12px;
          color: var(--muted);
          margin: 0;
        }

        .total-badge {
          background: rgba(0, 184, 219, 0.12);
          color: #008fa8;
          font-size: 11.5px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          cursor: pointer;
        }

        .header-select {
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid var(--line);
          background: var(--surface-alt);
          font-size: 12px;
          font-weight: 600;
          color: var(--ink);
          cursor: pointer;
        }

        /* --- Data Rows & Progress Bars --- */
        .report-content {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .data-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .data-row-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .data-name {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--ink);
        }

        .req-count {
          font-size: 11.5px;
          font-weight: 500;
          color: var(--muted);
          margin-left: 6px;
        }

        .data-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pct-pill {
          font-size: 11px;
          font-weight: 600;
          background: var(--surface-alt);
          border: 1px solid var(--line);
          color: var(--muted);
          padding: 1px 6px;
          border-radius: 4px;
        }

        .data-count {
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
        }

        .bar-track {
          width: 100%;
          height: 8px;
          border-radius: 999px;
          background: var(--surface-alt);
          border: 1px solid var(--line);
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        /* --- Payroll Table --- */
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .report-table th {
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          padding: 8px 10px;
          border-bottom: 1px solid var(--line);
        }

        .report-table td {
          padding: 10px 10px;
          border-bottom: 1px solid var(--line);
        }

        .slips-pill {
          background: var(--surface-alt);
          border: 1px solid var(--line);
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 600;
          color: var(--ink);
        }

        .tfoot-row td {
          border-bottom: none;
          padding-top: 12px;
          background: var(--surface-alt);
        }
      `}</style>
    </AppShell>
  );
}

