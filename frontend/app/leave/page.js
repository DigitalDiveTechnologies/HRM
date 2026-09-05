'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, todayISO, v } from '../../lib/format';
import { UAE_HOLIDAYS_2026 } from '../../lib/holidays';

export default function LeavePage() {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return getUser();
      } catch {}
    }
    return null;
  });
  const role = normalizeRole(user);
  const isEmployee = role === 'employee';
  const canApprove = role === 'admin';

  // Instant local cache hydration (eliminates "0 records" and "No data" flash)
  const [rows, setRows] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_leaves');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((r) => !String(v(r, 'fullName', 'full_name')).toLowerCase().includes('ayan'));
          }
        }
      } catch {}
    }
    return [];
  });

  const [balances, setBalances] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_leave_balances');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((b) => !String(v(b, 'fullName', 'full_name')).toLowerCase().includes('ayan'));
          }
        }
      } catch {}
    }
    return [];
  });

  const [employees, setEmployees] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_employees');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((e) => !String(v(e, 'fullName', 'full_name')).toLowerCase().includes('ayan'));
          }
        }
      } catch {}
    }
    return [];
  });

  const [approvals, setApprovals] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_leave_approvals');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [selectedLeave, setSelectedLeave] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_leaves');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list) && list.length > 0) {
            const cleaned = list.filter((r) => !String(v(r, 'fullName', 'full_name')).toLowerCase().includes('ayan'));
            const pending = cleaned.find((r) => String(v(r, 'status')).toLowerCase() === 'pending');
            return pending || cleaned[0] || null;
          }
        }
      } catch {}
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_leaves');
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch {}
    }
    return true;
  });

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    leaveType: 'Annual',
    startDate: todayISO(),
    endDate: todayISO(),
    days: 1,
    reason: '',
  });

  useEffect(() => {
    const u = getUser();
    if (u) setUser(u);
  }, []);

  const load = useCallback(async () => {
    try {
      // Concurrently fetch with resilient fallback
      const [leaveRes, balRes, empsRes, apprRes] = await Promise.allSettled([
        api('/leave'),
        api('/leave/balances'),
        api('/employees'),
        api('/approvals'),
      ]);

      const list = leaveRes.status === 'fulfilled' && Array.isArray(leaveRes.value) ? leaveRes.value : [];
      const bal = balRes.status === 'fulfilled' && Array.isArray(balRes.value) ? balRes.value : [];
      const emps = empsRes.status === 'fulfilled' && Array.isArray(empsRes.value) ? empsRes.value : [];
      const appr = apprRes.status === 'fulfilled' && Array.isArray(apprRes.value) ? apprRes.value : [];

      if (list.length > 0) {
        setRows(list);
        try {
          localStorage.setItem('gocs_cached_leaves', JSON.stringify(list));
        } catch {}

        setSelectedLeave((prev) => {
          if (prev) {
            const fresh = list.find((r) => String(v(r, 'id')) === String(v(prev, 'id')));
            if (fresh) return fresh;
          }
          const pending = list.find((r) => String(v(r, 'status')).toLowerCase() === 'pending');
          return pending || list[0] || null;
        });
      }

      if (bal.length > 0) {
        setBalances(bal);
        try {
          localStorage.setItem('gocs_cached_leave_balances', JSON.stringify(bal));
        } catch {}
      }

      if (emps.length > 0) {
        setEmployees(emps);
        try {
          localStorage.setItem('gocs_cached_employees', JSON.stringify(emps));
        } catch {}
      }

      if (appr.length > 0) {
        setApprovals(appr);
        try {
          localStorage.setItem('gocs_cached_leave_approvals', JSON.stringify(appr));
        } catch {}
      }

      const currentUser = getUser();
      if (normalizeRole(currentUser) === 'employee' && currentUser?.employeeId) {
        setForm((f) => ({ ...f, employeeId: String(currentUser.employeeId) }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setMsg('');
    setError('');
    setSubmitting(true);
    try {
      await api('/leave', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(form.employeeId),
          leaveType: form.leaveType,
          startDate: form.startDate,
          endDate: form.endDate,
          days: Number(form.days),
          reason: form.reason,
        }),
      });
      setMsg('Leave request submitted.');
      setForm((f) => ({ ...f, reason: '' }));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(leaveId, status) {
    setMsg('');
    setError('');
    try {
      // Direct update on leave request (which syncs approvals table too)
      await api(`/leave/${leaveId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(status === 'approved' ? 'Leave request approved successfully.' : 'Leave request rejected.');
      load();
    } catch (e) {
      try {
        const leaveIdNum = Number(leaveId);
        const pendingAppr = approvals.find(
          (a) =>
            String(v(a, 'requestType', 'request_type')).toLowerCase() === 'leave' &&
            Number(v(a, 'referenceId', 'reference_id')) === leaveIdNum &&
            String(v(a, 'status')).toLowerCase() === 'pending',
        );
        if (pendingAppr) {
          await api(`/approvals/${v(pendingAppr, 'id')}`, { method: 'PATCH', body: JSON.stringify({ status }) });
          setMsg(status === 'approved' ? 'Leave approved successfully.' : 'Leave rejected.');
          load();
          return;
        }
      } catch {
        // Fallback silently
      }
      setError(e.message);
    }
  }

  function workflowLabel(row) {
    const stage = v(row, 'workflowStage', 'workflow_stage');
    if (stage === 'pending_manager') return 'Pending manager';
    if (stage === 'pending_hr') return 'Pending HR';
    return v(row, 'status');
  }

  function canHrAct(row) {
    const stage = v(row, 'workflowStage', 'workflow_stage');
    return String(v(row, 'status')).toLowerCase() === 'pending' && stage === 'pending_hr';
  }

  // Compute stats
  const totalLeavesCount = rows.length;
  const totalDays = rows.reduce((sum, r) => sum + (Number(v(r, 'days')) || 0), 0);
  const annualCount = rows.filter((r) => String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'annual').length;
  const sickCount = rows.filter((r) => String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'sick').length;
  const maternityCount = rows.filter((r) => String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'maternity').length;
  const unpaidCount = rows.filter((r) => String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'unpaid').length;

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const filteredLeaves = useMemo(() => {
    return rows.filter((r) => {
      const t = String(v(r, 'leaveType', 'leave_type') || '').toLowerCase();
      const s = String(v(r, 'status') || '').toLowerCase();
      const name = String(v(r, 'fullName', 'full_name') || '').toLowerCase();
      const code = String(v(r, 'empCode', 'emp_code') || '').toLowerCase();
      const q = searchFilter.toLowerCase();

      const matchType = !typeFilter || t === typeFilter.toLowerCase();
      const matchStatus = !statusFilter || s === statusFilter.toLowerCase();
      const matchSearch = !q || name.includes(q) || code.includes(q);
      return matchType && matchStatus && matchSearch;
    });
  }, [rows, typeFilter, statusFilter, searchFilter]);

  // Selected leave detailed data
  const leaveEmp = useMemo(() => {
    if (!selectedLeave) return null;
    const empId = v(selectedLeave, 'employeeId', 'employee_id');
    return employees.find((e) => String(v(e, 'id')) === String(empId)) || null;
  }, [selectedLeave, employees]);

  const leaveApprovals = useMemo(() => {
    if (!selectedLeave) return [];
    const refId = Number(v(selectedLeave, 'id'));
    return approvals.filter(
      (a) =>
        String(v(a, 'requestType', 'request_type')).toLowerCase() === 'leave' &&
        Number(v(a, 'referenceId', 'reference_id')) === refId,
    );
  }, [selectedLeave, approvals]);

  // Compute 3 Workflow Steps matching Client Screenshot
  const workflowSteps = useMemo(() => {
    if (!selectedLeave) return [];

    const overallStatus = String(v(selectedLeave, 'status') || 'pending').toLowerCase();
    const l1 = leaveApprovals.find((a) => Number(v(a, 'levelNo', 'level_no')) === 1);
    const l2 = leaveApprovals.find((a) => Number(v(a, 'levelNo', 'level_no')) === 2);

    const managerName = v(leaveEmp, 'managerName', 'manager_name') || 'Direct Manager';

    // Step 1: Reporting Manager
    let step1Status = 'pending';
    if (l1) {
      step1Status = String(v(l1, 'status')).toLowerCase();
    } else if (overallStatus === 'approved') {
      step1Status = 'approved';
    } else if (overallStatus === 'rejected') {
      step1Status = 'rejected';
    }

    // Step 2: General Manager / Operations
    let step2Status = 'waiting';
    if (step1Status === 'approved') {
      if (overallStatus === 'approved') {
        step2Status = 'approved';
      } else if (overallStatus === 'rejected' && l2 && String(v(l2, 'status')).toLowerCase() === 'rejected') {
        step2Status = 'rejected';
      } else {
        step2Status = 'pending';
      }
    } else if (step1Status === 'rejected') {
      step2Status = 'waiting';
    }

    // Step 3: HR Final Approval
    let step3Status = 'waiting';
    if (step2Status === 'approved' || (step1Status === 'approved' && l2 && String(v(l2, 'status')).toLowerCase() === 'approved')) {
      step3Status = overallStatus === 'approved' ? 'approved' : 'pending';
    } else if (overallStatus === 'approved') {
      step3Status = 'approved';
    }

    return [
      {
        num: 1,
        title: '1. Reporting Manager',
        name: managerName,
        status: step1Status,
      },
      {
        num: 2,
        title: '2. General Manager',
        name: 'Operations General Manager',
        status: step2Status,
      },
      {
        num: 3,
        title: '3. HR',
        name: 'Sara (HR Administration)',
        status: step3Status,
      },
    ];
  }, [selectedLeave, leaveEmp, leaveApprovals]);

  return (
    <AppShell title="Leave Request Details" subtitle="Employee leave requests, multi-level approval pipeline & balances">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="muted" style={{ marginBottom: 14, color: 'var(--ok, #10b981)', fontWeight: 600 }}>{msg}</div> : null}

      <div className="stack" style={{ gap: 24 }}>
        {/* =========================================================================
            1. LEAVE REQUEST DETAILS (Exact Dual-Card Design matching Client Screenshot)
           ========================================================================= */}
        <div id="leave-request-details-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <p className="muted" style={{ fontSize: '13px', margin: 0, fontWeight: 500 }}>
                {selectedLeave
                  ? `Showing leave summary & live multi-level approval pipeline for ${v(selectedLeave, 'fullName', 'full_name')}`
                  : 'Select any employee leave request from the table below to inspect details'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {canApprove ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowApplyForm((prev) => !prev)}
                  style={{
                    background: showApplyForm ? 'var(--surface-alt, #f1f5f9)' : '#00b8db',
                    color: showApplyForm ? 'var(--ink)' : '#ffffff',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    borderRadius: 8,
                    padding: '8px 14px',
                  }}
                >
                  {showApplyForm ? '✕ Close Form' : '+ New Leave Request'}
                </button>
              ) : null}
            </div>
          </div>

          {selectedLeave ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 20,
              }}
            >
              {/* ==========================================
                  CARD 1: LEAVE SUMMARY (Exact Screenshot)
                 ========================================== */}
              <div
                className="card"
                style={{
                  padding: '24px',
                  borderRadius: 14,
                  border: '1px solid var(--line, #e2e8f0)',
                  background: 'var(--surface, #ffffff)',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                }}
              >
                {/* Header with Calendar Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: 'rgba(0, 184, 219, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#008fa8',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: 0 }}>
                    Leave Summary
                  </h3>
                </div>

                {/* Summary Rows List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Employee */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                    <span className="muted" style={{ fontSize: '13px', fontWeight: 500 }}>Employee</span>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                      {v(selectedLeave, 'fullName', 'full_name') || 'Employee'}
                    </span>
                  </div>

                  {/* Department */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                    <span className="muted" style={{ fontSize: '13px', fontWeight: 500 }}>Department</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink, #0f172a)' }}>
                      {v(leaveEmp, 'departmentName', 'department_name') || v(selectedLeave, 'departmentName') || 'General Operations'}
                    </span>
                  </div>

                  {/* Leave Type */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                    <span className="muted" style={{ fontSize: '13px', fontWeight: 500 }}>Leave Type</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#008fa8' }}>
                      {v(selectedLeave, 'leaveType', 'leave_type')} Leave
                    </span>
                  </div>

                  {/* From - To */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                    <span className="muted" style={{ fontSize: '13px', fontWeight: 500 }}>From - To</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink, #0f172a)' }}>
                      {formatDate(v(selectedLeave, 'startDate', 'start_date'))} - {formatDate(v(selectedLeave, 'endDate', 'end_date'))}
                    </span>
                  </div>

                  {/* Days */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                    <span className="muted" style={{ fontSize: '13px', fontWeight: 500 }}>Days</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                      {v(selectedLeave, 'days')}
                    </span>
                  </div>

                  {/* Reason */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                    <span className="muted" style={{ fontSize: '13px', fontWeight: 500 }}>Reason</span>
                    <span style={{ fontSize: '13px', color: 'var(--muted, #64748b)', maxWidth: 190, textAlign: 'right' }}>
                      {v(selectedLeave, 'reason') || 'Personal request'}
                    </span>
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                    <span className="muted" style={{ fontSize: '13px', fontWeight: 500 }}>Status</span>
                    {String(v(selectedLeave, 'status')).toLowerCase() === 'approved' ? (
                      <span
                        style={{
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          fontWeight: 700,
                          fontSize: '12px',
                          padding: '4px 14px',
                          borderRadius: 9999,
                        }}
                      >
                        Approved
                      </span>
                    ) : String(v(selectedLeave, 'status')).toLowerCase() === 'rejected' ? (
                      <span
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          color: '#ef4444',
                          fontWeight: 700,
                          fontSize: '12px',
                          padding: '4px 14px',
                          borderRadius: 9999,
                        }}
                      >
                        Rejected
                      </span>
                    ) : (
                      <span
                        style={{
                          background: 'rgba(0, 184, 219, 0.14)',
                          color: '#008fa8',
                          fontWeight: 700,
                          fontSize: '12px',
                          padding: '4px 14px',
                          borderRadius: 9999,
                        }}
                      >
                        Pending Approval
                      </span>
                    )}
                  </div>

                  {/* HR Action Buttons if Pending HR */}
                  {canHrAct(selectedLeave) && canApprove ? (
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, paddingTop: 14, borderTop: '1px dashed var(--line, #e2e8f0)' }}>
                      <button
                        type="button"
                        onClick={() => setStatus(v(selectedLeave, 'id'), 'approved')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#10b981',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Approve (HR)
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(v(selectedLeave, 'id'), 'rejected')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#ef4444',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ==============================================
                  CARD 2: APPROVAL WORKFLOW (Exact Screenshot)
                 ============================================== */}
              <div
                className="card"
                style={{
                  padding: '24px',
                  borderRadius: 14,
                  border: '1px solid var(--line, #e2e8f0)',
                  background: 'var(--surface, #ffffff)',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                }}
              >
                {/* Header with Users/Workflow Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: 'rgba(0, 184, 219, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#008fa8',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink, #0f172a)', margin: 0 }}>
                    Approval Workflow
                  </h3>
                </div>

                {/* Stepper Timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {workflowSteps.map((step, idx) => {
                    const isLast = idx === workflowSteps.length - 1;
                    const isApproved = step.status === 'approved';
                    const isPending = step.status === 'pending';
                    const isWaiting = step.status === 'waiting';
                    const isRejected = step.status === 'rejected';

                    return (
                      <div key={step.num} style={{ display: 'flex', position: 'relative', paddingBottom: isLast ? 0 : 32 }}>
                        {/* Connecting Vertical Line */}
                        {!isLast ? (
                          <div
                            style={{
                              position: 'absolute',
                              top: 32,
                              left: 15,
                              width: 2,
                              height: 'calc(100% - 32px)',
                              background: isApproved ? '#00b8db' : '#e2e8f0',
                              transition: 'background 0.2s ease',
                              zIndex: 1,
                            }}
                          />
                        ) : null}

                        {/* Step Circle Indicator */}
                        <div style={{ marginRight: 16, zIndex: 2, position: 'relative' }}>
                          {isApproved ? (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: '#00b8db',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 2px 6px rgba(0, 184, 219, 0.35)',
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          ) : isPending ? (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: '#00b8db',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '13px',
                                boxShadow: '0 2px 6px rgba(0, 184, 219, 0.35)',
                              }}
                            >
                              {step.num}
                            </div>
                          ) : isRejected ? (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '14px',
                              }}
                            >
                              ✕
                            </div>
                          ) : (
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: 'var(--surface, #ffffff)',
                                border: '1.5px solid #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#94a3b8',
                                fontWeight: 700,
                                fontSize: '13px',
                              }}
                            >
                              {step.num}
                            </div>
                          )}
                        </div>

                        {/* Step Details & Status Badge */}
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            minHeight: 36,
                            borderBottom: !isLast ? '1px solid var(--line, #f1f5f9)' : 'none',
                            paddingBottom: !isLast ? 24 : 0,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                              {step.title}
                            </div>
                            <div className="muted" style={{ fontSize: '13px', marginTop: 3 }}>
                              {step.name}
                            </div>
                          </div>

                          {/* Pill Badge matching Screenshot */}
                          <div>
                            {isApproved ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 12px',
                                  borderRadius: 9999,
                                  background: '#ecfdf5',
                                  color: '#10b981',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Approved</span>
                              </div>
                            ) : isPending ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 12px',
                                  borderRadius: 9999,
                                  background: '#fefce8',
                                  color: '#ca8a04',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  border: '1px solid rgba(202, 138, 4, 0.25)',
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>Pending</span>
                              </div>
                            ) : isRejected ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 12px',
                                  borderRadius: 9999,
                                  background: '#fef2f2',
                                  color: '#ef4444',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                }}
                              >
                                <span>Rejected</span>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 12px',
                                  borderRadius: 9999,
                                  background: '#f8fafc',
                                  color: '#64748b',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  border: '1px solid rgba(148, 163, 184, 0.25)',
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>Waiting</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : loading && rows.length === 0 ? (
            <div className="card" style={{ padding: '44px 20px', textAlign: 'center', borderRadius: 14 }}>
              <div
                style={{
                  display: 'inline-block',
                  width: 28,
                  height: 28,
                  border: '3px solid #00b8db',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  marginBottom: 12,
                }}
              />
              <p className="muted" style={{ margin: 0, fontSize: '13.5px', fontWeight: 600 }}>
                Loading leave requests & live approvals pipeline…
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
              <p className="muted" style={{ margin: 0 }}>No active leave requests found.</p>
            </div>
          )}
        </div>

        {/* =========================================================================
            2. NEW LEAVE REQUEST FORM (Collapsible Card)
           ========================================================================= */}
        {showApplyForm ? (
          <div className="card" style={{ padding: '24px', borderRadius: 14, border: '1px solid #00b8db' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Submit Leave Request</h3>
            <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {canApprove ? (
                <label className="field">
                  <span>Select Employee</span>
                  <select
                    required
                    value={form.employeeId}
                    onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                  >
                    <option value="">Choose Employee…</option>
                    {employees.map((e) => (
                      <option key={v(e, 'id')} value={v(e, 'id')}>
                        {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="field">
                <span>Leave Type</span>
                <select value={form.leaveType} onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))}>
                  <option value="Annual">Annual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Casual">Casual Leave</option>
                  <option value="Maternity">Maternity Leave</option>
                  <option value="Unpaid">Unpaid Leave</option>
                </select>
              </label>

              <label className="field">
                <span>Start Date</span>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>End Date</span>
                <input
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </label>

              <label className="field">
                <span>Total Days</span>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={form.days}
                  onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
                />
              </label>

              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span>Reason / Notes</span>
                <input
                  type="text"
                  placeholder="e.g. Family function, medical visit…"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </label>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn" onClick={() => setShowApplyForm(false)} style={{ background: 'var(--surface-alt)' }}>
                  Cancel
                </button>
                <button type="submit" className="btn" disabled={submitting} style={{ background: '#00b8db', color: '#ffffff', fontWeight: 600 }}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* =========================================================================
            3. ALL LEAVE REQUESTS TABLE (Click row to update Leave Request Details)
           ========================================================================= */}
        <div className="card" style={{ padding: '20px', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                All Leave Requests {rows.length > 0 ? `(${filteredLeaves.length})` : ''}
              </h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                Click any row to inspect its summary & live approval workflow pipeline above
              </p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search employee, reason…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '6px 12px',
                  borderRadius: 6,
                  minWidth: 190,
                  border: '1px solid var(--line-strong, #d0d5dd)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--line-strong, #d0d5dd)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              >
                <option value="">All Leave Types</option>
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="casual">Casual</option>
                <option value="maternity">Maternity</option>
                <option value="unpaid">Unpaid</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--line-strong, #d0d5dd)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Days Taken</th>
                  <th>Date Period</th>
                  <th>Reason / Details</th>
                  <th>Current Stage</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((r) => {
                  const isSelected = selectedLeave && String(v(selectedLeave, 'id')) === String(v(r, 'id'));
                  return (
                    <tr
                      key={v(r, 'id')}
                      onClick={() => {
                        setSelectedLeave(r);
                        const el = document.getElementById('leave-request-details-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(0, 184, 219, 0.08)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{v(r, 'fullName', 'full_name')}</div>
                        <div className="muted" style={{ fontSize: '11px' }}>{v(r, 'empCode', 'emp_code')}</div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background:
                              String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'annual'
                                ? 'rgba(0, 184, 219, 0.12)'
                                : String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'sick'
                                ? 'rgba(234, 179, 8, 0.15)'
                                : String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'maternity'
                                ? 'rgba(236, 72, 153, 0.15)'
                                : 'var(--surface-alt)',
                            color:
                              String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'annual'
                                ? '#008fa8'
                                : String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'sick'
                                ? '#b45309'
                                : String(v(r, 'leaveType', 'leave_type')).toLowerCase() === 'maternity'
                                ? '#be185d'
                                : 'var(--muted)',
                          }}
                        >
                          {v(r, 'leaveType', 'leave_type')}
                        </span>
                      </td>
                      <td>
                        <strong>{v(r, 'days')}</strong> <span className="muted" style={{ fontSize: '11px' }}>days</span>
                      </td>
                      <td>
                        {formatDate(v(r, 'startDate', 'start_date'))} → {formatDate(v(r, 'endDate', 'end_date'))}
                      </td>
                      <td style={{ maxWidth: 220, fontSize: '12.5px' }} className="muted">
                        {v(r, 'reason') || '—'}
                      </td>
                      <td>
                        <Badge status={workflowLabel(r)} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {canHrAct(r) && canApprove ? (
                          <div className="row-actions" style={{ justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn ok"
                              onClick={() => setStatus(v(r, 'id'), 'approved')}
                              style={{ padding: '3px 8px', fontSize: '11.5px' }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn danger"
                              onClick={() => setStatus(v(r, 'id'), 'rejected')}
                              style={{ padding: '3px 8px', fontSize: '11.5px' }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#008fa8' }}>
                            {isSelected ? '● Viewing' : 'View Details →'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                      <div style={{ display: 'inline-block', width: 18, height: 18, border: '2.5px solid #00b8db', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle', marginRight: 8 }} />
                      Loading leave records…
                    </td>
                  </tr>
                ) : !filteredLeaves.length ? (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
                      No leave records matching current filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            4. LEAVE BALANCES TABLE
           ========================================================================= */}
        <div className="card" style={{ padding: '20px', borderRadius: 14 }}>
          <div className="panel-title" style={{ marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Leave Balances</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                Annual entitlement, consumed days, and remaining quotas per employee
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Entitlement</th>
                  <th>Used</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b, i) => (
                  <tr key={`${v(b, 'employeeId', 'employee_id')}-${v(b, 'leaveType', 'leave_type')}-${i}`}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{v(b, 'fullName', 'full_name')}</div>
                      <div className="muted" style={{ fontSize: '11px' }}>{v(b, 'empCode', 'emp_code')}</div>
                    </td>
                    <td>{v(b, 'leaveType', 'leave_type')}</td>
                    <td>{v(b, 'entitlementDays', 'entitlement_days')}</td>
                    <td>{v(b, 'usedDays', 'used_days')}</td>
                    <td>
                      <strong style={{ color: '#008fa8' }}>{v(b, 'remainingDays', 'remaining_days')}</strong>
                    </td>
                  </tr>
                ))}
                {loading && balances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                      <div style={{ display: 'inline-block', width: 18, height: 18, border: '2.5px solid #00b8db', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', verticalAlign: 'middle', marginRight: 8 }} />
                      Loading leave balances…
                    </td>
                  </tr>
                ) : !balances.length ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
                      No balance records found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* =========================================================================
            5. UAE HOLIDAY CALENDAR (2026)
           ========================================================================= */}
        <div className="card" style={{ padding: '20px', borderRadius: 14 }}>
          <div className="panel-title" style={{ marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>UAE Holiday Calendar (2026)</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                Official United Arab Emirates public and national holidays
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Date</th>
                  <th>Public Holiday</th>
                </tr>
              </thead>
              <tbody>
                {UAE_HOLIDAYS_2026.map((h) => (
                  <tr key={h.date}>
                    <td>
                      <strong style={{ color: 'var(--ink)' }}>{formatDate(h.date)}</strong>
                    </td>
                    <td>{h.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
