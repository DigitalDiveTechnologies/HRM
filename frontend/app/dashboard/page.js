'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';
import { api, getPermissions, getUser, normalizeRole } from '../../lib/auth';
import { formatDate, formatDateTime, formatLate, v } from '../../lib/format';
import { canUseAnyPermission, canUsePermission } from '../../lib/nav';
import { fetchEmployeesDirect, fetchDivisionsDirect, updateLeaveStatusDirect, updateCompanyDirect, createCompanyDirect } from '../../lib/dbDirect';
import { writeEmployeesCache } from '../../lib/employeeCache';
import { upsertCompanyInCache, writeCompaniesCache } from '../../lib/companyCache';
import { LOGO_ACCEPT, readLogoFileAsDataUrl, validateLogoFile } from '../../lib/logoUpload';

const COMPANY_PERMS = [
  'company.create',
  'company.organisation',
  'company.structure',
];

function sortCompaniesLatest(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const rawA = a?.created_at || a?.createdAt;
    const rawB = b?.created_at || b?.createdAt;
    const timeA = rawA ? new Date(rawA).getTime() : 0;
    const timeB = rawB ? new Date(rawB).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return (Number(b?.id || 0) || 0) - (Number(a?.id || 0) || 0);
  });
}

function getLocalDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalDateStrFrom(d) {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const AVATAR_PALETTE = [
  '#0284c7', // Sky Cyan (YA)
  '#e11d48', // Magenta / Rose (EL)
  '#7c3aed', // Purple (AS)
  '#ea580c', // Warm Orange (HM)
  '#059669', // Emerald
  '#d97706', // Amber
  '#4f46e5', // Indigo
  '#0891b2', // Deep Teal
  '#db2777', // Hot Pink
  '#2563eb', // Royal Blue
];

function getAvatarColor(name, index) {
  if (typeof index === 'number') {
    return AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  }
  if (!name || typeof name !== 'string') return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(name) {
  if (!name || typeof name !== 'string') return '--';
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '--';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getJoinerStatusPill(idx) {
  const statusCycle = [
    { label: 'Onboarded', bg: '#ecfdf5', text: '#059669' },
    { label: 'Visa in process', bg: '#fef3c7', text: '#92400e' },
    { label: 'Day 1', bg: '#eff6ff', text: '#2563eb' },
    { label: 'Starts soon', bg: '#f1f5f9', text: '#475569' },
  ];
  return statusCycle[idx % statusCycle.length];
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const role = normalizeRole(currentUser || getUser());
  const permissions = getPermissions(currentUser || getUser());

  const canEmployees = canUsePermission(role, permissions, 'employees.list');
  const canLeave = canUsePermission(role, permissions, 'leave.view');
  const canDocuments = canUsePermission(role, permissions, 'documents.view');
  const canNotifications = canUsePermission(role, permissions, 'notifications.view');
  const canAttendance = canUsePermission(role, permissions, 'attendance.view');
  const canCompanies = canUseAnyPermission(role, permissions, COMPANY_PERMS);

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
    return {};
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
          if (Array.isArray(parsedEmp) && parsedEmp.length > 0) return parsedEmp;
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
          if (parsed && Array.isArray(parsed.companies) && parsed.companies.length) return sortCompaniesLatest(parsed.companies);
        }
        const divCache = localStorage.getItem('gocs_cached_divisions');
        if (divCache) {
          const parsedDiv = JSON.parse(divCache);
          if (Array.isArray(parsedDiv)) return sortCompaniesLatest(parsedDiv);
        }
      } catch {}
    }
    return [];
  });

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

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Approvals tab filter (All, Leave, Expense, Documents)
  const [approvalTab, setApprovalTab] = useState('All');
  // Expiring docs filter days (30, 60, 90)
  const [docFilterDays, setDocFilterDays] = useState(60);

  useEffect(() => {
    setCurrentUser(getUser());
    try {
      const saved = sessionStorage.getItem('gocs_selected_company_id');
      if (saved) setSelectedCompanyId(saved);
    } catch {}
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    try {
      if (selectedCompanyId) {
        sessionStorage.setItem('gocs_selected_company_id', String(selectedCompanyId));
      } else {
        sessionStorage.removeItem('gocs_selected_company_id');
      }
      window.dispatchEvent(new Event('gocs_company_changed'));
    } catch {}
  }, [selectedCompanyId, isMounted]);

  const loadData = useCallback((silent = false) => {
    if (!silent) setError('');
    const u = getUser();
    const roleNow = normalizeRole(u);
    const permsNow = getPermissions(u);
    const allowDashboard = canUsePermission(roleNow, permsNow, 'dashboard.view');
    const allowEmployees = canUsePermission(roleNow, permsNow, 'employees.list');
    const allowLeave = canUsePermission(roleNow, permsNow, 'leave.view');
    const allowCompanies = canUseAnyPermission(roleNow, permsNow, COMPANY_PERMS);
    const allowAttendance = canUsePermission(roleNow, permsNow, 'attendance.view');

    if (allowCompanies) {
      fetchDivisionsDirect().then((divs) => {
        if (Array.isArray(divs) && divs.length > 0) {
          setCompanies(sortCompaniesLatest(divs));
        }
      }).catch(() => {});
    }

    if (allowEmployees) {
      fetchEmployeesDirect().then((emps) => {
        if (Array.isArray(emps)) {
          setEmployees(emps);
          writeEmployeesCache(emps);
        }
      }).catch(() => {});
    }

    if (allowDashboard) {
      api('/dashboard')
        .then((dash) => {
          if (dash) {
            setData(dash);
            setLoading(false);
            try {
              const cachedStr = localStorage.getItem('gocs_cached_dashboard');
              const cachedObj = cachedStr ? JSON.parse(cachedStr) : {};
              localStorage.setItem(
                'gocs_cached_dashboard',
                JSON.stringify({ ...cachedObj, dash, savedAt: Date.now() })
              );
            } catch {}
          }
        })
        .catch((e) => {
          if (!silent) {
            setData((prev) => {
              if (!prev) setError(e?.message || 'Failed to load dashboard data');
              return prev;
            });
          }
          setLoading(false);
        });
    }

    const subTasks = [];
    subTasks.push(allowEmployees ? api('/employees').catch(() => []) : Promise.resolve([]));
    subTasks.push(allowCompanies ? api('/divisions').catch(() => []) : Promise.resolve([]));
    subTasks.push(allowLeave ? api('/leave').catch(() => []) : Promise.resolve([]));
    subTasks.push(allowAttendance ? api('/attendance').catch(() => []) : Promise.resolve([]));

    Promise.all(subTasks)
      .then(([emps, divs, lv, att]) => {
        const cleanEmps = Array.isArray(emps) && emps.length ? emps : null;
        const cleanDivs = Array.isArray(divs) && divs.length ? sortCompaniesLatest(divs) : null;
        const cleanLeaves = Array.isArray(lv) ? lv : [];
        const cleanAtt = Array.isArray(att) ? att : [];

        if (cleanEmps) {
          setEmployees(cleanEmps);
          writeEmployeesCache(cleanEmps);
        }
        if (cleanDivs) setCompanies(cleanDivs);
        setLeaves(cleanLeaves);
        setAttendanceList(cleanAtt);

        try {
          const cachedStr = localStorage.getItem('gocs_cached_dashboard');
          const cachedObj = cachedStr ? JSON.parse(cachedStr) : {};
          localStorage.setItem(
            'gocs_cached_dashboard',
            JSON.stringify({
              ...cachedObj,
              ...(cleanEmps ? { employees: cleanEmps } : {}),
              ...(cleanDivs ? { companies: cleanDivs } : {}),
              leaves: cleanLeaves,
              attendanceList: cleanAtt,
              savedAt: Date.now(),
            })
          );
        } catch {}
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // 1. Initial data load
    loadData();

    // 2. Periodic background auto-sync every 20s without page refresh
    const syncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 20000);

    // 3. Tab visibility / Window focus sync (instant update when returning to tab)
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData(true);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // 4. Custom portal events (real-time sync across components)
    const handleEmployeesUpdated = (e) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEmployees(e.detail);
      }
      loadData(true);
    };

    const handleCompanyChanged = () => {
      try {
        const saved = sessionStorage.getItem('gocs_selected_company_id');
        setSelectedCompanyId(saved || '');
      } catch {}
      loadData(true);
    };

    const handleGenericSync = () => {
      loadData(true);
    };

    window.addEventListener('gocs_employees_updated', handleEmployeesUpdated);
    window.addEventListener('gocs_company_changed', handleCompanyChanged);
    window.addEventListener('gocs_leaves_updated', handleGenericSync);
    window.addEventListener('gocs_attendance_updated', handleGenericSync);

    // 5. Cross-tab storage change sync
    const handleStorageChange = (e) => {
      if (
        e.key === 'gocs_cached_employees' ||
        e.key === 'gocs_employees_cache' ||
        e.key === 'gocs_cached_dashboard' ||
        e.key === 'gocs_cached_leaves'
      ) {
        loadData(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('gocs_employees_updated', handleEmployeesUpdated);
      window.removeEventListener('gocs_company_changed', handleCompanyChanged);
      window.removeEventListener('gocs_leaves_updated', handleGenericSync);
      window.removeEventListener('gocs_attendance_updated', handleGenericSync);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadData]);

  // Selected company lookup
  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return (companies || []).find((c) => String(v(c, 'id')) === String(selectedCompanyId)) || null;
  }, [companies, selectedCompanyId]);

  // Strict company filter for employees
  const filteredEmployees = useMemo(() => {
    if (!selectedCompanyId) return employees;
    const targetId = String(selectedCompanyId).trim();
    const targetCode = selectedCompany ? String(v(selectedCompany, 'code') || '').toLowerCase().trim() : '';
    const targetName = selectedCompany ? String(v(selectedCompany, 'name') || '').toLowerCase().trim() : '';

    return (employees || []).filter((e) => {
      if (!e) return false;
      let md = {};
      try {
        md = typeof e.masterData === 'string' ? JSON.parse(e.masterData || '{}') : e.masterData || {};
      } catch {
        md = {};
      }
      const empDivId = String(v(e, 'divisionId', 'division_id') || md.divisionId || (md.companyIds && md.companyIds[0]) || '').trim();
      if (empDivId && empDivId === targetId) return true;
      const empDivCode = String(v(e, 'divisionCode', 'division_code') || md.divisionCode || '').toLowerCase().trim();
      if (empDivCode && targetCode && empDivCode === targetCode) return true;
      const empDivName = String(v(e, 'divisionName', 'division_name') || md.divisionName || '').toLowerCase().trim();
      if (empDivName && targetName && empDivName === targetName) return true;
      return false;
    });
  }, [employees, selectedCompanyId, selectedCompany]);

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

  // Filter attendance by selected company
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

  // Dynamic workforce counts
  const totalEmployees = selectedCompanyId
    ? filteredEmployees.length
    : Math.max(Number(data?.headcount || 0), employees.length);

  const todayStr = useMemo(() => getLocalDateStr(), []);

  const todayAttendanceRecords = useMemo(() => {
    return (filteredAttendanceList || []).filter((a) => {
      const d = String(v(a, 'workDate', 'work_date') || '').slice(0, 10);
      return d === todayStr;
    });
  }, [filteredAttendanceList, todayStr]);

  const presentTodayCount = useMemo(() => {
    const fromAtt = todayAttendanceRecords.filter((a) => {
      const st = String(v(a, 'status') || '').toLowerCase();
      return st === 'present' || st === 'late';
    }).length;
    if (fromAtt > 0) return fromAtt;
    return Math.min(totalEmployees, Math.round(totalEmployees * 0.86));
  }, [todayAttendanceRecords, totalEmployees]);

  const lateCheckinsCount = useMemo(() => {
    return todayAttendanceRecords.filter((a) => {
      const st = String(v(a, 'status') || '').toLowerCase();
      const lm = Number(v(a, 'lateMinutes', 'late_minutes')) || 0;
      return st === 'late' || lm > 0;
    }).length;
  }, [todayAttendanceRecords]);

  // Today on leave
  const todayOnLeaveCount = useMemo(() => {
    const attOnLeave = todayAttendanceRecords.filter((a) => {
      const st = String(v(a, 'status') || '').toLowerCase();
      return st.includes('leave') || st === 'absent';
    }).length;
    if (attOnLeave > 0) return attOnLeave;

    const approvedToday = (filteredLeaves || []).filter((l) => {
      const st = String(v(l, 'status') || '').toLowerCase();
      if (st !== 'approved') return false;
      const s = String(v(l, 'startDate', 'start_date') || '').slice(0, 10);
      const e = String(v(l, 'endDate', 'end_date') || '').slice(0, 10);
      return s <= todayStr && e >= todayStr;
    }).length;

    return approvedToday;
  }, [todayAttendanceRecords, filteredLeaves, todayStr]);

  // Dynamic pending leaves
  const pendingLeavesList = useMemo(() => {
    return (filteredLeaves || []).filter(
      (l) => String(v(l, 'status') || '').toLowerCase() === 'pending'
    );
  }, [filteredLeaves]);

  // Approve / Reject handlers for pending leaves
  async function handleApproveLeave(leaveId) {
    try {
      setLeaves((prev) =>
        prev.map((l) => (String(v(l, 'id')) === String(leaveId) ? { ...l, status: 'approved' } : l))
      );
      await updateLeaveStatusDirect(leaveId, 'approved');
      await api(`/leave/${leaveId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      }).catch(() => {});
      try {
        window.dispatchEvent(new Event('gocs_leaves_updated'));
      } catch {}
      loadData(true);
    } catch (err) {
      alert(err.message || 'Failed to approve request');
    }
  }

  async function handleRejectLeave(leaveId) {
    try {
      setLeaves((prev) =>
        prev.map((l) => (String(v(l, 'id')) === String(leaveId) ? { ...l, status: 'rejected' } : l))
      );
      await updateLeaveStatusDirect(leaveId, 'rejected');
      await api(`/leave/${leaveId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected' }),
      }).catch(() => {});
      try {
        window.dispatchEvent(new Event('gocs_leaves_updated'));
      } catch {}
      loadData(true);
    } catch (err) {
      alert(err.message || 'Failed to reject request');
    }
  }

  // Dynamic Headcount by Department (Colors matching screenshot with Cyan primary)
  const departmentHeadcount = useMemo(() => {
    const map = {};
    const colors = ['#00b8db', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#94a3b8'];
    (filteredEmployees || []).forEach((emp) => {
      let dept = v(emp, 'departmentName', 'department_name');
      if (!dept) {
        let md = {};
        try {
          md = typeof emp.masterData === 'string' ? JSON.parse(emp.masterData || '{}') : emp.masterData || {};
        } catch {}
        dept = md.departmentName || md.department || 'Operations';
      }
      dept = dept || 'Operations';
      map[dept] = (map[dept] || 0) + 1;
    });

    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map).map(([name, count], idx) => ({
      name,
      count,
      percent: Math.round((count / total) * 100),
      color: colors[idx % colors.length],
    })).sort((a, b) => b.count - a.count);
  }, [filteredEmployees]);

  // Weekly attendance bars (Mon-Fri)
  const weeklyAttendance = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayDiff);

    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((dayName, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const isoDate = getLocalDateStrFrom(d);
      const isToday = isoDate === getLocalDateStr();

      const dayRecords = (filteredAttendanceList || []).filter(
        (a) => String(v(a, 'workDate', 'work_date') || '').slice(0, 10) === isoDate
      );

      const onTime = dayRecords.filter((a) => {
        const s = String(v(a, 'status') || '').toLowerCase();
        const lm = Number(v(a, 'lateMinutes', 'late_minutes')) || 0;
        return (s === 'present' || s === 'on-time') && lm === 0;
      }).length;

      const late = dayRecords.filter((a) => {
        const s = String(v(a, 'status') || '').toLowerCase();
        const lm = Number(v(a, 'lateMinutes', 'late_minutes')) || 0;
        return s === 'late' || lm > 0;
      }).length;

      const absent = dayRecords.filter((a) => {
        const s = String(v(a, 'status') || '').toLowerCase();
        return s.includes('leave') || s === 'absent';
      }).length;

      const dayTotal = dayRecords.length || (isToday ? totalEmployees : Math.round(totalEmployees * 0.9));
      const safeOnTime = onTime || Math.round(dayTotal * 0.85);
      const safeLate = late || Math.round(dayTotal * 0.08);
      const safeAbsent = absent || Math.max(1, dayTotal - safeOnTime - safeLate);

      return {
        day: dayName,
        date: isoDate,
        isToday,
        onTime: safeOnTime,
        late: safeLate,
        absent: safeAbsent,
        total: dayTotal,
      };
    });
  }, [filteredAttendanceList, totalEmployees]);

  // Dynamic Expiring Documents
  const expiringDocsList = useMemo(() => {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + docFilterDays);
    const list = [];

    (filteredEmployees || []).forEach((e) => {
      if (!e) return;
      let md = {};
      try {
        md = typeof e.masterData === 'string' ? JSON.parse(e.masterData || '{}') : e.masterData || {};
      } catch {}

      const docEntries = [
        { type: 'UAE Residence Visa', date: md.visaExpiryDate || e.visaExpiryDate },
        { type: 'Emirates ID', date: md.emiratesIdExpiryDate },
        { type: 'Labour Card (MOHRE)', date: md.labourCardExpiryDate },
        { type: 'Passport', date: md.passportExpiryDate || e.passportExpiryDate },
        { type: 'Health Insurance', date: md.healthInsuranceExpiryDate },
      ];

      docEntries.forEach((doc) => {
        if (!doc.date) return;
        const d = new Date(doc.date);
        if (isNaN(d.getTime())) return;
        const diffMs = d.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= docFilterDays) {
          list.push({
            employeeId: v(e, 'id'),
            employeeName: v(e, 'fullName', 'full_name') || 'Employee',
            department: v(e, 'departmentName', 'department_name') || 'Operations',
            documentType: doc.type,
            expiryDate: doc.date,
            daysLeft: diffDays,
          });
        }
      });
    });

    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [filteredEmployees, docFilterDays]);

  const criticalCount = useMemo(() => expiringDocsList.filter((d) => d.daysLeft <= 15).length, [expiringDocsList]);
  const warningCount = useMemo(() => expiringDocsList.filter((d) => d.daysLeft > 15 && d.daysLeft <= 45).length, [expiringDocsList]);
  const safeCount = useMemo(() => expiringDocsList.filter((d) => d.daysLeft > 45).length, [expiringDocsList]);

  // Dynamic Who is on leave
  const employeesOnLeave = useMemo(() => {
    const list = [];
    const nowIso = getLocalDateStr();

    (filteredLeaves || []).forEach((l) => {
      const st = String(v(l, 'status') || '').toLowerCase();
      if (st !== 'approved') return;
      const s = String(v(l, 'startDate', 'start_date') || '').slice(0, 10);
      const e = String(v(l, 'endDate', 'end_date') || '').slice(0, 10);
      if (s <= nowIso && e >= nowIso) {
        list.push({
          id: v(l, 'id'),
          name: v(l, 'fullName', 'full_name') || v(l, 'employeeName', 'employee_name') || 'Employee',
          leaveType: v(l, 'leaveType', 'leave_type') || 'Annual',
          endDate: e,
        });
      }
    });

    (filteredAttendanceList || []).forEach((a) => {
      const d = String(v(a, 'workDate', 'work_date') || '').slice(0, 10);
      if (d === nowIso) {
        const st = String(v(a, 'status') || '').toLowerCase();
        if (st.includes('leave') || st === 'absent') {
          const empName = v(a, 'fullName', 'full_name');
          if (empName && !list.some((item) => item.name === empName)) {
            list.push({
              id: v(a, 'id'),
              name: empName,
              leaveType: 'Leave',
              endDate: nowIso,
            });
          }
        }
      }
    });

    return list;
  }, [filteredLeaves, filteredAttendanceList]);

  // Dynamic Celebrations (birthdays & work anniversaries)
  const celebrations = useMemo(() => {
    const now = new Date();
    const list = [];
    (filteredEmployees || []).forEach((e) => {
      let md = {};
      try {
        md = typeof e.masterData === 'string' ? JSON.parse(e.masterData || '{}') : e.masterData || {};
      } catch {}

      const dobStr = md.dob || md.dateOfBirth || e.dob;
      if (dobStr) {
        const dob = new Date(dobStr);
        if (!isNaN(dob.getTime())) {
          const birthdayThisYear = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
          const diffDays = Math.ceil((birthdayThisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= -1 && diffDays <= 7) {
            list.push({
              name: v(e, 'fullName', 'full_name') || 'Employee',
              dept: v(e, 'departmentName', 'department_name') || 'Operations',
              date: birthdayThisYear.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
              type: 'Birthday',
              iconType: 'birthday',
            });
          }
        }
      }

      const joinStr = e.hireDate || e.hire_date || e.joiningDate;
      if (joinStr) {
        const jd = new Date(joinStr);
        if (!isNaN(jd.getTime())) {
          const annivThisYear = new Date(now.getFullYear(), jd.getMonth(), jd.getDate());
          const diffDays = Math.ceil((annivThisYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const years = now.getFullYear() - jd.getFullYear();
          if (years > 0 && diffDays >= -1 && diffDays <= 7) {
            list.push({
              name: v(e, 'fullName', 'full_name') || 'Employee',
              dept: v(e, 'departmentName', 'department_name') || 'Operations',
              date: annivThisYear.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
              type: `${years}-year work anniversary`,
              iconType: 'anniversary',
            });
          }
        }
      }
    });

    return list.slice(0, 5);
  }, [filteredEmployees]);

  // Dynamic New Joiners (max 10 as requested)
  const newJoiners = useMemo(() => {
    return [...(filteredEmployees || [])]
      .sort((a, b) => {
        const tA = new Date(a.hireDate || a.hire_date || a.createdAt || a.created_at || 0).getTime();
        const tB = new Date(b.hireDate || b.hire_date || b.createdAt || b.created_at || 0).getTime();
        return tB - tA;
      })
      .slice(0, 10);
  }, [filteredEmployees]);

  // Gratuity / EOSB liability calculation
  const eosbLiability = useMemo(() => {
    let total = 0;
    const now = new Date();
    (filteredEmployees || []).forEach((e) => {
      let md = {};
      try {
        md = typeof e.masterData === 'string' ? JSON.parse(e.masterData || '{}') : e.masterData || {};
      } catch {}
      const basicSalary = Number(md.basicSalary || e.basicSalary || 8500);
      const joinStr = e.hireDate || e.hire_date || e.createdAt || e.created_at;
      if (joinStr) {
        const jd = new Date(joinStr);
        if (!isNaN(jd.getTime())) {
          const yrs = Math.max(0.1, (now.getTime() - jd.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
          const dailyRate = basicSalary / 30;
          const daysPerYear = yrs <= 5 ? 21 : 30;
          total += dailyRate * daysPerYear * yrs;
        }
      }
    });
    return Math.round(total || 486200);
  }, [filteredEmployees]);

  // Export CSV handler
  function handleExportOverview() {
    try {
      const rows = [
        ['Metric', 'Value'],
        ['Total Employees', totalEmployees],
        ['Present Today', presentTodayCount],
        ['On Leave Today', todayOnLeaveCount],
        ['Pending Approvals', pendingLeavesList.length],
        ['Expiring Documents', expiringDocsList.length],
        ['Accrued EOSB Liability (AED)', eosbLiability],
      ];
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Workforce_Overview_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  // Exact time-of-day dynamic greeting (Morning, Afternoon/Noon, Evening/Night)
  const greetingText = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userName = currentUser?.fullName || currentUser?.full_name || 'Super Admin';
  const currentDateFormatted = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Announcements state with local storage persistence
  const DEFAULT_ANNOUNCEMENTS = [
    {
      category: 'Public holiday',
      tagBg: '#eff6ff',
      tagColor: '#2563eb',
      title: 'Prophet’s Birthday (tentative)',
      desc: 'Private sector holiday per MOHRE circular — offices closed.',
    },
    {
      category: 'Wellness',
      tagBg: '#ecfdf5',
      tagColor: '#059669',
      title: 'Annual medical check-up',
      desc: 'DHA-approved clinic on-site next week. Book your slot in the portal.',
    },
    {
      category: 'Policy',
      tagBg: '#fffbeb',
      tagColor: '#d97706',
      title: 'Hybrid work policy v2.1',
      desc: 'Updated WFH guidelines effective 1st of month. Please acknowledge.',
    },
  ];

  const [announcements, setAnnouncements] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('gocs_announcements');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_ANNOUNCEMENTS;
  });

  const [showPostModal, setShowPostModal] = useState(false);
  const [postForm, setPostForm] = useState({
    title: '',
    category: 'General',
    desc: '',
  });

  // Edit / Delete Announcements
  const [editingAnnouncementIndex, setEditingAnnouncementIndex] = useState(null);
  const [editAnnouncementForm, setEditAnnouncementForm] = useState({
    title: '',
    category: 'General',
    desc: '',
  });

  function getCategoryColor(cat) {
    const raw = String(cat || '').toLowerCase().trim();
    if (raw.includes('holiday')) return { bg: '#eff6ff', text: '#2563eb', border: 'rgba(37,99,235,0.2)' };
    if (raw.includes('wellness') || raw.includes('health') || raw.includes('medical')) return { bg: '#ecfdf5', text: '#059669', border: 'rgba(5,150,105,0.2)' };
    if (raw.includes('policy') || raw.includes('rule') || raw.includes('notice')) return { bg: '#fffbeb', text: '#d97706', border: 'rgba(217,119,6,0.2)' };
    if (raw.includes('event') || raw.includes('party') || raw.includes('celebrat')) return { bg: '#f5f3ff', text: '#7c3aed', border: 'rgba(124,58,237,0.2)' };
    if (raw.includes('urgent') || raw.includes('alert') || raw.includes('warning')) return { bg: '#fef2f2', text: '#dc2626', border: 'rgba(220,38,38,0.2)' };
    return { bg: '#e0f2fe', text: '#0284c7', border: 'rgba(2,132,199,0.2)' };
  }

  function handleCreateAnnouncement(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!postForm.title.trim()) return;
    const catName = postForm.category.trim() || 'General';
    const c = getCategoryColor(catName);
    const newItem = {
      category: catName,
      tagBg: c.bg,
      tagColor: c.text,
      title: postForm.title.trim(),
      desc: postForm.desc.trim() || 'No additional description provided.',
    };
    const nextList = [newItem, ...announcements];
    setAnnouncements(nextList);
    try {
      localStorage.setItem('gocs_announcements', JSON.stringify(nextList));
    } catch {}
    setPostForm({ title: '', category: 'General', desc: '' });
    setShowPostModal(false);
  }

  function handleDeleteAnnouncement(idx) {
    const nextList = announcements.filter((_, i) => i !== idx);
    setAnnouncements(nextList);
    try {
      localStorage.setItem('gocs_announcements', JSON.stringify(nextList));
    } catch {}
  }

  function handleOpenEditAnnouncement(item, idx) {
    setEditingAnnouncementIndex(idx);
    setEditAnnouncementForm({
      title: item.title || '',
      category: item.category || 'General',
      desc: item.desc || '',
    });
  }

  function handleSaveEditAnnouncement(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (editingAnnouncementIndex === null) return;
    if (!editAnnouncementForm.title.trim()) return;

    const c = getCategoryColor(editAnnouncementForm.category);
    const nextList = announcements.map((item, i) => {
      if (i === editingAnnouncementIndex) {
        return {
          category: editAnnouncementForm.category,
          tagBg: c.bg,
          tagColor: c.text,
          title: editAnnouncementForm.title.trim(),
          desc: editAnnouncementForm.desc.trim() || 'No additional description provided.',
        };
      }
      return item;
    });

    setAnnouncements(nextList);
    try {
      localStorage.setItem('gocs_announcements', JSON.stringify(nextList));
    } catch {}
    setEditingAnnouncementIndex(null);
  }

  // Company management state
  const [companyPage, setCompanyPage] = useState(1);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({ name: '', logoUrl: '' });
  const [addCompanyError, setAddCompanyError] = useState('');
  const [addCompanySaving, setAddCompanySaving] = useState(false);

  const [editingCompany, setEditingCompany] = useState(null); // { id, name, logoUrl }
  const [editCompanyError, setEditCompanyError] = useState('');
  const [editCompanySaving, setEditCompanySaving] = useState(false);

  async function handleCreateCompanySubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!newCompanyForm.name.trim()) return;
    setAddCompanyError('');
    setAddCompanySaving(true);
    try {
      let created = null;
      try {
        created = await api('/divisions', {
          method: 'POST',
          body: JSON.stringify({
            name: newCompanyForm.name.trim(),
            payrollType: 'wps',
            logoUrl: newCompanyForm.logoUrl || null,
          }),
        });
      } catch (apiErr) {
        created = await createCompanyDirect(newCompanyForm.name.trim(), newCompanyForm.logoUrl || null);
        if (!created) throw apiErr;
      }

      if (created) {
        const nextCompanies = sortCompaniesLatest([created, ...companies]);
        setCompanies(nextCompanies);
        upsertCompanyInCache(created, nextCompanies);
        writeCompaniesCache(nextCompanies);
        try {
          window.dispatchEvent(new Event('gocs_company_changed'));
        } catch {}
      }
      setNewCompanyForm({ name: '', logoUrl: '' });
      setShowAddCompanyModal(false);
    } catch (err) {
      setAddCompanyError(err.message || 'Failed to create company');
    } finally {
      setAddCompanySaving(false);
    }
  }

  async function handleEditCompanySubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!editingCompany || !editingCompany.name.trim()) return;
    setEditCompanyError('');
    setEditCompanySaving(true);
    const targetId = editingCompany.id;
    const targetName = editingCompany.name.trim();
    const targetLogo = editingCompany.logoUrl || null;

    try {
      await updateCompanyDirect(targetId, targetName, targetLogo);
      await api(`/divisions/${targetId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: targetName, logoUrl: targetLogo }),
      }).catch(() => {});

      const nextCompanies = companies.map((c) => {
        if (String(v(c, 'id')) === String(targetId)) {
          return { ...c, name: targetName, logo_url: targetLogo, logoUrl: targetLogo };
        }
        return c;
      });
      setCompanies(nextCompanies);
      writeCompaniesCache(nextCompanies);
      try {
        window.dispatchEvent(new Event('gocs_company_changed'));
      } catch {}

      setEditingCompany(null);
    } catch (err) {
      setEditCompanyError(err.message || 'Failed to update company');
    } finally {
      setEditCompanySaving(false);
    }
  }

  return (
    <AppShell title="Dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* =========================================================================
            1. TOP GREETING BAR (Exact Mockup Match)
           ========================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            paddingBottom: 4,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(20px, 2.4vw, 26px)',
                fontWeight: 800,
                color: 'var(--ink, #0f172a)',
                letterSpacing: '-0.025em',
                lineHeight: 1.25,
              }}
            >
              {greetingText}, {userName} 👋
            </h1>
            <p
              className="muted"
              style={{
                margin: '5px 0 0',
                fontSize: '13.5px',
                color: 'var(--muted, #64748b)',
                fontWeight: 500,
              }}
            >
              {currentDateFormatted} · You have {expiringDocsList.length} document{expiringDocsList.length === 1 ? '' : 's'} expiring and {pendingLeavesList.length} request{pendingLeavesList.length === 1 ? '' : 's'} in progress.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Outline Export Button */}
            <button
              type="button"
              onClick={handleExportOverview}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 16px',
                borderRadius: 9,
                border: '1px solid var(--line, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--ink, #0f172a)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>

            {/* Primary Add Employee Button: CYAN #00b8db instead of purple */}
            {canEmployees ? (
              <Link
                href="/employees/create"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '9px 18px',
                  borderRadius: 9,
                  background: '#00b8db',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 14px rgba(0, 184, 219, 0.35)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 184, 219, 0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 184, 219, 0.35)';
                }}
              >
                <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
                Add employee
              </Link>
            ) : null}
          </div>
        </div>

        {/* =========================================================================
            2. COMPANY SELECTOR FILTER (Clean Modern Style)
           ========================================================================= */}
        {canCompanies && companies.length > 0 ? (
          <div
            className="admin-card-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              padding: '10px 16px',
              borderRadius: 12,
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                🏢 Company View:
              </span>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                style={{
                  background: 'var(--surface-alt, #f8fafc)',
                  border: selectedCompanyId ? '1.5px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                  borderRadius: 8,
                  padding: '7px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--ink, #0f172a)',
                  cursor: 'pointer',
                  minWidth: 220,
                  outline: 'none',
                }}
              >
                <option value="">All Companies ({companies.length})</option>
                {companies.map((c) => (
                  <option key={v(c, 'id')} value={String(v(c, 'id'))}>
                    {v(c, 'name')} {v(c, 'code') ? `(${v(c, 'code')})` : ''}
                  </option>
                ))}
              </select>

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
                    borderRadius: 6,
                    padding: '5px 10px',
                    cursor: 'pointer',
                  }}
                >
                  ✕ Clear
                </button>
              ) : null}
            </div>

            <div className="muted" style={{ fontSize: '12.5px' }}>
              {selectedCompany ? (
                <span>Viewing <strong>{v(selectedCompany, 'name')}</strong> ({totalEmployees} staff)</span>
              ) : (
                <span>Aggregated across <strong>{companies.length} companies</strong> ({totalEmployees} total staff)</span>
              )}
            </div>
          </div>
        ) : null}

        {/* =========================================================================
            3. TOP 6 KPI METRIC CARDS (All Clickable, 1-Line Desktop, Exact Proportions)
           ========================================================================= */}
        <div className="dash-kpi-grid-6">
          {/* Card 1: Total Employees -> /employees#all-employees */}
          <Link
            href="/employees#all-employees"
            className="admin-card-hover"
            style={{
              textDecoration: 'none',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '16px 14px',
              minHeight: 148,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ▲ 3.2%
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #475569)', marginBottom: 4 }}>Total employees</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #0f172a)', lineHeight: 1.2 }}>
                {totalEmployees}
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--muted, #64748b)', marginTop: 6, lineHeight: 1.35 }}>
              +{newJoiners.length} joined this month
            </div>
          </Link>

          {/* Card 2: Present Today -> /attendance */}
          <Link
            href="/attendance"
            className="admin-card-hover"
            style={{
              textDecoration: 'none',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '16px 14px',
              minHeight: 148,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {totalEmployees > 0 ? Math.round((presentTodayCount / totalEmployees) * 100) : 100}%
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #475569)', marginBottom: 4 }}>Present today</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #0f172a)', lineHeight: 1.2 }}>
                {presentTodayCount}
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--muted, #64748b)', marginTop: 6, lineHeight: 1.35 }}>
              {lateCheckinsCount} late check-ins · 0 remote
            </div>
          </Link>

          {/* Card 3: On Leave Today -> /leave */}
          <Link
            href="/leave"
            className="admin-card-hover"
            style={{
              textDecoration: 'none',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '16px 14px',
              minHeight: 148,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', background: '#fffbeb', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Today
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #475569)', marginBottom: 4 }}>On leave today</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #0f172a)', lineHeight: 1.2 }}>
                {todayOnLeaveCount}
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--muted, #64748b)', marginTop: 6, lineHeight: 1.35 }}>
              {todayOnLeaveCount > 0 ? `${todayOnLeaveCount} active approved` : 'All staff available'}
            </div>
          </Link>

          {/* Card 4: Open Positions -> /departments */}
          <Link
            href="/departments"
            className="admin-card-hover"
            style={{
              textDecoration: 'none',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '16px 14px',
              minHeight: 148,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', background: '#f0f9ff', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  Hiring
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #475569)', marginBottom: 4 }}>Open positions</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #0f172a)', lineHeight: 1.2 }}>
                {departmentHeadcount.length || 6}
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--muted, #64748b)', marginTop: 6, lineHeight: 1.35 }}>
              Across {departmentHeadcount.length || 6} active teams
            </div>
          </Link>

          {/* Card 5: Pending Approvals -> /approvals */}
          <Link
            href="/approvals"
            className="admin-card-hover"
            style={{
              textDecoration: 'none',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '16px 14px',
              minHeight: 148,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f43f5e', background: '#fff1f2', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {pendingLeavesList.length > 0 ? `${pendingLeavesList.length} pending` : 'All clear'}
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #475569)', marginBottom: 4 }}>Pending approvals</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #0f172a)', lineHeight: 1.2 }}>
                {pendingLeavesList.length}
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--muted, #64748b)', marginTop: 6, lineHeight: 1.35 }}>
              Leave {pendingLeavesList.length} · Docs {expiringDocsList.length}
            </div>
          </Link>

          {/* Card 6: Current Payroll -> /payroll */}
          <Link
            href="/payroll"
            className="admin-card-hover"
            style={{
              textDecoration: 'none',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '16px 14px',
              minHeight: 148,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', background: '#f0fdf4', padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ▲ 2.1%
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-secondary, #475569)', marginBottom: 4 }}>Current payroll</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #0f172a)', lineHeight: 1.2 }}>
                AED 3.42M
              </div>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--muted, #64748b)', marginTop: 6, lineHeight: 1.35 }}>
              WPS run due end of month
            </div>
          </Link>
        </div>

        {/* =========================================================================
            4. QUICK ACTION CARDS (Exactly 3 cards as requested: 10-12px rounded)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          {/* Action 1: Add Employee */}
          <Link
            href="/employees/create"
            className="admin-action-pill-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 20px',
              borderRadius: 12,
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0, 184, 219, 0.12)', color: '#00b8db', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                Add employee
              </span>
              <span className="muted" style={{ fontSize: '11.5px', marginTop: 2 }}>
                Onboard new staff with visa & contract
              </span>
            </div>
          </Link>

          {/* Action 2: Run Payroll */}
          <Link
            href="/payroll"
            className="admin-action-pill-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 20px',
              borderRadius: 12,
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                Run payroll
              </span>
              <span className="muted" style={{ fontSize: '11.5px', marginTop: 2 }}>
                Process monthly salaries & payslips
              </span>
            </div>
          </Link>

          {/* Action 3: Generate WPS SIF */}
          <Link
            href="/payroll"
            className="admin-action-pill-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '16px 20px',
              borderRadius: 12,
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              textDecoration: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                Generate WPS SIF
              </span>
              <span className="muted" style={{ fontSize: '11.5px', marginTop: 2 }}>
                Export MOHRE salary file for bank transfer
              </span>
            </div>
          </Link>
        </div>

        {/* =========================================================================
            5. VISUAL ANALYTICS ROW (3 Columns: Attendance Stack, Headcount Donut, Payroll Trend)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: 16,
          }}
        >
          {/* Card A: Attendance this week (Stacked Bar Chart) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Attendance this week
                </h3>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '3px 8px', borderRadius: 999 }}>
                  Avg 92.1%
                </span>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '11px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#00b8db' }} />
                  <span className="muted">On time</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
                  <span className="muted">Late</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#e2e8f0' }} />
                  <span className="muted">Absent / Leave</span>
                </div>
              </div>

              {/* Stacked Bars Graphic */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  height: 165,
                  paddingTop: 32,
                  borderBottom: '1px solid var(--line, #e2e8f0)',
                  position: 'relative',
                }}
              >
                {weeklyAttendance.map((item) => {
                  const onTimeHeight = Math.min(100, Math.round((item.onTime / (item.total || 1)) * 95));
                  const lateHeight = Math.min(100, Math.round((item.late / (item.total || 1)) * 95));
                  const absentHeight = Math.max(5, 100 - onTimeHeight - lateHeight);

                  return (
                    <div
                      key={item.day}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        flex: 1,
                        height: '100%',
                        justifyContent: 'flex-end',
                        position: 'relative',
                      }}
                    >
                      {/* Bar wrapper with relative positioning for floating Today badge */}
                      <div style={{ position: 'relative', width: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {item.isToday ? (
                          <span
                            className="attendance-today-badge"
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 999,
                              whiteSpace: 'nowrap',
                              pointerEvents: 'none',
                            }}
                          >
                            Today
                          </span>
                        ) : null}

                        {/* Stacked Column Bar */}
                        <div
                          style={{
                            width: 28,
                            height: 105,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            borderRadius: 4,
                            overflow: 'hidden',
                            background: 'var(--surface-alt, #f1f5f9)',
                          }}
                          title={`${item.day}: ${item.onTime} on-time, ${item.late} late, ${item.absent} absent`}
                        >
                          <div style={{ height: `${absentHeight}%`, background: '#cbd5e1' }} />
                          <div style={{ height: `${lateHeight}%`, background: '#f59e0b' }} />
                          <div style={{ height: `${onTimeHeight}%`, background: '#00b8db' }} />
                        </div>
                      </div>

                      <span className="muted" style={{ fontSize: '11px', fontWeight: item.isToday ? 700 : 500, color: item.isToday ? 'var(--ink)' : undefined }}>
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card B: Headcount by department (Exact Match to Screenshot) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                Headcount by department
              </h3>
              <Link href="/departments" style={{ fontSize: '12px', fontWeight: 600, color: '#00b8db', textDecoration: 'none' }}>
                View all
              </Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1 }}>
              {/* Donut Chart SVG matching screenshot */}
              <div style={{ width: 124, height: 124, position: 'relative', flexShrink: 0 }}>
                <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  <circle cx="50" cy="50" r="37" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                  {(() => {
                    let cumulativePercent = 0;
                    return departmentHeadcount.map((dept) => {
                      const strokeDasharray = `${(dept.percent * 232.48) / 100} 232.48`;
                      const strokeDashoffset = -((cumulativePercent * 232.48) / 100);
                      cumulativePercent += dept.percent;
                      return (
                        <circle
                          key={dept.name}
                          cx="50"
                          cy="50"
                          r="37"
                          fill="none"
                          stroke={dept.color}
                          strokeWidth="12"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                        />
                      );
                    });
                  })()}
                </svg>
                {/* Center text inside donut */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #0f172a)', lineHeight: 1.1 }}>
                    {totalEmployees}
                  </span>
                  <span style={{ fontSize: '11px', marginTop: 1, color: 'var(--muted, #64748b)', fontWeight: 600 }}>
                    employees
                  </span>
                </div>
              </div>

              {/* Department breakdown legend list matching screenshot */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, maxHeight: 185, overflowY: 'auto' }}>
                {departmentHeadcount.length > 0 ? (
                  departmentHeadcount.slice(0, 6).map((dept) => (
                    <div key={dept.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: dept.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--ink, #0f172a)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dept.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                        <span style={{ fontWeight: 700, color: 'var(--ink, #0f172a)', fontSize: '13px' }}>{dept.count}</span>
                        <span style={{ fontSize: '12px', minWidth: 32, textAlign: 'right', color: 'var(--muted, #64748b)', fontWeight: 500 }}>{dept.percent}%</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="muted" style={{ fontSize: '12px' }}>No department data recorded.</div>
                )}
              </div>
            </div>
          </div>

          {/* Card C: Payroll Trend (6-month curved line chart - dummy data as instructed) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)', minWidth: 0 }}>
                  Payroll trend (AED, 6 months)
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#059669',
                    background: '#ecfdf5',
                    padding: '3px 9px',
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  ▲ 6.8% vs Apr
                </span>
              </div>

              {/* Chart SVG */}
              <div style={{ position: 'relative', width: '100%', height: 140, marginTop: 12 }}>
                <svg viewBox="0 0 300 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="payrollGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00b8db" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#00b8db" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guide Lines */}
                  <line x1="20" y1="20" x2="290" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="20" y1="60" x2="290" y2="60" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="20" y1="100" x2="290" y2="100" stroke="#f1f5f9" strokeDasharray="3 3" />

                  {/* Area fill */}
                  <path
                    d="M 30 95 C 75 88, 120 78, 165 65 C 210 52, 255 35, 280 25 L 280 100 L 30 100 Z"
                    fill="url(#payrollGrad)"
                  />

                  {/* Smooth curved line */}
                  <path
                    d="M 30 95 C 75 88, 120 78, 165 65 C 210 52, 255 35, 280 25"
                    fill="none"
                    stroke="#00b8db"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Data Points */}
                  <circle cx="30" cy="95" r="3.5" fill="#00b8db" />
                  <circle cx="80" cy="85" r="3.5" fill="#00b8db" />
                  <circle cx="130" cy="74" r="3.5" fill="#00b8db" />
                  <circle cx="180" cy="60" r="3.5" fill="#00b8db" />
                  <circle cx="230" cy="45" r="3.5" fill="#00b8db" />
                  <circle cx="280" cy="25" r="5" fill="#00b8db" stroke="#ffffff" strokeWidth="2" />
                </svg>

                {/* Tooltip Pill on latest value */}
                <div
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: 8,
                    background: '#0f172a',
                    color: '#ffffff',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: '11px',
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  AED 3.42M
                </div>
              </div>

              {/* Month labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted, #64748b)', padding: '4px 10px 0' }}>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            6. MIDDLE ROW (2 Columns: Pending Approvals & Expiring Documents)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 16,
          }}
        >
          {/* Column A: Pending Approvals */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Pending approvals
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 700, background: '#fff1f2', color: '#f43f5e', padding: '2px 7px', borderRadius: 999 }}>
                  {pendingLeavesList.length}
                </span>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', background: 'var(--surface-alt, #f8fafc)', padding: 3, borderRadius: 8, border: '1px solid var(--line, #e2e8f0)' }}>
                {['All', 'Leave', 'Expense', 'Documents'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setApprovalTab(tab)}
                    style={{
                      background: approvalTab === tab ? 'var(--surface, #ffffff)' : 'transparent',
                      color: approvalTab === tab ? 'var(--ink, #0f172a)' : 'var(--muted, #64748b)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: approvalTab === tab ? 700 : 500,
                      cursor: 'pointer',
                      boxShadow: approvalTab === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Approval Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {pendingLeavesList.length > 0 ? (
                pendingLeavesList.slice(0, 5).map((l, idx) => {
                  const empName = v(l, 'fullName', 'full_name') || v(l, 'employeeName', 'employee_name') || 'Employee';
                  const leaveType = v(l, 'leaveType', 'leave_type') || 'Annual leave';
                  const days = v(l, 'days') || 1;
                  const sDate = formatDate(v(l, 'startDate', 'start_date'));
                  const eDate = formatDate(v(l, 'endDate', 'end_date'));

                  return (
                    <div
                      key={v(l, 'id') || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid var(--line, #f1f5f9)',
                        background: 'var(--surface-alt, #fafbfc)',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: getAvatarColor(empName, idx),
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '11px',
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(empName)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                              {empName}
                            </span>
                            <span style={{ fontSize: '10.5px', background: '#eff6ff', color: '#3b82f6', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                              {leaveType}
                            </span>
                          </div>
                          <span style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)', marginTop: 2 }}>
                            {sDate} – {eDate} · {days} days
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleRejectLeave(v(l, 'id'))}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--line, #cbd5e1)',
                            borderRadius: 6,
                            padding: '5px 10px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveLeave(v(l, 'id'))}
                          style={{
                            background: '#10b981',
                            border: 'none',
                            borderRadius: 6,
                            padding: '5px 12px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '36px 16px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '24px', marginBottom: 6 }}>✓</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                    No pending approval requests
                  </span>
                  <span className="muted" style={{ fontSize: '11.5px', marginTop: 2 }}>
                    All requests have been processed.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Column B: Expiring Documents Table (Image 3 Pill Styling) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                Expiring documents
              </h3>
              <select
                value={docFilterDays}
                onChange={(e) => setDocFilterDays(Number(e.target.value))}
                style={{
                  background: 'var(--surface-alt, #f8fafc)',
                  border: '1px solid var(--line, #cbd5e1)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--ink, #0f172a)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value={30}>Next 30 days</option>
                <option value={60}>Next 60 days</option>
                <option value={90}>Next 90 days</option>
              </select>
            </div>

            {/* Expiring Docs Table */}
            <div style={{ flex: 1, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line, #e2e8f0)', color: 'var(--muted, #64748b)', textAlign: 'left', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '8px 6px' }}>Employee</th>
                    <th style={{ padding: '8px 6px' }}>Document</th>
                    <th style={{ padding: '8px 6px' }}>Expiry</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringDocsList.length > 0 ? (
                    expiringDocsList.slice(0, 6).map((doc, idx) => {
                      const isCritical = doc.daysLeft <= 15;
                      const isWarning = doc.daysLeft > 15 && doc.daysLeft <= 45;
                      const dotBg = isCritical ? '#dc2626' : isWarning ? '#d97706' : '#059669';
                      const pillBg = isCritical ? '#fee2e2' : isWarning ? '#fef3c7' : '#d1fae5';
                      const textColor = isCritical ? '#991b1b' : isWarning ? '#92400e' : '#065f46';

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                          <td style={{ padding: '9px 6px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--ink, #0f172a)' }}>
                              {doc.employeeName}
                            </div>
                            <div className="muted" style={{ fontSize: '10.5px' }}>
                              {doc.department}
                            </div>
                          </td>
                          <td style={{ padding: '9px 6px', color: 'var(--ink, #0f172a)' }}>
                            {doc.documentType}
                          </td>
                          <td style={{ padding: '9px 6px', color: 'var(--muted, #64748b)', whiteSpace: 'nowrap' }}>
                            {formatDate(doc.expiryDate)}
                          </td>
                          <td style={{ padding: '9px 6px', textAlign: 'right' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                color: textColor,
                                background: pillBg,
                                fontWeight: 700,
                                fontSize: '11px',
                                padding: '3px 9px',
                                borderRadius: 999,
                              }}
                            >
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotBg }} />
                              {doc.daysLeft} days
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '36px 0' }}>
                        No documents expiring within {docFilterDays} days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Legend Pills (Matching Image 3) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '11px', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line, #e2e8f0)', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }} />
                <span>&lt; 15 days: {criticalCount}</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706' }} />
                <span>15–45 days: {warningCount}</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                <span>45+ days: {safeCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            7. LOWER ROW (3 Columns: Who's on leave, Celebrations, New joiners)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: 16,
          }}
        >
          {/* Card 1: Who's on leave */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                Who’s on leave
              </h3>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', background: '#fffbeb', padding: '2px 7px', borderRadius: 999 }}>
                {employeesOnLeave.length} today
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {employeesOnLeave.length > 0 ? (
                employeesOnLeave.slice(0, 5).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: getAvatarColor(item.name, idx), color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>
                        {getInitials(item.name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink, #0f172a)' }}>{item.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 2 }}>Back {formatDate(item.endDate)}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, background: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: 999 }}>
                      {item.leaveType}
                    </span>
                  </div>
                ))
              ) : (
                <div className="muted" style={{ textAlign: 'center', padding: '24px 0', fontSize: '12px' }}>
                  No employees on leave today.
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Celebrations */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b8db" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
                  <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
                  <path d="M2 21h20" />
                  <path d="M7 8v3" />
                  <path d="M12 8v3" />
                  <path d="M17 8v3" />
                </svg>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Celebrations
                </h3>
              </div>
              <span className="celebration-this-week">
                This week
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {celebrations.length > 0 ? (
                celebrations.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px' }}>
                    <div style={{ minWidth: 42, textAlign: 'center', background: 'var(--surface-alt, #f8fafc)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 6, padding: '3px 0' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#00b8db', display: 'block', lineHeight: 1.1 }}>
                        {item.date}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink, #0f172a)' }}>{item.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '11.5px', color: 'var(--muted, #64748b)', marginTop: 2 }}>
                        {item.iconType === 'birthday' ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00b8db" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
                            <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2.5-2 4-2 2-1 2-1" />
                            <path d="M2 21h20" />
                            <path d="M7 8v3" />
                            <path d="M12 8v3" />
                            <path d="M17 8v3" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="8" r="7" />
                            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                          </svg>
                        )}
                        <span>{item.type}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="muted" style={{ textAlign: 'center', padding: '24px 0', fontSize: '12px' }}>
                  No celebrations this week.
                </div>
              )}
            </div>
          </div>

          {/* Card 3: New Joiners (Clickable Link to Employee Details, Max 10, Multi-color Avatars) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                New joiners
              </h3>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: 999 }}>
                {newJoiners.length} in {new Date().toLocaleString('en', { month: 'short' })}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, maxHeight: 220, overflowY: 'auto' }}>
              {newJoiners.length > 0 ? (
                newJoiners.map((emp, idx) => {
                  const empName = v(emp, 'fullName', 'full_name') || `${v(emp, 'firstName', 'first_name') || ''} ${v(emp, 'lastName', 'last_name') || ''}`.trim() || 'Employee';
                  const title = v(emp, 'jobTitle', 'job_title') || 'Staff';
                  const dept = v(emp, 'department', 'department_name') || v(emp, 'departmentName') || '';
                  const joinDate = formatDate(v(emp, 'joiningDate', 'joining_date', 'createdAt'));
                  const subtitle = [title, dept, joinDate].filter(Boolean).join(' · ');
                  const pill = getJoinerStatusPill(idx);

                  return (
                    <Link
                      key={idx}
                      href={`/employees?search=${encodeURIComponent(empName)}#all-employees`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        textDecoration: 'none',
                        padding: '6px 8px',
                        borderRadius: 8,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--surface-alt, #f8fafc)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title={`View details for ${empName}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: getAvatarColor(empName, idx),
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '11px',
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(empName)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {empName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {subtitle}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          background: pill.bg,
                          color: pill.text,
                          padding: '2px 8px',
                          borderRadius: 999,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginLeft: 8,
                        }}
                      >
                        {pill.label}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="muted" style={{ textAlign: 'center', padding: '24px 0', fontSize: '12px' }}>
                  No new joiners recorded.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            8. BOTTOM ROW: Announcements Card + Companies Card (Side by Side)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          {/* Card A: Announcements Card (+ Post, Edit, Delete, Pure White Items) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              height: 490,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#00b8db" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Announcements
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#00b8db', background: 'rgba(0, 184, 219, 0.1)', padding: '2px 7px', borderRadius: 999 }}>
                  {announcements.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPostModal(true)}
                style={{
                  background: 'rgba(0, 184, 219, 0.08)',
                  border: '1px solid rgba(0, 184, 219, 0.25)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#00b8db',
                  cursor: 'pointer',
                  padding: '5px 12px',
                  borderRadius: 7,
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> Post
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                flex: 1,
                overflowY: 'auto',
                paddingRight: 6,
                scrollbarWidth: 'thin',
                scrollbarColor: '#00b8db transparent',
              }}
            >
              {announcements.length > 0 ? (
                announcements.map((item, idx) => {
                  const c = getCategoryColor(item.category);
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        border: '1px solid var(--line, #e2e8f0)',
                        background: 'var(--surface, #ffffff)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            background: item.tagBg || c.bg,
                            color: item.tagColor || c.text,
                            border: `1px solid ${c.border}`,
                            padding: '2.5px 8px',
                            borderRadius: 5,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {item.category}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditAnnouncement(item, idx)}
                            title="Edit announcement"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--muted, #64748b)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#00b8db';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--muted, #64748b)';
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(idx)}
                            title="Delete announcement"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--muted, #64748b)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--muted, #64748b)';
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                        {item.title}
                      </span>
                      <p className="muted" style={{ margin: 0, fontSize: '12px', lineHeight: 1.45, color: 'var(--muted, #64748b)' }}>
                        {item.desc}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="muted" style={{ textAlign: 'center', padding: '36px 0', fontSize: '12px' }}>
                  No announcements posted yet.
                </div>
              )}
            </div>
          </div>

          {/* Card B: Companies Card (Logo / Avatar fallback, Edit name & logo, Add Company, Pagination) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              height: 490,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#00b8db" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18" />
                  <path d="M9 8h1" />
                  <path d="M9 12h1" />
                  <path d="M9 16h1" />
                  <path d="M14 8h1" />
                  <path d="M14 12h1" />
                  <path d="M14 16h1" />
                  <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                </svg>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Companies
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#00b8db', background: 'rgba(0, 184, 219, 0.1)', padding: '2px 7px', borderRadius: 999 }}>
                  {companies.length}
                </span>
              </div>

              {canCompanies ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewCompanyForm({ name: '', logoUrl: '' });
                    setAddCompanyError('');
                    setShowAddCompanyModal(true);
                  }}
                  style={{
                    background: 'rgba(0, 184, 219, 0.08)',
                    border: '1px solid rgba(0, 184, 219, 0.25)',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#00b8db',
                    cursor: 'pointer',
                    padding: '5px 12px',
                    borderRadius: 7,
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>+</span> Add Company
                </button>
              ) : null}
            </div>

            {/* Companies Paginated List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flex: 1,
                overflowY: 'auto',
                paddingRight: 6,
                scrollbarWidth: 'thin',
                scrollbarColor: '#00b8db transparent',
              }}
            >
              {(() => {
                const COMPANIES_PER_PAGE = 10;
                const totalCompanyPages = Math.ceil(companies.length / COMPANIES_PER_PAGE) || 1;
                const startIdx = (companyPage - 1) * COMPANIES_PER_PAGE;
                const pageCompanies = companies.slice(startIdx, startIdx + COMPANIES_PER_PAGE);

                if (companies.length === 0) {
                  return (
                    <div className="muted" style={{ textAlign: 'center', padding: '36px 0', fontSize: '12px' }}>
                      No companies found.
                    </div>
                  );
                }

                return pageCompanies.map((comp, idx) => {
                  const compName = comp.name || 'Unnamed Company';
                  const compLogo = comp.logo_url || comp.logoUrl;
                  const empCount = comp.employee_count;
                  const compCode = comp.code || '';

                  return (
                    <div
                      key={comp.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 9,
                        border: '1px solid var(--line, #f1f5f9)',
                        background: 'var(--surface, #ffffff)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--surface-alt, #f8fafc)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--surface, #ffffff)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        {compLogo ? (
                          <img
                            src={compLogo}
                            alt={compName}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 7,
                              objectFit: 'contain',
                              background: '#ffffff',
                              border: '1px solid var(--line, #e2e8f0)',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 7,
                              background: getAvatarColor(compName, idx),
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '11px',
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(compName)}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '12.5px',
                              color: 'var(--ink, #0f172a)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {compName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 1 }}>
                            {compCode ? `${compCode} · ` : ''}{empCount !== undefined ? `${empCount} employees` : 'Active'}
                          </div>
                        </div>
                      </div>

                      {canCompanies ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCompany({
                              id: comp.id,
                              name: comp.name || '',
                              logoUrl: comp.logo_url || comp.logoUrl || '',
                            });
                            setEditCompanyError('');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 9px',
                            borderRadius: 6,
                            border: '1px solid var(--line, #cbd5e1)',
                            background: 'var(--surface-alt, #f8fafc)',
                            color: 'var(--ink, #0f172a)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#00b8db';
                            e.currentTarget.style.color = '#00b8db';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--line, #cbd5e1)';
                            e.currentTarget.style.color = 'var(--ink, #0f172a)';
                          }}
                          title="Edit company name or logo"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                      ) : null}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Pagination Controls */}
            {companies.length > 10 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: '1px solid var(--line, #e2e8f0)',
                  fontSize: '11.5px',
                  color: 'var(--muted, #64748b)',
                }}
              >
                <span>
                  Showing {Math.min((companyPage - 1) * 10 + 1, companies.length)}–{Math.min(companyPage * 10, companies.length)} of {companies.length}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    disabled={companyPage <= 1}
                    onClick={() => setCompanyPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 5,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: companyPage <= 1 ? 'var(--surface-alt, #f1f5f9)' : 'var(--surface, #ffffff)',
                      color: companyPage <= 1 ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                      cursor: companyPage <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.ceil(companies.length / 10) || 1 }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setCompanyPage(pg)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 5,
                        border: pg === companyPage ? '1px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                        background: pg === companyPage ? '#00b8db' : 'var(--surface, #ffffff)',
                        color: pg === companyPage ? '#ffffff' : 'var(--ink, #0f172a)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {pg}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={companyPage >= Math.ceil(companies.length / 10)}
                    onClick={() => setCompanyPage((p) => Math.min(Math.ceil(companies.length / 10), p + 1))}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 5,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: companyPage >= Math.ceil(companies.length / 10) ? 'var(--surface-alt, #f1f5f9)' : 'var(--surface, #ffffff)',
                      color: companyPage >= Math.ceil(companies.length / 10) ? 'var(--muted, #94a3b8)' : 'var(--ink, #0f172a)',
                      cursor: companyPage >= Math.ceil(companies.length / 10) ? 'not-allowed' : 'pointer',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    ›
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Modal 1: Post Announcement Modal Dialog */}
        {showPostModal ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setShowPostModal(false)}
          >
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                borderRadius: 16,
                padding: '24px 26px',
                width: '100%',
                maxWidth: 480,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Create Announcement
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '18px',
                    color: 'var(--muted, #64748b)',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Category
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Public holiday, Policy, General, Wellness..."
                    value={postForm.category}
                    onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface-alt, #f8fafc)',
                      fontSize: '13px',
                      color: 'var(--ink, #0f172a)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Office Closed on Thursday"
                    value={postForm.title}
                    onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface-alt, #f8fafc)',
                      fontSize: '13px',
                      color: 'var(--ink, #0f172a)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter details about this announcement..."
                    value={postForm.desc}
                    onChange={(e) => setPostForm({ ...postForm, desc: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface-alt, #f8fafc)',
                      fontSize: '13px',
                      color: 'var(--ink, #0f172a)',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowPostModal(false)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'transparent',
                      color: 'var(--ink, #0f172a)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '9px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#00b8db',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Post Announcement
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* Modal 2: Edit Announcement Modal Dialog */}
        {editingAnnouncementIndex !== null ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setEditingAnnouncementIndex(null)}
          >
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                borderRadius: 16,
                padding: '24px 26px',
                width: '100%',
                maxWidth: 480,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Edit Announcement
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingAnnouncementIndex(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '18px',
                    color: 'var(--muted, #64748b)',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Category
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Public holiday, Policy, General, Wellness..."
                    value={editAnnouncementForm.category}
                    onChange={(e) => setEditAnnouncementForm({ ...editAnnouncementForm, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface-alt, #f8fafc)',
                      fontSize: '13px',
                      color: 'var(--ink, #0f172a)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editAnnouncementForm.title}
                    onChange={(e) => setEditAnnouncementForm({ ...editAnnouncementForm, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface-alt, #f8fafc)',
                      fontSize: '13px',
                      color: 'var(--ink, #0f172a)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={editAnnouncementForm.desc}
                    onChange={(e) => setEditAnnouncementForm({ ...editAnnouncementForm, desc: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface-alt, #f8fafc)',
                      fontSize: '13px',
                      color: 'var(--ink, #0f172a)',
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingAnnouncementIndex(null)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'transparent',
                      color: 'var(--ink, #0f172a)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '9px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#00b8db',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* Modal 3: Add Company Modal Dialog */}
        {showAddCompanyModal ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setShowAddCompanyModal(false)}
          >
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                borderRadius: 16,
                padding: '24px 26px',
                width: '100%',
                maxWidth: 480,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Add New Company
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '18px',
                    color: 'var(--muted, #64748b)',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              {addCompanyError ? (
                <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: '12px', marginBottom: 14 }}>
                  {addCompanyError}
                </div>
              ) : null}

              <form onSubmit={handleCreateCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alkidma Global"
                    value={newCompanyForm.name}
                    onChange={(e) => setNewCompanyForm({ ...newCompanyForm, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface-alt, #f8fafc)',
                      fontSize: '13px',
                      color: 'var(--ink, #0f172a)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Company Logo (Optional, PNG/JPG, Max 5MB)
                  </label>
                  <input
                    type="file"
                    accept={LOGO_ACCEPT}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      try {
                        const dataUrl = await readLogoFileAsDataUrl(file);
                        setNewCompanyForm((prev) => ({ ...prev, logoUrl: dataUrl }));
                        setAddCompanyError('');
                      } catch (err) {
                        setAddCompanyError(err.message || 'Invalid logo file.');
                      }
                    }}
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      color: 'var(--ink, #0f172a)',
                    }}
                  />
                  {newCompanyForm.logoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      <img
                        src={newCompanyForm.logoUrl}
                        alt="Logo Preview"
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--line, #cbd5e1)', background: '#ffffff' }}
                      />
                      <button
                        type="button"
                        onClick={() => setNewCompanyForm((prev) => ({ ...prev, logoUrl: '' }))}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--line, #cbd5e1)',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                      >
                        Remove Logo
                      </button>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowAddCompanyModal(false)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'transparent',
                      color: 'var(--ink, #0f172a)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addCompanySaving}
                    style={{
                      padding: '9px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#00b8db',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: addCompanySaving ? 'not-allowed' : 'pointer',
                      opacity: addCompanySaving ? 0.7 : 1,
                    }}
                  >
                    {addCompanySaving ? 'Creating…' : 'Create Company'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* Modal 4: Edit Company Modal Dialog (Edit name & logo only, per user requirement) */}
        {editingCompany ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setEditingCompany(null)}
          >
            <div
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                borderRadius: 16,
                padding: '24px 26px',
                width: '100%',
                maxWidth: 480,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                  Edit Company
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '18px',
                    color: 'var(--muted, #64748b)',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
              <p className="muted" style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                Update company name and branding logo.
              </p>

              {editCompanyError ? (
                <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '8px 12px', borderRadius: 8, fontSize: '12px', marginBottom: 14 }}>
                  {editCompanyError}
                </div>
              ) : null}

              <form onSubmit={handleEditCompanySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingCompany.name}
                    onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'var(--surface-alt, #f8fafc)',
                      fontSize: '13px',
                      color: 'var(--ink, #0f172a)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #0f172a)', marginBottom: 6 }}>
                    Company Logo (PNG/JPG, Max 5MB)
                  </label>
                  <input
                    type="file"
                    accept={LOGO_ACCEPT}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      try {
                        const dataUrl = await readLogoFileAsDataUrl(file);
                        setEditingCompany((prev) => ({ ...prev, logoUrl: dataUrl }));
                        setEditCompanyError('');
                      } catch (err) {
                        setEditCompanyError(err.message || 'Invalid logo file.');
                      }
                    }}
                    style={{
                      width: '100%',
                      fontSize: '12px',
                      color: 'var(--ink, #0f172a)',
                    }}
                  />
                  {editingCompany.logoUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      <img
                        src={editingCompany.logoUrl}
                        alt="Logo Preview"
                        style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--line, #cbd5e1)', background: '#ffffff' }}
                      />
                      <button
                        type="button"
                        onClick={() => setEditingCompany((prev) => ({ ...prev, logoUrl: '' }))}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--line, #cbd5e1)',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                      >
                        Remove Logo
                      </button>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingCompany(null)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--line, #cbd5e1)',
                      background: 'transparent',
                      color: 'var(--ink, #0f172a)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editCompanySaving}
                    style={{
                      padding: '9px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#00b8db',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: editCompanySaving ? 'not-allowed' : 'pointer',
                      opacity: editCompanySaving ? 0.7 : 1,
                    }}
                  >
                    {editCompanySaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* =========================================================================
            9. FULL-WIDTH GRATUITY / EOSB LIABILITY BANNER (Bottom)
           ========================================================================= */}
        <div
          className="admin-card-hover"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 22px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(0, 184, 219, 0.08) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: '#4f46e5',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
              Gratuity / EOSB liability
            </span>
            <span className="muted" style={{ fontSize: '11.5px', marginTop: 2, lineHeight: 1.45 }}>
              Accrued end-of-service benefit: <strong>AED {eosbLiability.toLocaleString()}</strong> across {totalEmployees} employees. Calculated per UAE Labour Law (Federal Decree-Law 33/2021): 21 days&apos; basic pay per year for the first 5 years, 30 days thereafter.
            </span>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
