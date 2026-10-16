'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell, { Badge } from '../../components/AppShell';
import { api, getUser, getPermissions, normalizeRole } from '../../lib/auth';
import { canUseAnyPermission } from '../../lib/nav';
import { formatDate, todayISO, v } from '../../lib/format';
import { UAE_HOLIDAYS_2026 } from '../../lib/holidays';
import { useCompanyFilter, buildLocalEmpIds } from '../../lib/useCompanyFilter';
import { getInstantEmployees, loadEmployeesFast } from '../../lib/employeeCache';
import { fetchLeavesDirect, fetchLeaveBalancesDirect, updateLeaveStatusDirect } from '../../lib/dbDirect';

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
  const permissions = getPermissions(user);
  const canApprove = canUseAnyPermission(role, permissions, ['leave.view', 'approvals.view']);
  const { selectedCompanyId, filteredEmpIds } = useCompanyFilter();

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
    const instant = getInstantEmployees();
    return instant.filter((e) => !String(v(e, 'fullName', 'full_name')).toLowerCase().includes('ayan'));
  });

  // Build filteredEmpIds from locally-loaded employees (more reliable than cache-based hook)
  const localFilteredEmpIds = useMemo(
    () => buildLocalEmpIds(employees, selectedCompanyId),
    [employees, selectedCompanyId]
  );

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

  const [empSwitcherOpen, setEmpSwitcherOpen] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedBalanceEmpId, setSelectedBalanceEmpId] = useState('');

  // Interactive Calendar State
  const [departments, setDepartments] = useState([]);
  const [calDate, setCalDate] = useState(() => new Date(2026, 9, 1)); // October 2026 default
  const [calViewMode, setCalViewMode] = useState('month'); // 'month' | 'week'
  const [calDeptFilter, setCalDeptFilter] = useState('');
  const [showHolidaysTable, setShowHolidaysTable] = useState(false);

  function toDateStr(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function handleCalPrev() {
    if (calViewMode === 'month') {
      setCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else {
      setCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    }
  }

  function handleCalNext() {
    if (calViewMode === 'month') {
      setCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else {
      setCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    }
  }

  function handleCalToday() {
    setCalDate(new Date(2026, 9, 16));
  }

  // Group unique employees for Master-Detail Leave Balances

  const balanceEmployees = useMemo(() => {
    const map = new Map();
    (employees || []).forEach((emp) => {
      const id = String(v(emp, 'id'));
      if (!id || id === 'undefined') return;
      map.set(id, {
        id,
        name: v(emp, 'fullName', 'full_name') || 'Employee',
        code: v(emp, 'empCode', 'emp_code') || 'DD-1000',
        dept: v(emp, 'departmentName', 'department_name') || 'General',
        jobTitle: v(emp, 'jobTitle', 'job_title') || 'Staff',
      });
    });

    (balances || []).forEach((b) => {
      const id = String(v(b, 'employeeId', 'employee_id'));
      if (id && !map.has(id)) {
        map.set(id, {
          id,
          name: v(b, 'fullName', 'full_name') || 'Employee',
          code: v(b, 'empCode', 'emp_code') || 'DD-1000',
          dept: 'General',
          jobTitle: 'Staff',
        });
      }
    });

    const all = Array.from(map.values());
    return localFilteredEmpIds ? all.filter((e) => localFilteredEmpIds.has(String(e.id))) : all;
  }, [employees, balances, localFilteredEmpIds]);

  const activeBalanceEmpId = selectedBalanceEmpId || (balanceEmployees[0]?.id ? String(balanceEmployees[0].id) : '');

  const selectedEmpBalances = useMemo(() => {
    if (!activeBalanceEmpId) return [];
    return balances.filter((b) => String(v(b, 'employeeId', 'employee_id')) === String(activeBalanceEmpId));
  }, [balances, activeBalanceEmpId]);

  const activeBalanceEmp = useMemo(() => {
    return balanceEmployees.find((e) => String(e.id) === String(activeBalanceEmpId)) || null;
  }, [balanceEmployees, activeBalanceEmpId]);

  // Selected leave detailed employee data (defined before currentEmpName/currentEmpCode to avoid TDZ reference errors)
  const leaveEmp = useMemo(() => {
    if (!selectedLeave) return null;
    const empId = v(selectedLeave, 'employeeId', 'employee_id');
    return (employees || []).find((e) => String(v(e, 'id') || e.id || '') === String(empId)) || null;
  }, [selectedLeave, employees]);

  const currentEmpName = selectedLeave
    ? (v(selectedLeave, 'fullName', 'full_name') || (leaveEmp ? v(leaveEmp, 'fullName', 'full_name') : '') || 'Select Employee')
    : (employees[0] ? v(employees[0], 'fullName', 'full_name') : 'Select Employee');

  const currentEmpCode = selectedLeave
    ? (v(selectedLeave, 'empCode', 'emp_code') || (leaveEmp ? (v(leaveEmp, 'empCode', 'emp_code') || v(leaveEmp, 'jobTitle', 'job_title')) : ''))
    : (employees[0] ? (v(employees[0], 'empCode', 'emp_code') || v(employees[0], 'jobTitle', 'job_title') || '') : '');

  const currentEmpId = selectedLeave
    ? v(selectedLeave, 'employeeId', 'employee_id')
    : (employees[0] ? v(employees[0], 'id') : '');

  function handleSelectEmployee(emp) {
    if (!emp) return;
    const empId = String(v(emp, 'id') || emp.id || '');
    setSelectedBalanceEmpId(empId);

    const empLeaves = rows.filter((r) => String(v(r, 'employeeId', 'employee_id')) === empId);
    if (empLeaves.length > 0) {
      const pending = empLeaves.find((r) => String(v(r, 'status')).toLowerCase() === 'pending');
      setSelectedLeave(pending || empLeaves[0]);
    } else {
      const foundEmp = (employees || []).find((e) => String(v(e, 'id') || e.id || '') === empId);
      setSelectedLeave({
        id: `preview-${empId}`,
        employeeId: empId,
        fullName: emp.name || v(emp, 'fullName', 'full_name') || (foundEmp ? v(foundEmp, 'fullName', 'full_name') : 'Employee'),
        empCode: emp.code || v(emp, 'empCode', 'emp_code') || (foundEmp ? v(foundEmp, 'empCode', 'emp_code') : ''),
        departmentName: emp.dept || (foundEmp ? v(foundEmp, 'departmentName', 'department_name') : 'General Operations'),
        leaveType: 'Annual',
        days: 0,
        startDate: todayISO(),
        endDate: todayISO(),
        reason: 'No leave requests submitted yet',
        status: 'No Leave',
        isSynthetic: true,
      });
    }
  }

  useEffect(() => {
    const u = getUser();
    if (u) setUser(u);
  }, []);

  const load = useCallback(async () => {
    try {
      // Instant & fast direct DB fetch (<150ms)
      fetchLeavesDirect()
        .then((directLeaves) => {
          if (Array.isArray(directLeaves) && directLeaves.length > 0) {
            setRows(directLeaves);
            try {
              localStorage.setItem('gocs_cached_leaves', JSON.stringify(directLeaves));
            } catch {}
            setSelectedLeave((prev) => {
              if (prev) {
                const fresh = directLeaves.find((r) => String(v(r, 'id')) === String(v(prev, 'id')));
                if (fresh) return fresh;
              }
              const pending = directLeaves.find((r) => String(v(r, 'status')).toLowerCase() === 'pending');
              return pending || directLeaves[0] || null;
            });
          }
        })
        .catch(() => {});

      fetchLeaveBalancesDirect()
        .then((directBalances) => {
          if (Array.isArray(directBalances) && directBalances.length > 0) {
            setBalances(directBalances);
            try {
              localStorage.setItem('gocs_cached_leave_balances', JSON.stringify(directBalances));
            } catch {}
          }
        })
        .catch(() => {});

      // Concurrently fetch with resilient fallback
      const [leaveRes, balRes, empsRes, apprRes, deptsRes] = await Promise.allSettled([
        api('/leave'),
        api('/leave/balances'),
        api('/employees'),
        api('/approvals'),
        api('/departments'),
      ]);

      const list = leaveRes.status === 'fulfilled' && Array.isArray(leaveRes.value) ? leaveRes.value : [];
      const bal = balRes.status === 'fulfilled' && Array.isArray(balRes.value) ? balRes.value : [];
      const emps = empsRes.status === 'fulfilled' && Array.isArray(empsRes.value) ? empsRes.value : [];
      const appr = apprRes.status === 'fulfilled' && Array.isArray(apprRes.value) ? apprRes.value : [];
      const depts = deptsRes.status === 'fulfilled' && Array.isArray(deptsRes.value) ? deptsRes.value : [];

      if (depts.length > 0) {
        setDepartments(depts);
      }


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

      if (Array.isArray(emps) && emps.length > 0) {
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

    // Instant optimistic UI update so user immediately sees 'approved' / 'rejected'
    setRows((prev) =>
      prev.map((r) =>
        String(v(r, 'id')) === String(leaveId)
          ? { ...r, status, workflowStage: status, workflow_stage: status }
          : r
      )
    );
    setSelectedLeave((prev) =>
      prev && String(v(prev, 'id')) === String(leaveId)
        ? { ...prev, status, workflowStage: status, workflow_stage: status }
        : prev
    );

    try {
      // 1. Direct DB update in Neon Postgres
      await updateLeaveStatusDirect(leaveId, status);
    } catch {}

    try {
      // 2. Update via IIS API in parallel
      await api(`/leave/${leaveId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
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
        }
      } catch {}
    }

    setMsg(status === 'approved' ? 'Leave request approved successfully.' : 'Leave request rejected.');
    
    // 3. Broadcast real-time sync to Dashboard and other tabs
    try {
      window.dispatchEvent(new Event('gocs_leaves_updated'));
    } catch {}

    load();
  }

  function workflowLabel(row) {
    const stage = v(row, 'workflowStage', 'workflow_stage');
    if (stage === 'pending_manager') return 'Pending manager';
    if (stage === 'pending_hr') return 'Pending HR';
    return v(row, 'status');
  }

  function canHrAct(row) {
    if (!row || row.isSynthetic) return false;
    return String(v(row, 'status') || '').toLowerCase() === 'pending';
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
    const seenIds = new Set();
    return rows.filter((r) => {
      const rid = String(v(r, 'id') || '');
      if (rid) {
        if (seenIds.has(rid)) return false;
        seenIds.add(rid);
      }
      const t = String(v(r, 'leaveType', 'leave_type') || '').toLowerCase();
      const s = String(v(r, 'status') || '').toLowerCase();
      const name = String(v(r, 'fullName', 'full_name') || '').toLowerCase();
      const code = String(v(r, 'empCode', 'emp_code') || '').toLowerCase();
      const q = searchFilter.toLowerCase();

      const matchType = !typeFilter || t === typeFilter.toLowerCase();
      const matchStatus = !statusFilter || s === statusFilter.toLowerCase();
      const matchSearch = !q || name.includes(q) || code.includes(q);
      const matchCompany = !localFilteredEmpIds || localFilteredEmpIds.has(String(v(r, 'employeeId', 'employee_id') || ''));
      return matchType && matchStatus && matchSearch && matchCompany;
    });
  }, [rows, typeFilter, statusFilter, searchFilter, localFilteredEmpIds]);



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
    const managerName = v(leaveEmp, 'managerName', 'manager_name') || 'Direct Manager';

    if (overallStatus === 'no leave' || selectedLeave?.isSynthetic) {
      return [
        { num: 1, title: '1. Reporting Manager', name: managerName, status: 'waiting' },
        { num: 2, title: '2. General Manager', name: 'Operations General Manager', status: 'waiting' },
        { num: 3, title: '3. HR', name: 'Sara (HR Administration)', status: 'waiting' },
      ];
    }

    const l1 = leaveApprovals.find((a) => Number(v(a, 'levelNo', 'level_no')) === 1);
    const l2 = leaveApprovals.find((a) => Number(v(a, 'levelNo', 'level_no')) === 2);

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

  // Enriched approved leaves for calendar with department & employee data
  const enrichedApprovedLeaves = useMemo(() => {
    return rows
      .filter((r) => String(v(r, 'status')).toLowerCase() === 'approved')
      .map((r) => {
        const empId = String(v(r, 'employeeId', 'employee_id') || '');
        const emp = (employees || []).find((e) => String(v(e, 'id') || e.id || '') === empId);
        const deptName =
          v(r, 'departmentName', 'department_name') ||
          (emp ? v(emp, 'departmentName', 'department_name') : '') ||
          'IT';
        const deptId =
          v(r, 'departmentId', 'department_id') ||
          (emp ? v(emp, 'departmentId', 'department_id') : '');
        const divId =
          v(r, 'divisionId', 'division_id') ||
          (emp ? v(emp, 'divisionId', 'division_id') : '');
        const empName = v(r, 'fullName', 'full_name') || (emp ? v(emp, 'fullName', 'full_name') : 'Employee');
        const empCode = v(r, 'empCode', 'emp_code') || (emp ? v(emp, 'empCode', 'emp_code') : '');
        const leaveType = v(r, 'leaveType', 'leave_type') || 'Annual';
        const startDate = String(v(r, 'startDate', 'start_date') || '').slice(0, 10);
        const endDate = String(v(r, 'endDate', 'end_date') || '').slice(0, 10);
        return {
          ...r,
          empId,
          empName,
          empCode,
          deptName,
          deptId: String(deptId),
          divId: String(divId),
          leaveType,
          startDate,
          endDate,
        };
      })
      .filter((r) => {
        if (localFilteredEmpIds && !localFilteredEmpIds.has(r.empId)) return false;
        if (calDeptFilter && String(r.deptId) !== String(calDeptFilter) && r.deptName.toLowerCase() !== calDeptFilter.toLowerCase()) return false;
        return true;
      });
  }, [rows, employees, localFilteredEmpIds, calDeptFilter]);

  // Calendar Days Calculation (Month or Week grid)
  const calendarDays = useMemo(() => {
    const days = [];
    const y = calDate.getFullYear();
    const m = calDate.getMonth();

    if (calViewMode === 'month') {
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);
      const startDayOfWeek = firstDay.getDay(); // 0 is Sunday
      const totalDays = lastDay.getDate();

      const prevMonthLastDay = new Date(y, m, 0).getDate();
      for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const d = new Date(y, m - 1, prevMonthLastDay - i);
        days.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: false });
      }

      for (let day = 1; day <= totalDays; day++) {
        const d = new Date(y, m, day);
        days.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: true });
      }

      const remaining = (7 - (days.length % 7)) % 7;
      for (let day = 1; day <= remaining; day++) {
        const d = new Date(y, m + 1, day);
        days.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: false });
      }
    } else {
      const currentDayOfWeek = calDate.getDay();
      const startOfWeek = new Date(y, m, calDate.getDate() - currentDayOfWeek);
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
        days.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: d.getMonth() === m });
      }
    }

    const todayStr = '2026-10-16';

    return days.map((dayItem) => {
      const dStr = dayItem.dateStr;
      const isToday = dStr === todayStr;
      const dayLeaves = enrichedApprovedLeaves.filter((l) => l.startDate <= dStr && l.endDate >= dStr);

      // Group leaves by department to detect absence overlap
      const deptMap = {};
      dayLeaves.forEach((l) => {
        const dName = l.deptName || 'IT';
        if (!deptMap[dName]) deptMap[dName] = [];
        deptMap[dName].push(l);
      });

      const conflicts = [];
      Object.entries(deptMap).forEach(([deptName, leaves]) => {
        if (leaves.length >= 2) {
          conflicts.push({
            deptName,
            count: leaves.length,
            employees: leaves.map((l) => l.empName),
          });
        }
      });

      const holiday = UAE_HOLIDAYS_2026.find((h) => h.date === dStr) || null;

      return {
        ...dayItem,
        isToday,
        leaves: dayLeaves,
        conflicts,
        hasConflict: conflicts.length > 0,
        holiday,
      };
    });
  }, [calDate, calViewMode, enrichedApprovedLeaves]);

  // All overlapping conflicts in current view for warning summary
  const allPeriodConflicts = useMemo(() => {
    const map = new Map();
    calendarDays.forEach((d) => {
      if (d.hasConflict) {
        d.conflicts.forEach((c) => {
          const key = `${d.dateStr}_${c.deptName}`;
          if (!map.has(key)) {
            map.set(key, {
              dateStr: d.dateStr,
              deptName: c.deptName,
              count: c.count,
              employees: c.employees,
            });
          }
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [calendarDays]);

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

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Employee Switcher Pill Button (Name, Code/Title, Dropdown Arrow - No Avatar) */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setEmpSwitcherOpen(!empSwitcherOpen)}
                  style={{
                    height: '42px',
                    boxSizing: 'border-box',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: '1px solid var(--line-strong, #cbd5e1)',
                    background: 'var(--surface, #ffffff)',
                    color: 'var(--ink, #0f172a)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                  title="Switch employee to view leave summary"
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, lineHeight: 1.2 }}>
                      {currentEmpName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                      {currentEmpCode}
                    </div>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      color: 'var(--muted, #64748b)',
                      transition: 'transform 0.15s ease',
                      transform: empSwitcherOpen ? 'rotate(180deg)' : 'none',
                      marginLeft: 2,
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {empSwitcherOpen ? (
                  <>
                    <div
                      onClick={() => setEmpSwitcherOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        zIndex: 95,
                        width: 260,
                        background: 'var(--surface, #ffffff)',
                        border: '1px solid var(--line, #cbd5e1)',
                        borderRadius: 10,
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                        padding: '6px 0',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ padding: '6px 12px 10px', borderBottom: '1px solid var(--line, #e2e8f0)' }}>
                        <input
                          type="text"
                          placeholder="Search employee..."
                          value={empSearch}
                          onChange={(e) => setEmpSearch(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            fontSize: '12.5px',
                            borderRadius: '6px',
                            border: '1px solid var(--line, #cbd5e1)',
                            background: 'var(--input-bg, #ffffff)',
                            color: 'var(--ink, #0f172a)',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {employees
                          .filter((emp) => {
                            if (!empSearch.trim()) return true;
                            const q = empSearch.toLowerCase();
                            return (
                              String(v(emp, 'fullName', 'full_name') || '').toLowerCase().includes(q) ||
                              String(v(emp, 'empCode', 'emp_code') || '').toLowerCase().includes(q) ||
                              String(v(emp, 'jobTitle', 'job_title') || '').toLowerCase().includes(q)
                            );
                          })
                          .map((emp) => {
                            const empId = String(v(emp, 'id'));
                            const isCur = String(currentEmpId) === empId;
                            return (
                              <button
                                key={empId}
                                type="button"
                                onClick={() => {
                                  handleSelectEmployee(emp);
                                  setEmpSwitcherOpen(false);
                                  setEmpSearch('');
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 14px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'flex-start',
                                  border: 'none',
                                  background: isCur ? 'rgba(0, 184, 219, 0.12)' : 'transparent',
                                  color: 'var(--ink, #0f172a)',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isCur) e.currentTarget.style.background = 'var(--surface-alt, #f8fafc)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isCur) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <div style={{ fontSize: '13px', fontWeight: isCur ? 700 : 600 }}>
                                  {v(emp, 'fullName', 'full_name')}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)' }}>
                                  {v(emp, 'empCode', 'emp_code')} {v(emp, 'jobTitle', 'job_title') ? `• ${v(emp, 'jobTitle', 'job_title')}` : ''}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {canApprove ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowApplyForm((prev) => !prev)}
                  style={{
                    height: '42px',
                    boxSizing: 'border-box',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: showApplyForm ? 'var(--surface-alt, #f1f5f9)' : '#00b8db',
                    color: showApplyForm ? 'var(--ink)' : '#ffffff',
                    fontWeight: 600,
                    fontSize: '13px',
                    borderRadius: 8,
                    padding: '0 18px',
                    border: showApplyForm ? '1px solid var(--line-strong, #cbd5e1)' : 'none',
                    cursor: 'pointer',
                    boxShadow: showApplyForm ? 'none' : '0 2px 6px rgba(0, 184, 219, 0.25)',
                    transition: 'all 0.15s ease',
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
                    ) : String(v(selectedLeave, 'status')).toLowerCase() === 'no leave' ? (
                      <span
                        style={{
                          background: 'var(--surface-alt, #f1f5f9)',
                          color: 'var(--muted, #64748b)',
                          fontWeight: 600,
                          fontSize: '12px',
                          padding: '4px 14px',
                          borderRadius: 9999,
                        }}
                      >
                        No Leave Requests
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
                        ✓ Approve
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
                    {employees.filter(e => !localFilteredEmpIds || localFilteredEmpIds.has(String(v(e, 'id')))).map((e) => (
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
                          <span style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 500, color: '#008fa8' }}>
                            View Details →
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!filteredLeaves.length ? (
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
            4. LEAVE BALANCES (2-Column Master-Detail Layout)
           ========================================================================= */}
        <div className="card" style={{ padding: '20px', borderRadius: 14 }}>
          <div className="panel-title" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Leave Balances</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                Annual entitlement, consumed days, and remaining quotas per employee
              </p>
            </div>
            {activeBalanceEmp ? (
              <div
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
                Viewing: {activeBalanceEmp.name} ({activeBalanceEmp.code})
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 280px) 1fr',
              gap: 18,
              alignItems: 'start',
            }}
          >
            {/* Left Column: Compact Employee List with Fixed Height & Vertical Scroll */}
            <div
              style={{
                border: '1px solid var(--line, #e2e8f0)',
                borderRadius: 10,
                background: 'var(--surface-alt, #f8fafc)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--muted, #64748b)',
                  marginBottom: 10,
                  paddingBottom: 6,
                  borderBottom: '1px solid var(--line, #e2e8f0)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Employees</span>
                <span
                  style={{
                    background: 'var(--surface, #ffffff)',
                    padding: '2px 7px',
                    borderRadius: 9999,
                    fontSize: '11px',
                    border: '1px solid var(--line, #cbd5e1)',
                  }}
                >
                  {balanceEmployees.length}
                </span>
              </div>

              <div
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  paddingRight: 4,
                }}
              >
                {balanceEmployees.map((emp) => {
                  const isSelected = String(emp.id) === String(activeBalanceEmpId);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleSelectEmployee(emp)}
                      style={{
                        textAlign: 'left',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: isSelected ? '1.5px solid #00b8db' : '1px solid var(--line, #e2e8f0)',
                        background: isSelected ? 'rgba(0, 184, 219, 0.12)' : 'var(--surface, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: isSelected ? 700 : 600,
                            color: isSelected ? '#008fa8' : 'var(--ink, #0f172a)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {emp.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: isSelected ? '#008fa8' : 'var(--muted, #64748b)',
                            marginTop: 1,
                          }}
                        >
                          {emp.code}
                        </div>
                      </div>
                      {isSelected ? (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#00b8db"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      ) : null}
                    </button>
                  );
                })}

                {balanceEmployees.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 8px', fontSize: '12px', color: 'var(--muted)' }}>
                    No employees found.
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right Column: Selected Employee Balances Table with Vertical Scroll */}
            <div
              style={{
                border: '1px solid var(--line, #e2e8f0)',
                borderRadius: 10,
                background: 'var(--surface, #ffffff)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--surface-alt, #f8fafc)',
                  borderBottom: '1px solid var(--line, #e2e8f0)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--ink)' }}>
                    {activeBalanceEmp ? activeBalanceEmp.name : 'Employee'} Balances
                  </strong>
                  <span className="muted" style={{ fontSize: '12px', marginLeft: 8 }}>
                    ({activeBalanceEmp ? activeBalanceEmp.code : '—'})
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11.5px',
                    color: 'var(--muted)',
                  }}
                >
                  {selectedEmpBalances.length} leave quota {selectedEmpBalances.length === 1 ? 'type' : 'types'}
                </span>
              </div>

              <div
                className="table-wrap"
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  margin: 0,
                  border: 'none',
                }}
              >
                <table style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-alt, #f8fafc)', zIndex: 2 }}>
                    <tr>
                      <th style={{ padding: '10px 16px' }}>Leave Type</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Entitlement</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Used</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmpBalances.map((b, i) => (
                      <tr key={`${v(b, 'employeeId', 'employee_id')}-${v(b, 'leaveType', 'leave_type')}-${i}`}>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: 6,
                              background:
                                String(v(b, 'leaveType', 'leave_type')).toLowerCase() === 'annual'
                                  ? 'rgba(0, 184, 219, 0.12)'
                                  : String(v(b, 'leaveType', 'leave_type')).toLowerCase() === 'sick'
                                  ? 'rgba(234, 179, 8, 0.15)'
                                  : String(v(b, 'leaveType', 'leave_type')).toLowerCase() === 'maternity'
                                  ? 'rgba(236, 72, 153, 0.15)'
                                  : 'var(--surface-alt)',
                              color:
                                String(v(b, 'leaveType', 'leave_type')).toLowerCase() === 'annual'
                                  ? '#008fa8'
                                  : String(v(b, 'leaveType', 'leave_type')).toLowerCase() === 'sick'
                                  ? '#b45309'
                                  : String(v(b, 'leaveType', 'leave_type')).toLowerCase() === 'maternity'
                                  ? '#be185d'
                                  : 'var(--ink)',
                            }}
                          >
                            {v(b, 'leaveType', 'leave_type')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>
                          {v(b, 'entitlementDays', 'entitlement_days')} <span className="muted" style={{ fontSize: '11px' }}>days</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#f59e0b' }}>
                          {v(b, 'usedDays', 'used_days')} <span className="muted" style={{ fontSize: '11px' }}>days</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 800,
                              color: '#008fa8',
                              background: 'rgba(0, 184, 219, 0.08)',
                              padding: '3px 10px',
                              borderRadius: 6,
                              display: 'inline-block',
                            }}
                          >
                            {v(b, 'remainingDays', 'remaining_days')} days
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!selectedEmpBalances.length ? (
                      <tr>
                        <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '28px 0' }}>
                          No leave balance records found for {activeBalanceEmp ? activeBalanceEmp.name : 'this employee'}.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. INTERACTIVE TEAM TIME-OFF CALENDAR & CONFLICT WARNINGS (Task 2.1)
           ========================================================================= */}
        <div className="card" style={{ padding: '24px', borderRadius: 14 }}>
          {/* Header & Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Team Time-Off Calendar</h3>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                    Visual team leave planner, public holidays & departmental absence overlap warnings
                  </p>
                </div>
              </div>
            </div>

            {/* Filter and Navigation Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Department Selector */}
              <select
                value={calDeptFilter}
                onChange={(e) => setCalDeptFilter(e.target.value)}
                style={{
                  fontSize: '12.5px',
                  padding: '7px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--line-strong, #cbd5e1)',
                  background: 'var(--surface, #ffffff)',
                  color: 'var(--ink, #0f172a)',
                  outline: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={v(d, 'id')} value={v(d, 'name') || v(d, 'id')}>
                    {v(d, 'name')}
                  </option>
                ))}
              </select>

              {/* Month / Week View Mode Toggle */}
              <div
                style={{
                  display: 'inline-flex',
                  background: 'var(--surface-alt, #f1f5f9)',
                  padding: 3,
                  borderRadius: 8,
                  border: '1px solid var(--line, #e2e8f0)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setCalViewMode('month')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: calViewMode === 'month' ? 700 : 500,
                    borderRadius: 6,
                    border: 'none',
                    background: calViewMode === 'month' ? '#00b8db' : 'transparent',
                    color: calViewMode === 'month' ? '#ffffff' : 'var(--muted, #64748b)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setCalViewMode('week')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: calViewMode === 'week' ? 700 : 500,
                    borderRadius: 6,
                    border: 'none',
                    background: calViewMode === 'week' ? '#00b8db' : 'transparent',
                    color: calViewMode === 'week' ? '#ffffff' : 'var(--muted, #64748b)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Week
                </button>
              </div>

              {/* Prev / Today / Next Navigation */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={handleCalPrev}
                  className="btn"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    background: 'var(--surface-alt, #f8fafc)',
                    border: '1px solid var(--line, #cbd5e1)',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                  title="Previous"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={handleCalToday}
                  className="btn"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'var(--surface-alt, #f8fafc)',
                    border: '1px solid var(--line, #cbd5e1)',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleCalNext}
                  className="btn"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    background: 'var(--surface-alt, #f8fafc)',
                    border: '1px solid var(--line, #cbd5e1)',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                  title="Next"
                >
                  ▶
                </button>
              </div>

              {/* Month & Year Label */}
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--ink, #0f172a)',
                  minWidth: 120,
                  textAlign: 'right',
                }}
              >
                {calDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Absence Overlap Alert Banner (When 2+ staff in same department on leave) */}
          {allPeriodConflicts.length > 0 ? (
            <div
              style={{
                marginBottom: 18,
                padding: '14px 18px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.08))',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#b45309' }}>
                  Absence Overlap Warning: {allPeriodConflicts.length} department schedule conflict(s) detected!
                </div>
              </div>
              <div style={{ fontSize: '12.5px', color: '#78350f', lineHeight: 1.5 }}>
                Two or more staff members in the same department are on leave on the same date. Review overlapping assignments below to ensure adequate operational coverage:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {allPeriodConflicts.map((c, idx) => (
                  <div
                    key={`${c.dateStr}-${c.deptName}-${idx}`}
                    style={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#92400e',
                    }}
                  >
                    📅 <strong>{c.dateStr}</strong> — <strong>{c.deptName}</strong> ({c.employees.join(', ')})
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Calendar Grid Table */}
          <div style={{ overflowX: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))',
                gap: 6,
                minWidth: 840,
              }}
            >
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dName, idx) => (
                <div
                  key={dName}
                  style={{
                    textAlign: 'center',
                    padding: '8px 4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: idx === 0 || idx === 6 ? '#008fa8' : 'var(--muted, #64748b)',
                    background: 'var(--surface-alt, #f8fafc)',
                    borderRadius: 6,
                  }}
                >
                  {dName}
                </div>
              ))}

              {/* Day Cells */}
              {calendarDays.map((dayItem) => {
                const dayNum = dayItem.date.getDate();
                const isSunOrSat = dayItem.date.getDay() === 0 || dayItem.date.getDay() === 6;

                return (
                  <div
                    key={dayItem.dateStr}
                    style={{
                      minHeight: 115,
                      borderRadius: 8,
                      padding: '8px',
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      background: dayItem.hasConflict
                        ? 'rgba(245, 158, 11, 0.08)'
                        : dayItem.isToday
                        ? 'rgba(0, 184, 219, 0.06)'
                        : !dayItem.isCurrentMonth
                        ? 'var(--surface-alt, #f8fafc)'
                        : 'var(--surface, #ffffff)',
                      border: dayItem.hasConflict
                        ? '2px solid #f59e0b'
                        : dayItem.isToday
                        ? '2px solid #00b8db'
                        : '1px solid var(--line, #e2e8f0)',
                      opacity: !dayItem.isCurrentMonth && calViewMode === 'month' ? 0.55 : 1,
                      transition: 'border 0.15s ease',
                    }}
                  >
                    {/* Top Row in Cell: Date Number & Holiday / Conflict Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: dayItem.isToday ? 800 : 600,
                          color: dayItem.isToday
                            ? '#ffffff'
                            : !dayItem.isCurrentMonth
                            ? 'var(--muted, #94a3b8)'
                            : isSunOrSat
                            ? '#008fa8'
                            : 'var(--ink, #0f172a)',
                          background: dayItem.isToday ? '#00b8db' : 'transparent',
                          width: dayItem.isToday ? 22 : 'auto',
                          height: dayItem.isToday ? 22 : 'auto',
                          borderRadius: dayItem.isToday ? '50%' : 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {dayNum}
                      </span>

                      {/* Conflict Indicator in cell */}
                      {dayItem.hasConflict ? (
                        <span
                          title={dayItem.conflicts.map((c) => `${c.deptName}: ${c.employees.join(', ')}`).join('\n')}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid rgba(245, 158, 11, 0.5)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            cursor: 'help',
                          }}
                        >
                          ⚠️ {dayItem.conflicts.reduce((sum, c) => sum + c.count, 0)} overlap
                        </span>
                      ) : null}
                    </div>

                    {/* UAE Public Holiday Pill */}
                    {dayItem.holiday ? (
                      <div
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '3px 6px',
                          borderRadius: 5,
                          background: 'rgba(16, 185, 129, 0.14)',
                          color: '#065f46',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={`UAE Public Holiday: ${dayItem.holiday.name}`}
                      >
                        🕌 {dayItem.holiday.name}
                      </div>
                    ) : null}

                    {/* Approved Leaves Event Pills */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2, overflowY: 'auto', maxHeight: 85 }}>
                      {dayItem.leaves.map((l) => {
                        const lType = String(l.leaveType || '').toLowerCase();
                        const isAnnual = lType === 'annual';
                        const isSick = lType === 'sick';
                        const isCasual = lType === 'casual';
                        const isMaternity = lType === 'maternity';

                        const pillBg = isAnnual
                          ? 'rgba(0, 184, 219, 0.14)'
                          : isSick
                          ? 'rgba(234, 179, 8, 0.18)'
                          : isCasual
                          ? 'rgba(168, 85, 247, 0.16)'
                          : isMaternity
                          ? 'rgba(236, 72, 153, 0.16)'
                          : 'var(--surface-alt, #f1f5f9)';

                        const pillColor = isAnnual
                          ? '#008fa8'
                          : isSick
                          ? '#b45309'
                          : isCasual
                          ? '#7e22ce'
                          : isMaternity
                          ? '#be185d'
                          : 'var(--ink, #334155)';

                        const pillBorder = isAnnual
                          ? 'rgba(0, 184, 219, 0.35)'
                          : isSick
                          ? 'rgba(234, 179, 8, 0.4)'
                          : isCasual
                          ? 'rgba(168, 85, 247, 0.35)'
                          : isMaternity
                          ? 'rgba(236, 72, 153, 0.35)'
                          : 'var(--line, #cbd5e1)';

                        return (
                          <div
                            key={`${l.id}-${dayItem.dateStr}`}
                            onClick={() => {
                              setSelectedLeave(l);
                              const el = document.getElementById('leave-request-details-section');
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            title={`${l.empName} (${l.deptName}) - ${l.leaveType} Leave\nDates: ${l.startDate} to ${l.endDate}\nReason: ${l.reason || 'Personal'}`}
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: pillBg,
                              color: pillColor,
                              border: `1px solid ${pillBorder}`,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.25,
                              transition: 'transform 0.1s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: pillColor, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {l.empName}
                            </span>
                            <span style={{ fontSize: '9.5px', opacity: 0.85 }}>({l.deptName})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Legend & UAE Holiday Collapsible Table Toggle */}
          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: '1px solid var(--line, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: '11.5px' }}>
              <span className="muted" style={{ fontWeight: 600 }}>Legend:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(0, 184, 219, 0.3)', border: '1px solid #00b8db' }} />
                <span>Annual Leave</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(234, 179, 8, 0.3)', border: '1px solid #f59e0b' }} />
                <span>Sick Leave</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(168, 85, 247, 0.3)', border: '1px solid #a855f7' }} />
                <span>Casual Leave</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(236, 72, 153, 0.3)', border: '1px solid #ec4899' }} />
                <span>Maternity Leave</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(16, 185, 129, 0.3)', border: '1px solid #10b981' }} />
                <span>UAE Holiday</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(245, 158, 11, 0.25)', border: '2px solid #f59e0b' }} />
                <span style={{ fontWeight: 700, color: '#b45309' }}>Absence Overlap (2+ Dept Staff)</span>
              </div>
            </div>

            {/* Toggle Table Button */}
            <button
              type="button"
              className="btn"
              onClick={() => setShowHolidaysTable((prev) => !prev)}
              style={{
                fontSize: '12px',
                padding: '5px 12px',
                background: 'var(--surface-alt, #f8fafc)',
                border: '1px solid var(--line, #cbd5e1)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {showHolidaysTable ? 'Hide Official Holidays List ▲' : 'View Official UAE Holidays List (2026) ▼'}
            </button>
          </div>

          {/* Optional Collapsible UAE Holidays List */}
          {showHolidaysTable ? (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--line, #e2e8f0)' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', fontWeight: 700 }}>Official UAE Public Holidays (2026)</h4>
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
          ) : null}
        </div>

      </div>
    </AppShell>
  );
}
