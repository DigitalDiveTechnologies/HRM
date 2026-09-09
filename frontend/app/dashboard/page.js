'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api } from '../../lib/auth';
import { formatDate, formatLate, v } from '../../lib/format';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_dashboard');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.dash) return parsed.dash;
        }
      } catch {}
    }
    return null;
  });
  const [employees, setEmployees] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_dashboard');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.employees) && parsed.employees.length) return parsed.employees;
        }
        const empCache = localStorage.getItem('gocs_cached_employees');
        if (empCache) {
          const parsedEmp = JSON.parse(empCache);
          if (Array.isArray(parsedEmp)) return parsedEmp;
        }
      } catch {}
    }
    return [];
  });
  const [activities, setActivities] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_dashboard');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.activities)) return parsed.activities;
        }
      } catch {}
    }
    return [];
  });
  const [companies, setCompanies] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_dashboard');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.companies) && parsed.companies.length) return parsed.companies;
        }
        const divCache = localStorage.getItem('gocs_cached_divisions');
        if (divCache) {
          const parsedDiv = JSON.parse(divCache);
          if (Array.isArray(parsedDiv)) return parsedDiv;
        }
      } catch {}
    }
    return [];
  });
  const [companyPage, setCompanyPage] = useState(1);
  const [leaves, setLeaves] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_dashboard');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.leaves) && parsed.leaves.length) return parsed.leaves;
        }
        const leaveCache = localStorage.getItem('gocs_cached_leaves');
        if (leaveCache) {
          const parsedLeave = JSON.parse(leaveCache);
          if (Array.isArray(parsedLeave)) return parsedLeave;
        }
      } catch {}
    }
    return [];
  });
  const [attendanceList, setAttendanceList] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_dashboard');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.attendanceList)) return parsed.attendanceList;
        }
      } catch {}
    }
    return [];
  });
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  // Restore selected company on mount safely without hydration mismatch
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('gocs_selected_company_id');
      if (saved) {
        setSelectedCompanyId(saved);
      }
    } catch {}
    setIsMounted(true);
  }, []);

  // Persist selected company across page navigation (only after mounted)
  useEffect(() => {
    if (!isMounted) return;
    try {
      if (selectedCompanyId) {
        sessionStorage.setItem('gocs_selected_company_id', String(selectedCompanyId));
      } else {
        sessionStorage.removeItem('gocs_selected_company_id');
      }
    } catch {}
  }, [selectedCompanyId, isMounted]);
  const [newCompany, setNewCompany] = useState({ code: '', name: '', payrollType: 'wps' });
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMsg, setCompanyMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_dashboard');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.dash) return false;
        }
      } catch {}
    }
    return true;
  });

  const loadData = useCallback(() => {
    setError('');
    Promise.all([
      api('/dashboard'),
      api('/employees'),
      api('/notifications').catch(() => []),
      api('/divisions').catch(() => []),
      api('/leave').catch(() => []),
      api('/attendance').catch(() => []),
    ])
      .then(([dash, emps, notifs, divs, leaveRows, attRows]) => {
        const cleanEmps = Array.isArray(emps) ? emps : [];
        const cleanDivs = Array.isArray(divs) ? divs : [];
        const cleanLeaves = Array.isArray(leaveRows) ? leaveRows : [];
        const cleanAtt = Array.isArray(attRows) && attRows.length ? attRows : (dash?.recentAttendance || []);

        setData(dash || {});
        setEmployees(cleanEmps);
        setCompanies(cleanDivs);
        setLeaves(cleanLeaves);
        setAttendanceList(cleanAtt);

        const feed = [];
        if (Array.isArray(notifs) && notifs.length) {
          notifs.forEach((n) => {
            feed.push({
              id: `notif-${v(n, 'id')}`,
              title: v(n, 'title') || 'HR Notification',
              desc: v(n, 'message') || v(n, 'fullName', 'full_name') || '',
              date: v(n, 'createdAt', 'created_at'),
            });
          });
        }

        if (feed.length < 5 && dash?.recentAttendance?.length) {
          dash.recentAttendance.slice(0, 5).forEach((a, idx) => {
            feed.push({
              id: `att-${idx}`,
              title: `${v(a, 'fullName', 'full_name')} marked ${v(a, 'status') || 'attendance'}`,
              desc: v(a, 'lateMinutes', 'late_minutes') > 0 ? `Late by ${v(a, 'lateMinutes', 'late_minutes')} min` : 'On-time check-in',
              date: v(a, 'workDate', 'work_date'),
            });
          });
        }

        const finalFeed = feed.slice(0, 10);
        setActivities(finalFeed);

        try {
          localStorage.setItem(
            'gocs_cached_dashboard',
            JSON.stringify({
              dash: dash || {},
              employees: cleanEmps,
              companies: cleanDivs,
              leaves: cleanLeaves,
              attendanceList: cleanAtt,
              activities: finalFeed,
              savedAt: Date.now(),
            })
          );
        } catch {}
      })
      .catch((e) => {
        setData((prev) => {
          if (!prev) setError(e.message);
          return prev;
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateCompany(e) {
    e.preventDefault();
    if (!newCompany.code.trim() || !newCompany.name.trim()) return;
    setCompanySaving(true);
    setCompanyMsg('');
    setError('');
    try {
      await api('/divisions', {
        method: 'POST',
        body: JSON.stringify({
          code: newCompany.code.trim().toUpperCase(),
          name: newCompany.name.trim(),
          payrollType: newCompany.payrollType,
        }),
      });
      setCompanyMsg('Company created successfully.');
      setNewCompany({ code: '', name: '', payrollType: 'wps' });
      setShowAddCompany(false);
      api('/divisions').then((d) => setCompanies(Array.isArray(d) ? d : []));
    } catch (err) {
      setError(err.message);
    } finally {
      setCompanySaving(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return (companies || []).find((c) => String(v(c, 'id')) === String(selectedCompanyId)) || null;
  }, [companies, selectedCompanyId]);

  const selectedCompanyName = useMemo(() => {
    return selectedCompany ? String(v(selectedCompany, 'name') || '').toLowerCase().trim() : '';
  }, [selectedCompany]);

  const selectedCompanyCode = useMemo(() => {
    return selectedCompany ? String(v(selectedCompany, 'code') || '').toLowerCase().trim() : '';
  }, [selectedCompany]);

  // Filter employees by selected company (strict matching: ID, code, or exact non-empty name)
  const filteredEmployees = useMemo(() => {
    if (!selectedCompanyId) return employees;

    const targetId = String(selectedCompanyId).trim();
    const targetCode = selectedCompanyCode ? selectedCompanyCode.toLowerCase().trim() : '';
    const targetName = selectedCompanyName ? selectedCompanyName.toLowerCase().trim() : '';

    return (employees || []).filter((e) => {
      if (!e) return false;
      let md = {};
      try {
        md = typeof e.masterData === 'string' ? JSON.parse(e.masterData || '{}') : e.masterData || {};
      } catch {
        md = {};
      }

      // 1. Direct ID match (highest priority, strict)
      const empDivId = String(v(e, 'divisionId', 'division_id') || md.divisionId || (md.companyIds && md.companyIds[0]) || '').trim();
      if (empDivId && empDivId === targetId) {
        return true;
      }

      // 2. Exact code match (must be non-empty)
      const empDivCode = String(v(e, 'divisionCode', 'division_code') || md.divisionCode || '').toLowerCase().trim();
      if (empDivCode && targetCode && empDivCode === targetCode) {
        return true;
      }

      // 3. Exact name match (must be non-empty, no loose substring matching)
      const empDivName = String(v(e, 'divisionName', 'division_name') || md.divisionName || '').toLowerCase().trim();
      if (empDivName && targetName && empDivName === targetName) {
        return true;
      }

      return false;
    });
  }, [employees, selectedCompanyId, selectedCompanyName, selectedCompanyCode]);

  const filteredEmpIdSet = useMemo(() => {
    return new Set((filteredEmployees || []).map((e) => String(v(e, 'id'))).filter(Boolean));
  }, [filteredEmployees]);

  const filteredEmpNameSet = useMemo(() => {
    return new Set(
      (filteredEmployees || []).map((e) => String(v(e, 'fullName', 'full_name') || '').toLowerCase().trim()).filter(Boolean)
    );
  }, [filteredEmployees]);

  // Filter leaves by selected company
  const filteredLeaves = useMemo(() => {
    if (!selectedCompanyId) return leaves;
    if (filteredEmployees.length === 0) return [];
    return (leaves || []).filter((l) => {
      const empId = String(v(l, 'employeeId', 'employee_id') || '').trim();
      if (empId && filteredEmpIdSet.has(empId)) return true;
      const empName = String(v(l, 'fullName', 'full_name') || v(l, 'employeeName', 'employee_name') || '').toLowerCase().trim();
      if (empName && filteredEmpNameSet.has(empName)) return true;
      return false;
    });
  }, [leaves, selectedCompanyId, filteredEmployees, filteredEmpIdSet, filteredEmpNameSet]);

  // Filter recent attendance by selected company
  const filteredRecentAttendance = useMemo(() => {
    const base = data?.recentAttendance || [];
    if (!selectedCompanyId) return base;
    if (filteredEmployees.length === 0) return [];
    return base.filter((a) => {
      const empId = String(v(a, 'employeeId', 'employee_id') || '').trim();
      if (empId && filteredEmpIdSet.has(empId)) return true;
      const empName = String(v(a, 'fullName', 'full_name') || '').toLowerCase().trim();
      if (empName && filteredEmpNameSet.has(empName)) return true;
      return false;
    });
  }, [data, selectedCompanyId, filteredEmployees, filteredEmpIdSet, filteredEmpNameSet]);

  // Filter full attendance list by selected company
  const filteredAttendanceList = useMemo(() => {
    if (!selectedCompanyId) return attendanceList;
    if (filteredEmployees.length === 0) return [];
    return (attendanceList || []).filter((a) => {
      const empId = String(v(a, 'employeeId', 'employee_id') || '').trim();
      if (empId && filteredEmpIdSet.has(empId)) return true;
      const empName = String(v(a, 'fullName', 'full_name') || '').toLowerCase().trim();
      if (empName && filteredEmpNameSet.has(empName)) return true;
      return false;
    });
  }, [attendanceList, selectedCompanyId, filteredEmployees, filteredEmpIdSet, filteredEmpNameSet]);

  // Filter activities feed by selected company
  const filteredActivities = useMemo(() => {
    if (!selectedCompanyId) return activities;
    if (filteredEmployees.length === 0) return [];
    return (activities || []).filter((act) => {
      if (!act) return false;
      const title = (act.title || '').toLowerCase();
      const desc = (act.desc || '').toLowerCase();
      for (const name of filteredEmpNameSet) {
        if (name && (title.includes(name) || desc.includes(name))) return true;
      }
      return false;
    });
  }, [activities, selectedCompanyId, filteredEmployees, filteredEmpNameSet]);

  const totalEmployees = selectedCompanyId
    ? filteredEmployees.length
    : (data?.headcount ?? employees.length ?? 0);

  const pendingLeaves = selectedCompanyId
    ? filteredLeaves.filter((l) => String(v(l, 'status') || '').toLowerCase() === 'pending').length
    : (data?.pendingLeave ?? 0);

  // Calculate docs expiring within 90 days for current company view
  const expiringDocs = useMemo(() => {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + 90);
    let count = 0;
    (filteredEmployees || []).forEach((e) => {
      if (!e) return;
      let md = {};
      try {
        md = typeof e.masterData === 'string' ? JSON.parse(e.masterData || '{}') : e.masterData || {};
      } catch {
        md = {};
      }
      const dates = [
        md.passportExpiryDate,
        md.visaExpiryDate,
        md.emiratesIdExpiryDate,
        e.passportExpiryDate,
        e.visaExpiryDate,
      ].filter(Boolean);

      const hasExp = dates.some((d) => {
        const t = new Date(d).getTime();
        return !isNaN(t) && t >= now.getTime() && t <= limit.getTime();
      });
      if (hasExp) count++;
    });
    if (!selectedCompanyId && data?.expiringDocs && data.expiringDocs > 0) {
      return data.expiringDocs;
    }
    return count;
  }, [filteredEmployees, selectedCompanyId, data]);

  const unreadNotifications = data?.unreadNotifications ?? 0;

  // Dynamic on-leave count for current company view
  const todayOnLeave = useMemo(() => {
    // 1. Check attendance records marked with status 'leave'
    const attOnLeave = (filteredRecentAttendance || []).filter(
      (a) => (v(a, 'status') || '').toLowerCase().includes('leave')
    ).length;

    if (attOnLeave > 0) return attOnLeave;

    // 2. Check active approved leave requests covering today
    const todayStr = new Date().toISOString().slice(0, 10);
    const approvedToday = (filteredLeaves || []).filter((l) => {
      const st = String(v(l, 'status') || '').toLowerCase();
      if (st !== 'approved') return false;
      const s = String(v(l, 'startDate', 'start_date') || '').slice(0, 10);
      const e = String(v(l, 'endDate', 'end_date') || '').slice(0, 10);
      return s <= todayStr && e >= todayStr;
    }).length;

    if (approvedToday > 0) return approvedToday;

    return 0;
  }, [filteredRecentAttendance, filteredLeaves]);

  // Dynamic workforce calculations
  const activeEmployees = Math.max(0, totalEmployees - todayOnLeave);
  const activePercent = totalEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0;
  const leavePercent = totalEmployees > 0 ? Math.round((todayOnLeave / totalEmployees) * 100) : 0;
  const expiringPercent = totalEmployees > 0 ? Math.round((expiringDocs / totalEmployees) * 100) : (selectedCompanyId ? 0 : 23);


  // Dynamic 12-month workforce attendance statistics computed from real DB logs & approved leaves
  const monthlyStats = useMemo(() => {
    // Combine all available attendance sources for the selected company
    const allAtt = [...(filteredAttendanceList || [])];
    if (filteredRecentAttendance && Array.isArray(filteredRecentAttendance)) {
      filteredRecentAttendance.forEach((ra) => {
        const id = v(ra, 'id');
        if (!allAtt.some((a) => v(a, 'id') === id)) {
          allAtt.push(ra);
        }
      });
    }

    const currentYear = new Date().getFullYear();

    return MONTH_NAMES.map((monthName, monthIndex) => {
      // Filter attendance records in this month
      const monthAtt = allAtt.filter((a) => {
        const d = v(a, 'workDate', 'work_date');
        if (!d) return false;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return false;
        return dt.getMonth() === monthIndex;
      });

      // Filter approved leaves active in this month
      const monthLeaves = (filteredLeaves || []).filter((l) => {
        const status = String(v(l, 'status') || '').toLowerCase();
        if (status !== 'approved') return false;
        const s = v(l, 'startDate', 'start_date');
        const e = v(l, 'endDate', 'end_date');
        if (!s) return false;
        const startDt = new Date(s);
        const endDt = e ? new Date(e) : startDt;
        if (isNaN(startDt.getTime())) return false;
        const monthStart = new Date(currentYear, monthIndex, 1);
        const monthEnd = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59);
        return startDt <= monthEnd && endDt >= monthStart;
      });

      const presentCount = monthAtt.filter((a) => {
        const st = String(v(a, 'status') || '').toLowerCase();
        const lateMins = Number(v(a, 'lateMinutes', 'late_minutes')) || 0;
        return (st === 'present' || st === 'on-time' || st === 'active') && lateMins === 0;
      }).length;

      const lateCount = monthAtt.filter((a) => {
        const st = String(v(a, 'status') || '').toLowerCase();
        const lateMins = Number(v(a, 'lateMinutes', 'late_minutes')) || 0;
        return st === 'late' || lateMins > 0;
      }).length;

      const attLeaveCount = monthAtt.filter((a) => {
        const st = String(v(a, 'status') || '').toLowerCase();
        return st.includes('leave') || st === 'absent';
      }).length;

      const leaveTotalCount = attLeaveCount + monthLeaves.length;
      const totalEvents = presentCount + lateCount + leaveTotalCount;

      if (totalEvents > 0) {
        // Calculate proportional heights (summing to ~80-100% or scaled accurately)
        const pPct = Math.max(12, Math.round((presentCount / totalEvents) * 65));
        const lPct = Math.max(10, Math.round((lateCount / totalEvents) * 45));
        const lvPct = Math.max(10, Math.round((leaveTotalCount / totalEvents) * 40));
        return {
          month: monthName,
          present: pPct,
          late: lPct,
          leave: lvPct,
          hasData: true,
          total: totalEvents,
          presentCount,
          lateCount,
          leaveCount: leaveTotalCount,
        };
      }

      return {
        month: monthName,
        present: 0,
        late: 0,
        leave: 0,
        hasData: false,
        total: 0,
        presentCount: 0,
        lateCount: 0,
        leaveCount: 0,
      };
    });
  }, [filteredAttendanceList, filteredRecentAttendance, filteredLeaves]);

  return (
    <AppShell
      title="Dashboard"
      subtitle={selectedCompany ? `Workforce overview for ${v(selectedCompany, 'name')}` : "Workforce overview, live statistics and operational metrics"}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="topbar-select"
            style={selectedCompanyId ? { borderColor: '#00b8db', borderWidth: '1.5px' } : undefined}
            title="Filter dashboard by company"
          >
            <option value="">🏢 All Companies ({companies.length})</option>
            {companies.map((c) => (
              <option key={v(c, 'id')} value={String(v(c, 'id'))}>
                {v(c, 'name')} {v(c, 'code') ? `(${v(c, 'code')})` : ''}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {error ? <div className="error" style={{ marginBottom: 14 }}>{error}</div> : null}
      {loading && !data ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '36px 0', color: 'var(--muted, #64748b)' }}>
          <span
            style={{
              width: 16,
              height: 16,
              border: '2px solid #cbd5e1',
              borderTopColor: '#00b8db',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>Loading live dashboard…</span>
        </div>
      ) : null}

      {data ? (
        <div className="dash-container">
          {/* =========================================================================
              ZONE 0: Company Selector / Filter Bar
             ========================================================================= */}
          <div
            className="dash-company-filter-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: '12px',
              padding: '12px 20px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00b8db" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1" />
                </svg>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Company Filter:
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    background: 'var(--surface-alt, #f8fafc)',
                    border: selectedCompanyId ? '2px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                    borderRadius: '8px',
                    padding: '8px 36px 8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--ink, #0f172a)',
                    cursor: 'pointer',
                    minWidth: '240px',
                    outline: 'none',
                  }}
                >
                  <option value="">🏢 All Companies ({companies.length})</option>
                  {companies.map((c) => (
                    <option key={v(c, 'id')} value={String(v(c, 'id'))}>
                      {v(c, 'name')} {v(c, 'code') ? `(${v(c, 'code')})` : ''}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--muted, #64748b)',
                    fontSize: '11px',
                  }}
                >
                  ▼
                </div>
              </div>

              {selectedCompanyId ? (
                <button
                  type="button"
                  onClick={() => setSelectedCompanyId('')}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Clear company filter"
                >
                  ✕ Show All Companies
                </button>
              ) : null}
            </div>

            <div style={{ fontSize: '12.5px', color: 'var(--muted, #64748b)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectedCompany ? (
                <>
                  <span>Viewing company:</span>
                  <span
                    style={{
                      background: 'rgba(0, 184, 219, 0.12)',
                      color: '#0097b2',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                    }}
                  >
                    {v(selectedCompany, 'name')} ({filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'})
                  </span>
                </>
              ) : (
                <span>Showing aggregated metrics across <strong>all {companies.length} companies</strong> ({totalEmployees} total staff)</span>
              )}
            </div>
          </div>

          {/* =========================================================================
              ZONE 1: 4 Vibrant Cards (Row Direction, Proper Height & Generous Padding)
             ========================================================================= */}
          <div className="dash-kpi-grid">
            {/* Card 1: Emerald Teal (Dynamic Active Rate) */}
            <Link
              href={selectedCompanyId ? `/employees?company=${selectedCompanyId}#all-employees` : "/employees#all-employees"}
              className="dash-kpi-card"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.28)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'nowrap',
                padding: '24px 28px',
                minHeight: '135px',
                borderRadius: '12px',
                boxSizing: 'border-box',
              }}
            >
              <div className="kpi-content">
                <span className="kpi-label">{selectedCompany ? 'Company Staff' : 'All Employees'}</span>
                <div className="kpi-val">{totalEmployees}</div>
                <div className="kpi-footer">
                  <span className="kpi-subtext">+{activePercent}% Active</span>
                </div>
              </div>
              <div className="kpi-chart-ring">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path
                    className="circle-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="circle-stroke"
                    strokeDasharray={`${activePercent}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.5" className="circle-percentage">{activePercent}%</text>
                </svg>
              </div>
            </Link>

            {/* Card 2: Amber Yellow/Orange (Pending Leave + Today on leave) */}
            <Link
              href="/leave"
              className="dash-kpi-card"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                boxShadow: '0 8px 20px rgba(245, 158, 11, 0.28)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'nowrap',
                padding: '24px 28px',
                minHeight: '135px',
                borderRadius: '12px',
                boxSizing: 'border-box',
              }}
            >
              <div className="kpi-content">
                <span className="kpi-label">Pending Leave</span>
                <div className="kpi-val">{pendingLeaves}</div>
                <div className="kpi-footer">
                  <span className="kpi-subtext">Today on leave: {todayOnLeave}</span>
                </div>
              </div>
              <div className="kpi-chart-ring">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path
                    className="circle-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="circle-stroke"
                    strokeDasharray={`${leavePercent > 0 ? Math.max(leavePercent, 14) : 0}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.5" className="circle-percentage">{leavePercent > 0 ? `${leavePercent}%` : ''}</text>
                </svg>
              </div>
            </Link>

            {/* Card 3: Coral Red (Duplicate 3 hidden from circle ring) */}
            <Link
              href="/documents"
              className="dash-kpi-card"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 8px 20px rgba(239, 68, 68, 0.28)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'nowrap',
                padding: '24px 28px',
                minHeight: '135px',
                borderRadius: '12px',
                boxSizing: 'border-box',
              }}
            >
              <div className="kpi-content">
                <span
                  className="kpi-label"
                  style={{
                    fontSize: '14.5px',
                    fontWeight: 700,
                    color: '#ffffff',
                    whiteSpace: 'normal',
                    lineHeight: 1.3,
                    overflow: 'visible',
                    textOverflow: 'clip',
                  }}
                >
                  {expiringDocs} documents expiring in next 90 days
                </span>
                <div className="kpi-footer" style={{ marginTop: '8px' }}>
                  <span className="kpi-subtext">Action Required</span>
                </div>
              </div>
              <div className="kpi-chart-ring">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path
                    className="circle-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="circle-stroke"
                    strokeDasharray={`${expiringPercent > 0 ? Math.max(expiringPercent, 18) : 0}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.5" className="circle-percentage">{expiringPercent}%</text>
                </svg>
              </div>
            </Link>

            {/* Card 4: Royal Blue */}
            <Link
              href="/notifications"
              className="dash-kpi-card"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 8px 20px rgba(59, 130, 246, 0.28)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'nowrap',
                padding: '24px 28px',
                minHeight: '135px',
                borderRadius: '12px',
                boxSizing: 'border-box',
              }}
            >
              <div className="kpi-content">
                <span className="kpi-label">Notifications</span>
                <div className="kpi-val">{unreadNotifications}</div>
                <div className="kpi-footer">
                  <span className="kpi-subtext">Unread Alerts</span>
                </div>
              </div>
              <div className="kpi-chart-ring">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path
                    className="circle-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="circle-stroke"
                    strokeDasharray={`${unreadNotifications > 0 ? Math.min(unreadNotifications * 25, 100) : 0}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.5" className="circle-percentage">{unreadNotifications > 0 ? unreadNotifications : ''}</text>
                </svg>
              </div>
            </Link>
          </div>

          {/* =========================================================================
              ZONE 2: Middle Section (Image 4 Stats Chart + Recent Attendance Table)
             ========================================================================= */}
          <div className="dash-middle-grid">
            {/* Left Box: Workforce Attendance Statistics (Exact Image 4 Floating Bars) */}
            <div className="card dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">Statistics of Workforce Attendance</h3>
                  <div className="dash-card-subtitle">Monthly attendance, punctuality & leave trends</div>
                </div>
                <div className="chart-legend">
                  <span className="legend-item"><span className="dot dot-present" /> Present</span>
                  <span className="legend-item"><span className="dot dot-late" /> Late</span>
                  <span className="legend-item"><span className="dot dot-leave" /> Leave</span>
                </div>
              </div>

              {/* Exact Image 4 Floating Segmented Bars */}
              <div className="chart-wrapper">
                <div className="chart-y-axis">
                  <span>100%</span>
                  <span>80%</span>
                  <span>60%</span>
                  <span>40%</span>
                  <span>20%</span>
                </div>

                <div className="chart-bars-container">
                  {monthlyStats.map((item, idx) => (
                    <div key={idx} className="chart-col">
                      <div className="chart-floating-slot" style={{ justifyContent: item.hasData ? 'flex-start' : 'flex-end' }}>
                        {/* Top: Leave (Coral Red) */}
                        {item.leave > 0 ? (
                          <div
                            className="segment-pill segment-leave"
                            style={{ height: `${item.leave}%` }}
                            title={`${item.month} Leave: ${item.leave}% (${item.leaveCount} records)`}
                          />
                        ) : null}
                        {/* Middle: Late (Amber Yellow) */}
                        {item.late > 0 ? (
                          <div
                            className="segment-pill segment-late"
                            style={{ height: `${item.late}%` }}
                            title={`${item.month} Late: ${item.late}% (${item.lateCount} records)`}
                          />
                        ) : null}
                        {/* Bottom: Present (Cyan Blue) */}
                        {item.present > 0 ? (
                          <div
                            className="segment-pill segment-present"
                            style={{ height: `${item.present}%` }}
                            title={`${item.month} Present: ${item.present}% (${item.presentCount} records)`}
                          />
                        ) : null}
                        {!item.hasData ? (
                          <div
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: 'var(--line-strong, #cbd5e1)',
                              opacity: 0.45,
                              marginBottom: 2,
                            }}
                            title={`${item.month}: No attendance logs yet`}
                          />
                        ) : null}
                      </div>
                      <span className="chart-label">{item.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Box: Recent Attendance (Cyan Button, No Icon, Scrollable) */}
            <div className="card dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">Recent Attendance</h3>
                  <div className="dash-card-subtitle">Latest check-in logs & punctuality</div>
                </div>
                <Link
                  href="/attendance"
                  className="cyan-btn"
                  style={{
                    background: '#00b8db',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    display: 'inline-block',
                    border: 'none',
                  }}
                >
                  All Attendance
                </Link>
              </div>

              <div className="dash-scroll-box" style={{ maxHeight: '270px' }}>
                <table className="dash-table" style={{ minWidth: '440px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '25%', whiteSpace: 'nowrap' }}>Date</th>
                      <th style={{ width: '35%', whiteSpace: 'nowrap' }}>Employee</th>
                      <th style={{ width: '20%', whiteSpace: 'nowrap' }}>Status</th>
                      <th style={{ width: '20%', textAlign: 'right', whiteSpace: 'nowrap' }}>Late (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecentAttendance.length ? (
                      filteredRecentAttendance.map((r, i) => (
                        <tr key={i} className="dash-row">
                          <td style={{ fontWeight: 500 }}>{formatDate(v(r, 'workDate', 'work_date'))}</td>
                          <td>
                            <span className="emp-name-cell" title={v(r, 'fullName', 'full_name')}>
                              {v(r, 'fullName', 'full_name')}
                            </span>
                          </td>
                          <td>
                            <Badge status={r.status} />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatLate(v(r, 'lateMinutes', 'late_minutes'))}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                          {selectedCompany ? `No recent attendance records for ${v(selectedCompany, 'name')}.` : 'No recent attendance records.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* =========================================================================
              ZONE 3: Bottom Section (Activity Feed + All Employees Numbered List)
             ========================================================================= */}
          <div className="dash-bottom-grid">
            {/* Left Box: Activity Feed (No Badges on Left, Cyan Button, Scrollable) */}
            <div className="card dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">Activity Feed</h3>
                  <div className="dash-card-subtitle">Recent employee actions and system updates</div>
                </div>
                <Link
                  href="/notifications"
                  className="cyan-btn"
                  style={{
                    background: '#00b8db',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    display: 'inline-block',
                    border: 'none',
                  }}
                >
                  All Activity
                </Link>
              </div>

              <div className="dash-scroll-box" style={{ maxHeight: '290px' }}>
                {filteredActivities.length ? (
                  <div className="activity-list">
                    {filteredActivities.map((act) => (
                      <div key={act.id} className="activity-item">
                        <div className="activity-main">
                          <div className="activity-title">{act.title}</div>
                          {act.desc && act.desc !== act.title ? (
                            <div className="activity-desc">{act.desc}</div>
                          ) : null}
                        </div>
                        <div className="activity-time">
                          {act.date ? formatDate(act.date) : 'Today'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ textAlign: 'center', padding: '36px 0' }}>
                    {selectedCompany ? `No recent activities recorded for ${v(selectedCompany, 'name')}.` : 'No recent activities recorded.'}
                  </div>
                )}
              </div>
            </div>

            {/* Right Box: All Employees (Cyan Button, No Manage Button, Scrollable) */}
            <div className="card dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 className="dash-card-title">
                    {selectedCompany ? `Employees (${filteredEmployees.length})` : 'All Employees'}
                  </h3>
                  <div className="dash-card-subtitle">
                    {selectedCompany ? `Workforce directory for ${v(selectedCompany, 'name')}` : 'Complete workforce directory'}
                  </div>
                </div>
                <Link
                  href={selectedCompanyId ? `/employees?company=${selectedCompanyId}#all-employees` : "/employees#all-employees"}
                  className="cyan-btn"
                  style={{
                    background: '#00b8db',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    display: 'inline-block',
                    border: 'none',
                  }}
                >
                  {selectedCompany ? 'View Company Staff' : 'All Employees'}
                </Link>
              </div>

              <div className="dash-scroll-box" style={{ maxHeight: '290px' }}>
                <table className="dash-table emp-directory-table" style={{ minWidth: '480px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '10%', whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ width: '22%', whiteSpace: 'nowrap' }}>Code</th>
                      <th style={{ width: '30%', whiteSpace: 'nowrap' }}>Name</th>
                      <th style={{ width: '23%', whiteSpace: 'nowrap' }}>Department</th>
                      <th style={{ width: '15%', textAlign: 'right', whiteSpace: 'nowrap' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length ? (
                      filteredEmployees.map((emp, index) => {
                        if (!emp) return null;
                        let md = {};
                        try {
                          md = typeof emp?.masterData === 'string' ? JSON.parse(emp?.masterData || '{}') : emp?.masterData || {};
                        } catch {
                          md = {};
                        }
                        const code = v(emp, 'empCode', 'emp_code') || md.empCode || `DD-${1000 + index}`;
                        const name = v(emp, 'fullName', 'full_name') || [md.firstName, md.lastName].filter(Boolean).join(' ') || '—';
                        const dept = v(emp, 'departmentName', 'department_name') || md.departmentName || md.department || 'General';
                        const status = v(emp, 'status') || md.status || 'active';

                        return (
                          <tr
                            key={v(emp, 'id') || index}
                            className="dash-row"
                            style={{ cursor: 'pointer' }}
                            onClick={() => router.push(`/employees?id=${v(emp, 'id')}`)}
                          >
                            <td style={{ fontWeight: 700, color: 'var(--muted)' }}>#{index + 1}</td>
                            <td>
                              <span className="code-pill">{code}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              <span className="emp-name-cell" title={name}>{name}</span>
                            </td>
                            <td>
                              <span className="dept-cell" title={dept}>{dept}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <Badge status={status} />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '36px 0' }}>
                          {selectedCompany ? `No employee records found for ${v(selectedCompany, 'name')}.` : 'No employee records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* =========================================================================
              ZONE 4: Companies Section (Corporate Entities & Add Company Option)
             ========================================================================= */}
          <div className="card dash-card">
            <div className="dash-card-header">
              <div>
                <h3 className="dash-card-title">Companies</h3>
                <div className="dash-card-subtitle">Corporate entities & payroll divisions</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddCompany((prev) => !prev)}
                  style={{
                    background: '#00b8db',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {showAddCompany ? 'Close' : '+ Add Company'}
                </button>
                <Link
                  href="/divisions"
                  style={{
                    background: '#00b8db',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 14px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    display: 'inline-block',
                    border: 'none',
                  }}
                >
                  All Companies
                </Link>
              </div>
            </div>

            {companyMsg ? (
              <div className="muted" style={{ marginBottom: 12, color: 'var(--ok)', fontWeight: 600 }}>
                {companyMsg}
              </div>
            ) : null}

            {/* Quick Add Company Form (Expandable directly from Dashboard) */}
            {showAddCompany ? (
              <form onSubmit={handleCreateCompany} style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
              }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--ink)' }}>
                  Add New Company
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <label className="field" style={{ margin: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Company Code</span>
                    <input
                      required
                      placeholder="e.g. ROYAL_OCEANS"
                      value={newCompany.code}
                      onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value.toUpperCase() })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--line)', boxSizing: 'border-box' }}
                    />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Company Name</span>
                    <input
                      required
                      placeholder="e.g. Royal Oceans General Trading"
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--line)', boxSizing: 'border-box' }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    disabled={companySaving}
                    style={{
                      background: '#00b8db',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {companySaving ? 'Saving…' : 'Save Company'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCompany(false)}
                    style={{
                      background: 'transparent',
                      color: 'var(--muted)',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--line)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {/* Companies List Table with Vertical Scroll & 10-per-page Pagination */}
            <div className="dash-scroll-box" style={{ maxHeight: '250px' }}>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Code</th>
                    <th style={{ width: '45%' }}>Company Name</th>
                    <th style={{ width: '15%' }}>Status</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.length ? (
                    companies
                      .slice((companyPage - 1) * 10, companyPage * 10)
                      .map((comp) => {
                        const code = v(comp, 'code') || '—';
                        const name = v(comp, 'name') || '—';
                        const status = v(comp, 'status') || 'active';
                        const isCurrentSelected = String(v(comp, 'id')) === String(selectedCompanyId);

                        return (
                          <tr
                            key={v(comp, 'id')}
                            className="dash-row"
                            style={{
                              background: isCurrentSelected ? 'rgba(0, 184, 219, 0.07)' : undefined,
                            }}
                          >
                            <td>
                              <span className="code-pill">{code}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {name}
                              {isCurrentSelected ? (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: '11px',
                                    padding: '2px 7px',
                                    borderRadius: 4,
                                    background: '#00b8db',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                  }}
                                >
                                  Current View
                                </span>
                              ) : null}
                            </td>
                            <td>
                              <Badge status={status} />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedCompanyId(isCurrentSelected ? '' : String(v(comp, 'id')))}
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: isCurrentSelected ? '1px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                                  background: isCurrentSelected ? '#00b8db' : 'var(--surface-alt, #f8fafc)',
                                  color: isCurrentSelected ? '#ffffff' : 'var(--ink, #0f172a)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {isCurrentSelected ? 'Clear' : 'Filter View'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                        No companies registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar (< 1, 2, 3... >) */}
            {companies.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: '1px solid var(--line, #e2e8f0)',
                }}
              >
                <div className="muted" style={{ fontSize: '11.5px' }}>
                  Showing {(companyPage - 1) * 10 + 1}–{Math.min(companyPage * 10, companies.length)} of {companies.length} companies
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {/* Previous < Icon Button */}
                  <button
                    type="button"
                    disabled={companyPage <= 1}
                    onClick={() => setCompanyPage((p) => Math.max(1, p - 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface, #ffffff)',
                      color: companyPage <= 1 ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                      cursor: companyPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: companyPage <= 1 ? 0.45 : 1,
                      transition: 'all 0.15s ease',
                    }}
                    title="Previous page"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: Math.ceil(companies.length / 10) || 1 }, (_, i) => i + 1).map((p) => {
                    const isActive = p === companyPage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCompanyPage(p)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 28,
                          height: 28,
                          padding: '0 6px',
                          borderRadius: 6,
                          border: isActive ? '1px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                          background: isActive ? '#00b8db' : 'var(--surface, #ffffff)',
                          color: isActive ? '#ffffff' : 'var(--ink, #0f172a)',
                          fontWeight: isActive ? 700 : 500,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}

                  {/* Next > Icon Button */}
                  <button
                    type="button"
                    disabled={companyPage >= Math.ceil(companies.length / 10)}
                    onClick={() => setCompanyPage((p) => Math.min(Math.ceil(companies.length / 10), p + 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface, #ffffff)',
                      color: companyPage >= Math.ceil(companies.length / 10) ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                      cursor: companyPage >= Math.ceil(companies.length / 10) ? 'not-allowed' : 'pointer',
                      opacity: companyPage >= Math.ceil(companies.length / 10) ? 0.45 : 1,
                      transition: 'all 0.15s ease',
                    }}
                    title="Next page"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .dash-container {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        /* --- Top 4 Colored Cards (Zone 1) --- */
        .dash-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        @media (max-width: 1100px) {
          .dash-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .dash-kpi-grid {
            grid-template-columns: 1fr;
          }
        }

        .dash-kpi-card {
          border-radius: 12px;
          padding: 24px 28px !important;
          min-height: 135px !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-wrap: nowrap !important;
          text-decoration: none;
          color: #ffffff !important;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          position: relative;
          overflow: hidden;
          cursor: pointer;
          min-width: 0;
        }

        .dash-kpi-card:hover {
          transform: translateY(-3px);
        }

        .kpi-content {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          gap: 6px !important;
          min-width: 0;
          flex: 1;
        }

        .kpi-label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95) !important;
          letter-spacing: 0.2px;
          white-space: nowrap;
          overflow: visible;
        }

        .kpi-val {
          font-size: 34px;
          font-weight: 800;
          line-height: 1.1;
          color: #ffffff !important;
          margin: 2px 0;
        }

        .kpi-footer {
          margin-top: 2px;
        }

        .kpi-subtext {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff !important;
          display: inline-block;
          white-space: nowrap;
        }

        .kpi-chart-ring {
          width: 62px;
          height: 62px;
          flex-shrink: 0 !important;
          margin-left: 16px;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .circular-chart {
          display: block;
          max-width: 100%;
          max-height: 100%;
        }

        .circle-bg {
          fill: none;
          stroke: rgba(255, 255, 255, 0.25);
          stroke-width: 3.5;
        }

        .circle-stroke {
          fill: none;
          stroke: #ffffff;
          stroke-width: 3.5;
          stroke-linecap: round;
        }

        .circle-percentage {
          fill: #ffffff;
          font-size: 9.5px;
          font-weight: 800;
          text-anchor: middle;
        }

        /* --- Clean Cyan Button (No Icons, Uniform across Dashboard) --- */
        .cyan-btn {
          background: #00b8db !important;
          color: #ffffff !important;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 6px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s ease;
          border: none;
        }

        .cyan-btn:hover {
          opacity: 0.9;
        }

        /* --- Middle Section (Zone 2) --- */
        .dash-middle-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 16px;
        }

        @media (max-width: 900px) {
          .dash-middle-grid,
          .dash-bottom-grid {
            grid-template-columns: 1fr !important;
          }
        }

        .dash-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 18px 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
        }

        .dash-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 14px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .dash-card-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0;
          color: var(--ink);
        }

        .dash-card-subtitle {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }

        /* Chart Legends */
        .chart-legend {
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
        }

        .dot-present {
          background: #38bdf8;
        }
        .dot-late {
          background: #f59e0b;
        }
        .dot-leave {
          background: #f87171;
        }

        /* --- Exact Image 4 Floating Segmented Bars --- */
        .chart-wrapper {
          display: flex;
          gap: 8px;
          height: 230px;
          padding-top: 10px;
        }

        .chart-y-axis {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 600;
          color: var(--muted);
          text-align: right;
          padding-bottom: 22px;
        }

        .chart-bars-container {
          display: flex;
          flex: 1;
          justify-content: space-between;
          align-items: flex-end;
          padding-bottom: 2px;
        }

        .chart-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex: 1;
          height: 100%;
        }

        .chart-floating-slot {
          width: 6px;
          height: 190px;
          display: flex;
          flex-direction: column-reverse;
          gap: 4px;
          align-items: center;
        }

        .segment-pill {
          width: 6px;
          border-radius: 999px;
          transition: height 0.3s ease;
        }

        .segment-present {
          background: #38bdf8;
        }
        .segment-late {
          background: #f59e0b;
        }
        .segment-leave {
          background: #f87171;
        }

        .chart-label {
          font-size: 10.5px;
          font-weight: 600;
          color: var(--muted);
        }

        /* --- Scrollable Table & Lists (Zones 2 & 3) --- */
        .dash-scroll-box {
          overflow-y: auto;
          overflow-x: auto;
          width: 100%;
          border-radius: 6px;
          -webkit-overflow-scrolling: touch;
        }

        .dash-scroll-box::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }

        .dash-scroll-box::-webkit-scrollbar-track {
          background: transparent;
        }

        .dash-scroll-box::-webkit-scrollbar-thumb {
          background: var(--line-strong);
          border-radius: 4px;
        }

        .dash-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }

        .dash-table thead th {
          position: sticky;
          top: 0;
          background: var(--surface);
          z-index: 2;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 8px 10px;
          border-bottom: 1px solid var(--line);
          text-align: left;
        }

        .dash-row td {
          padding: 10px 10px;
          border-bottom: 1px solid var(--line);
          vertical-align: middle;
        }

        .dash-row:last-child td {
          border-bottom: none;
        }

        .dash-row:hover {
          background: var(--surface-alt);
        }

        .emp-name-cell {
          display: block;
          max-width: 130px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dept-cell {
          display: block;
          max-width: 90px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--muted);
        }

        .code-pill {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--badge-bg);
          color: var(--brand);
          font-family: monospace;
        }

        /* --- Bottom Section (Zone 3) --- */
        .dash-bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        /* Activity Feed list (No Left Badges, Clean Horizontal Rows) */
        .activity-list {
          display: flex;
          flex-direction: column;
        }

        .activity-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 6px;
          border-bottom: 1px solid var(--line);
        }

        .activity-item:last-child {
          border-bottom: none;
        }

        .activity-item:hover {
          background: var(--surface-alt);
        }

        .activity-main {
          flex: 1;
          min-width: 0;
        }

        .activity-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .activity-desc {
          font-size: 11.5px;
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        .activity-time {
          font-size: 11.5px;
          color: var(--muted);
          font-weight: 500;
          white-space: nowrap;
        }
      `}</style>
    </AppShell>
  );
}


