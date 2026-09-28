'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, formatLate, todayISO, v } from '../../lib/format';
import { applyEmpFilter, useCompanyFilter } from '../../lib/useCompanyFilter';
import { getInstantEmployees, loadEmployeesFast } from '../../lib/employeeCache';
import { fetchAttendanceDirect } from '../../lib/dbDirect';

const PAGE_SIZE = 10;

export default function AttendancePage() {
  const [user, setUser] = useState(null);
  const role = normalizeRole(user);
  const isEmployee = role === 'employee';
  const { filteredEmpIds } = useCompanyFilter();

  const [rows, setRows] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_attendance');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [employees, setEmployees] = useState(() => getInstantEmployees());
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showPunchModal, setShowPunchModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState({
    employeeId: '',
    workDate: todayISO(),
    checkIn: '09:00',
    checkOut: '18:00',
    status: 'present',
    shiftName: 'General',
    overtimeHours: 0,
  });

  useEffect(() => {
    setUser(getUser());
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    loadEmployeesFast(setEmployees);

    // Fast Neon direct fetch (<150ms)
    fetchAttendanceDirect()
      .then((directAtt) => {
        if (Array.isArray(directAtt) && directAtt.length > 0) {
          setRows(directAtt);
          try {
            localStorage.setItem('gocs_cached_attendance', JSON.stringify(directAtt));
          } catch {}
        }
      })
      .catch(() => {});

    try {
      const att = await api('/attendance');
      if (Array.isArray(att) && att.length > 0) {
        setRows(att);
        try {
          localStorage.setItem('gocs_cached_attendance', JSON.stringify(att));
        } catch {}
      }
      if (normalizeRole(user) === 'employee' && user?.employeeId) {
        setForm((f) => ({ ...f, employeeId: String(user.employeeId) }));
      }
    } catch (e) {
      setError(e.message);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh attendance list (portal) — near-instant with alerts.
  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(() => {
      load();
    }, 5_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, load]);

  // Reset pagination when company filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredEmpIds]);

  async function onSave(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await api('/attendance', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(form.employeeId),
          workDate: form.workDate,
          checkIn: form.checkIn || null,
          checkOut: form.checkOut || null,
          status: form.status,
          shiftName: form.shiftName,
          overtimeHours: Number(form.overtimeHours) || 0,
        }),
      });
      setMsg('Attendance punch recorded successfully.');
      setShowPunchModal(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to record attendance.');
    }
  }

  function calcOtHint() {
    // Simple: hours past 9h shift
    const [ih, im] = String(form.checkIn || '09:00').split(':').map(Number);
    const [oh, om] = String(form.checkOut || '18:00').split(':').map(Number);
    const mins = oh * 60 + om - (ih * 60 + im);
    const ot = Math.max(0, mins / 60 - 9);
    setForm((f) => ({ ...f, overtimeHours: Math.round(ot * 100) / 100 }));
  }

  // Filtered rows by selected company
  const filteredRows = useMemo(() => {
    return applyEmpFilter(rows, filteredEmpIds);
  }, [rows, filteredEmpIds]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    return filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  }, [filteredRows, safePage]);

  return (
    <AppShell
      title="Attendance & Time"
      subtitle="Shifts, late tracking, overtime and check-in"
      actions={
        <button
          type="button"
          onClick={() => {
            setError('');
            setMsg('');
            setShowPunchModal(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: '#00b8db',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '13px',
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 184, 219, 0.25)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Quick Punch</span>
        </button>
      }
    >
      {error ? <div className="error" style={{ marginBottom: 14 }}>{error}</div> : null}
      {msg ? <div className="ok-msg" style={{ color: 'var(--ok, #10b981)', marginBottom: 14, fontWeight: 600 }}>{msg}</div> : null}

      {/* =========================================================================
          1. ALL ATTENDANCE LIST (Full-Width Leave Balances Style Card)
         ========================================================================= */}
      <div className="card" style={{ padding: '22px 24px', borderRadius: 14 }}>
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>
              All Attendance Records
            </h3>
            <p className="muted" style={{ margin: '3px 0 0', fontSize: '12px' }}>
              Daily attendance logs, check-in / check-out times, shifts, and overtime tracking
            </p>
          </div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 9999,
              background: 'rgba(0, 184, 219, 0.10)',
              color: '#008fa8',
              border: '1px solid rgba(0, 184, 219, 0.25)',
            }}
          >
            {filteredRows.length} Total Records
          </span>
        </div>

        {/* Table Wrap */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Shift</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>OT</th>
                <th>Late</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((r) => {
                const inTime = v(r, 'checkIn', 'check_in');
                const outTime = v(r, 'checkOut', 'check_out');
                return (
                  <tr key={v(r, 'id')}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {formatDate(v(r, 'workDate', 'work_date'))}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        {v(r, 'fullName', 'full_name') || 'Employee'}
                      </div>
                      {v(r, 'empCode', 'emp_code') ? (
                        <div className="muted" style={{ fontSize: '11px' }}>
                          {v(r, 'empCode', 'emp_code')}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {v(r, 'shiftName', 'shift_name') || 'General'}
                    </td>
                    <td>
                      {inTime ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            letterSpacing: '0.2px',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {String(inTime).slice(0, 5)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {outTime ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: 'rgba(0, 184, 219, 0.15)',
                            color: '#00b8db',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            letterSpacing: '0.2px',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00b8db" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                          {String(outTime).slice(0, 5)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {Number(v(r, 'overtimeHours', 'overtime_hours')) > 0 ? (
                        <span style={{ color: '#f59e0b' }}>+{v(r, 'overtimeHours', 'overtime_hours')}h</span>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td>
                      {formatLate(v(r, 'lateMinutes', 'late_minutes'))}
                    </td>
                    <td>
                      <Badge status={v(r, 'status')} />
                    </td>
                  </tr>
                );
              })}

              {!paginatedRows.length ? (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: '36px 0' }}>
                    No attendance records found for current selection.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* =========================================================================
            Pagination Bar (Aligned Bottom Right Matching Reference Screenshot)
           ========================================================================= */}
        {filteredRows.length > 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              paddingTop: 16,
              marginTop: 14,
              borderTop: '1px solid var(--line, #cbd5e1)',
            }}
          >
            <div className="muted" style={{ fontSize: '12.5px' }}>
              Showing {((safePage - 1) * PAGE_SIZE) + 1} - {Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} attendance records
            </div>

            {/* Pagination Controls on Bottom Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              {/* Previous < Chevron Button */}
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: safePage <= 1 ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                  cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: safePage <= 1 ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                }}
                title="Previous page"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {/* Page Number Buttons */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  const isActive = p === safePage;
                  return (
                    <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {showEllipsis ? (
                        <span className="muted" style={{ padding: '0 4px', fontSize: '12px' }}>…</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 32,
                          height: 32,
                          padding: '0 8px',
                          borderRadius: 8,
                          border: isActive ? '1px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                          background: isActive ? '#00b8db' : 'var(--surface, #ffffff)',
                          color: isActive ? '#ffffff' : 'var(--ink, #0f172a)',
                          fontWeight: isActive ? 700 : 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {p}
                      </button>
                    </span>
                  );
                })}

              {/* Next > Chevron Button */}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--line, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: safePage >= totalPages ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                  cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: safePage >= totalPages ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                }}
                title="Next page"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* =========================================================================
          2. QUICK PUNCH POPUP MODAL (100% Working Form, Responsive & Dark-Mode Safe)
         ========================================================================= */}
      {showPunchModal ? (
        <>
          <div
            className="backdrop show"
            onClick={() => setShowPunchModal(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="punch-modal-title"
            style={{
              position: 'fixed',
              left: '50%',
              top: '8%',
              transform: 'translateX(-50%)',
              zIndex: 60,
              width: 'min(480px, calc(100vw - 32px))',
              maxHeight: 'calc(100vh - 48px)',
              overflowY: 'auto',
              background: 'var(--card, #ffffff)',
              border: '1px solid var(--border, #d7e3ef)',
              borderRadius: 14,
              boxShadow: '0 20px 50px rgba(2, 11, 31, 0.35)',
              padding: '24px 26px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(0, 184, 219, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00b8db' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 id="punch-modal-title" style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: 'var(--ink)' }}>
                  Quick Punch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPunchModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)', padding: '4px 8px' }}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            <p className="muted" style={{ margin: '0 0 16px', fontSize: '12.5px' }}>
              Record daily employee attendance, work hours, shift schedule, and overtime punch.
            </p>

            <form className="stack" onSubmit={onSave} style={{ gap: 13 }}>
              <div className="field">
                <label>Employee</label>
                {isEmployee ? (
                  <input value={user?.fullName || user?.email || ''} disabled />
                ) : (
                  <select
                    required
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  >
                    <option value="">Select Employee…</option>
                    {employees.filter(emp => !filteredEmpIds || filteredEmpIds.has(String(v(emp, 'id')))).map((emp) => (
                      <option key={v(emp, 'id')} value={v(emp, 'id')}>
                        {v(emp, 'fullName', 'full_name')} ({v(emp, 'empCode', 'emp_code')})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  required
                  value={form.workDate}
                  onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Check In</label>
                  <input
                    type="time"
                    value={form.checkIn}
                    onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Check Out</label>
                  <input
                    type="time"
                    value={form.checkOut}
                    onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label>Shift</label>
                <select value={form.shiftName} onChange={(e) => setForm({ ...form, shiftName: e.target.value })}>
                  <option value="General">General (09–18)</option>
                  <option value="Morning">Morning (07–16)</option>
                  <option value="Evening">Evening (12–21)</option>
                  <option value="Night">Night (21–06)</option>
                </select>
              </div>

              <div className="field">
                <label>Overtime Hours</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={form.overtimeHours}
                    onChange={(e) => setForm({ ...form, overtimeHours: e.target.value })}
                  />
                  <button type="button" className="btn secondary" onClick={calcOtHint} style={{ whiteSpace: 'nowrap' }}>
                    Auto OT
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="present">present</option>
                  <option value="late">late</option>
                  <option value="leave">leave</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  className="btn"
                  type="submit"
                  style={{
                    flex: 1,
                    background: '#00b8db',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    borderRadius: 8,
                    padding: '10px 0',
                  }}
                >
                  Save Attendance
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowPunchModal(false)}
                  style={{ padding: '10px 18px', borderRadius: 8, fontSize: '13px' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
