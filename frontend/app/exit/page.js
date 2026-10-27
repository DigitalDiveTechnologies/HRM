'use client';

import { useCallback, useEffect, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, getPermissions, normalizeRole } from '../../lib/auth';
import { canUsePermission } from '../../lib/nav';
import { useCompanyFilter } from '../../lib/useCompanyFilter';
import { formatDate, todayISO, v } from '../../lib/format';
import { getInstantEmployees, loadEmployeesFast } from '../../lib/employeeCache';
import { fetchExitCasesDirect } from '../../lib/dbDirect';

export default function ExitPage() {
  const role = normalizeRole(getUser());
  const permissions = getPermissions(getUser());
  const canManage = canUsePermission(role, permissions, 'exit.view');

  const [rows, setRows] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_exit_cases');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [employees, setEmployees] = useState(() => getInstantEmployees());
  const { filteredEmpIds } = useCompanyFilter();
  const [checklist, setChecklist] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Settlement & Gratuity (EOSB) States
  const [settlementCase, setSettlementCase] = useState(null);
  const [settlementWorksheet, setSettlementWorksheet] = useState(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementInputs, setSettlementInputs] = useState({
    unusedLeaveDays: 0,
    noticePayDays: 0,
    otherEarnings: 0,
    otherDeductions: 0,
  });

  const [form, setForm] = useState({
    employeeId: '',
    exitType: 'resignation',
    reason: '',
    noticeDate: todayISO(),
    lastWorkingDate: todayISO(),
    settlementNotes: '',
  });

  const load = useCallback(() => {
    setError('');

    // Instant & fast background employee sync
    loadEmployeesFast(setEmployees);

    // Direct DB fetch for exit cases (<150ms)
    fetchExitCasesDirect().then((directExits) => {
      if (Array.isArray(directExits) && directExits.length > 0) {
        setRows(directExits);
        try {
          localStorage.setItem('gocs_cached_exit_cases', JSON.stringify(directExits));
        } catch {}
      }
    }).catch(() => {});

    // Backend endpoint sync
    api('/exit')
      .then((exits) => {
        if (Array.isArray(exits)) {
          setRows(exits);
          try {
            localStorage.setItem('gocs_cached_exit_cases', JSON.stringify(exits));
          } catch {}
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openChecklist(id) {
    setSelectedId(id);
    try {
      const items = await api(`/exit/${id}/checklist`);
      setChecklist(items || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function openSettlement(caseRow) {
    setSettlementCase(caseRow);
    setSettlementLoading(true);
    setError('');
    try {
      const res = await api(`/exit/${caseRow.id}/settlement`, {
        method: 'POST',
        body: JSON.stringify(settlementInputs),
      });
      setSettlementWorksheet(res.worksheet || res.settlement || null);
    } catch (e) {
      setError(e.message || 'Failed to load statutory gratuity calculation.');
    } finally {
      setSettlementLoading(false);
    }
  }

  async function recalculateSettlement() {
    if (!settlementCase) return;
    setSettlementLoading(true);
    setError('');
    try {
      const res = await api(`/exit/${settlementCase.id}/settlement`, {
        method: 'POST',
        body: JSON.stringify({
          unusedLeaveDays: Number(settlementInputs.unusedLeaveDays || 0),
          noticePayDays: Number(settlementInputs.noticePayDays || 0),
          otherEarnings: Number(settlementInputs.otherEarnings || 0),
          otherDeductions: Number(settlementInputs.otherDeductions || 0),
        }),
      });
      setSettlementWorksheet(res.worksheet || res.settlement || null);
      setMsg(`Statutory settlement updated for case #${settlementCase.id}`);
      load();
    } catch (e) {
      setError(e.message || 'Failed to recalculate settlement.');
    } finally {
      setSettlementLoading(false);
    }
  }

  async function createExit(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/exit', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          employeeId: Number(form.employeeId),
        }),
      });
      setMsg('Exit case opened with clearance checklist.');
      setForm({
        employeeId: '',
        exitType: 'resignation',
        reason: '',
        noticeDate: todayISO(),
        lastWorkingDate: todayISO(),
        settlementNotes: '',
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markItem(id, status) {
    try {
      await api(`/exit/checklist/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (selectedId) openChecklist(selectedId);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function setCaseStatus(id, status) {
    try {
      await api(`/exit/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(status === 'completed' ? 'Exit completed — employee marked exited and deactivated.' : `Case marked ${status}.`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const fmt = (num) => `AED ${Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AppShell title="Employee Exit & Gratuity Settlement" subtitle="Resignation, departmental clearance & statutory gratuity (UAE Federal Decree-Law No. 33 of 2021)">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>{msg}</div> : null}

      {canManage ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="panel-title">
            <h3>Open exit case</h3>
          </div>
          <form className="stack" onSubmit={createExit}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                Employee
                <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                  <option value="">Select…</option>
                  {employees.filter(e => !filteredEmpIds || filteredEmpIds.has(String(v(e, 'id')))).map((e) => (
                    <option key={v(e, 'id')} value={v(e, 'id')}>
                      {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Type
                <select value={form.exitType} onChange={(e) => setForm({ ...form, exitType: e.target.value })}>
                  <option value="resignation">Resignation</option>
                  <option value="termination">Termination</option>
                  <option value="end_of_contract">End of contract</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                Notice date
                <input type="date" value={form.noticeDate} onChange={(e) => setForm({ ...form, noticeDate: e.target.value })} />
              </label>
              <label className="field">
                Last working day
                <input type="date" value={form.lastWorkingDate} onChange={(e) => setForm({ ...form, lastWorkingDate: e.target.value })} />
              </label>
            </div>
            <label className="field">
              Reason
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
            <label className="field">
              Settlement notes
              <textarea rows={2} value={form.settlementNotes} onChange={(e) => setForm({ ...form, settlementNotes: e.target.value })} />
            </label>
            <button className="btn" type="submit">
              Start exit process
            </button>
          </form>
        </div>
      ) : null}

      {/* Exit Cases List Table */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="panel-title">
          <h3>Exit cases</h3>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Last day</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={v(r, 'id')}>
                  <td>
                    <strong>{v(r, 'fullName', 'full_name')}</strong>
                    <div className="muted">{v(r, 'empCode', 'emp_code')}</div>
                  </td>
                  <td><span style={{ textTransform: 'capitalize' }}>{v(r, 'exitType', 'exit_type')}</span></td>
                  <td>{formatDate(v(r, 'lastWorkingDate', 'last_working_date'))}</td>
                  <td>
                    <Badge status={v(r, 'status')} />
                  </td>
                  <td>
                    <div className="row-actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                        onClick={() => openChecklist(v(r, 'id'))}
                      >
                        Checklist
                      </button>

                      <button
                        type="button"
                        className="btn secondary"
                        style={{ padding: '5px 10px', fontSize: '12px', borderColor: '#00b8db', color: '#00b8db', fontWeight: 600 }}
                        onClick={() => openSettlement(r)}
                      >
                        Gratuity (EOSB)
                      </button>

                      {canManage && String(v(r, 'status')) !== 'completed' ? (
                        <button
                          type="button"
                          className="btn ok"
                          style={{
                            background: '#10b981',
                            color: '#ffffff',
                            fontWeight: 600,
                            padding: '5px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                          onClick={() => setCaseStatus(v(r, 'id'), 'completed')}
                        >
                          Complete
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>Completed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5}>No exit cases yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statutory Gratuity & Final Settlement (EOSB) Card */}
      {settlementCase ? (
        <div
          className="card"
          style={{
            marginBottom: 14,
            border: '1px solid #00b8db',
            boxShadow: '0 8px 24px -4px rgba(0, 184, 219, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
                  Statutory Gratuity & Final Settlement (EOSB)
                </h3>
                <span
                  style={{
                    background: 'rgba(0, 184, 219, 0.1)',
                    color: '#00b8db',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  UAE Mainland · Decree-Law 33/2021
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: 3 }}>
                Case #{v(settlementCase, 'id')} · {v(settlementCase, 'fullName', 'full_name')} ({v(settlementCase, 'empCode', 'emp_code')})
              </div>
            </div>

            <button
              type="button"
              className="btn secondary"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setSettlementCase(null)}
            >
              ✕ Close Worksheet
            </button>
          </div>

          {settlementLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
              Calculating UAE statutory gratuity formula…
            </div>
          ) : settlementWorksheet ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary Metrics Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  background: 'var(--surface-alt, #f8fafc)',
                  padding: '16px',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                }}
              >
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Service Duration
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>
                    {settlementWorksheet.serviceYears ?? 0} Years
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Monthly Basic Salary
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>
                    {fmt(settlementWorksheet.basicSalary)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Statutory Gratuity (EOSB)
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
                    {fmt(settlementWorksheet.eosbAmount)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Net Final Settlement Payout
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: 2 }}>
                    {fmt(settlementWorksheet.netSettlement)}
                  </div>
                </div>
              </div>

              {/* Interactive Adjustments Form */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                  padding: '16px',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                }}
              >
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Unused Annual Leave (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="emp-input"
                    value={settlementInputs.unusedLeaveDays}
                    onChange={(e) => setSettlementInputs({ ...settlementInputs, unusedLeaveDays: e.target.value })}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    Payout: {fmt(settlementWorksheet.unusedLeaveAmount)}
                  </small>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Notice Period Pay (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="emp-input"
                    value={settlementInputs.noticePayDays}
                    onChange={(e) => setSettlementInputs({ ...settlementInputs, noticePayDays: e.target.value })}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    Payout: {fmt(settlementWorksheet.noticePay)}
                  </small>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Other Earnings / Bonus (AED)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="emp-input"
                    value={settlementInputs.otherEarnings}
                    onChange={(e) => setSettlementInputs({ ...settlementInputs, otherEarnings: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    Company Deductions / Loans (AED)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    className="emp-input"
                    value={settlementInputs.otherDeductions}
                    onChange={(e) => setSettlementInputs({ ...settlementInputs, otherDeductions: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Statutory Rule: <strong>{settlementWorksheet.ruleCode || 'UAE_MAINLAND_2021'}</strong> · 
                  Formula: <strong>21 days/yr (1-5 yrs) + 30 days/yr (&gt;5 yrs)</strong>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={recalculateSettlement}
                  disabled={settlementLoading}
                  style={{ padding: '8px 18px', fontWeight: 700 }}
                >
                  {settlementLoading ? 'Calculating…' : 'Recalculate & Save Settlement →'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              No settlement computed yet for this case.
            </div>
          )}
        </div>
      ) : null}

      {/* Clearance Checklist Card */}
      {selectedId ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="panel-title">
              <h3 style={{ margin: 0 }}>Clearance checklist #{selectedId}</h3>
            </div>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => setSelectedId(null)}
            >
              ✕ Close Checklist
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((c) => (
                  <tr key={v(c, 'id')}>
                    <td>{v(c, 'title')}</td>
                    <td>{v(c, 'category')}</td>
                    <td>
                      <Badge status={v(c, 'status')} />
                    </td>
                    <td>
                      {String(v(c, 'status')) !== 'done' ? (
                        <button type="button" className="btn secondary" onClick={() => markItem(v(c, 'id'), 'done')}>
                          Mark done
                        </button>
                      ) : (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Done</span>
                      )}
                    </td>
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
