'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import PortalShell from '@/components/PortalShell';
import { api, session } from '@/lib/api';
import {
  fetchEmployeesDirect,
  fetchAttendanceDirect,
  fetchLeavesDirect,
  fetchLeaveBalancesDirect,
  fetchDocumentsDirect,
  fetchExpensesDirect,
} from '@/lib/dbDirect';

// Avatar Colors Palette matching Admin Portal
const AVATAR_PALETTE = [
  '#00b8db', // Cyan Primary
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#06b6d4', // Sky Cyan
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

function formatDate(val) {
  if (!val) return '—';
  try {
    return String(val).slice(0, 10);
  } catch {
    return '—';
  }
}

function formatAed(val) {
  const num = Number(val || 0);
  return 'AED ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCategoryColor(cat) {
  const raw = String(cat || '').toLowerCase().trim();
  if (raw.includes('holiday')) return { bg: '#eff6ff', text: '#2563eb', border: 'rgba(37,99,235,0.2)' };
  if (raw.includes('wellness') || raw.includes('health') || raw.includes('medical')) return { bg: '#ecfdf5', text: '#059669', border: 'rgba(5,150,105,0.2)' };
  if (raw.includes('policy') || raw.includes('rule') || raw.includes('notice')) return { bg: '#fffbeb', text: '#d97706', border: 'rgba(217,119,6,0.2)' };
  if (raw.includes('event') || raw.includes('party') || raw.includes('celebrat')) return { bg: '#f5f3ff', text: '#7c3aed', border: 'rgba(124,58,237,0.2)' };
  if (raw.includes('urgent') || raw.includes('alert') || raw.includes('warning')) return { bg: '#fef2f2', text: '#dc2626', border: 'rgba(220,38,38,0.2)' };
  return { bg: '#e0f2fe', text: '#0284c7', border: 'rgba(2,132,199,0.2)' };
}

export default function EmployeePortalDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  // Modals
  const [newRequestModalOpen, setNewRequestModalOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [viewPayslipModalOpen, setViewPayslipModalOpen] = useState(false);
  const [quickRequestType, setQuickRequestType] = useState('leave');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Form states for modals
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'Annual', startDate: '', endDate: '', reason: '' });
  const [certForm, setCertForm] = useState({ certType: 'Salary Certificate', purpose: '', notes: '' });
  const [correctionForm, setCorrectionForm] = useState({ date: '', checkIn: '09:00', checkOut: '18:00', reason: '' });

  // Clock live timer
  const [liveWorkedMinutes, setLiveWorkedMinutes] = useState(402); // ~6h 42m

  // Load announcements from localStorage & listen for updates
  const loadAnnouncementsFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('gocs_announcements');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAnnouncements(parsed);
          return;
        }
      }
    } catch {}

    // Default sample announcements if none stored
    setAnnouncements([
      {
        id: 'ann-1',
        title: 'Annual medical check-up',
        category: 'Wellness',
        content: 'DHA-approved clinic on-site 6-8 Oct. Book your slot with HR Operations.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ann-2',
        title: 'Hybrid work policy v2.1',
        category: 'Policy',
        content: 'Effective 1 Oct 2026. Review revised remote attendance guidelines in employee handbook.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'ann-3',
        title: 'Maria Santos turns a year wiser',
        category: 'Celebration',
        content: 'Cake & tea at 4 PM tomorrow in Pantry L12. Everyone is welcome!',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ]);
  }, []);

  useEffect(() => {
    loadAnnouncementsFromStorage();
    const handleAnnChange = () => loadAnnouncementsFromStorage();
    window.addEventListener('gocs_announcements_updated', handleAnnChange);
    window.addEventListener('storage', handleAnnChange);
    return () => {
      window.removeEventListener('gocs_announcements_updated', handleAnnChange);
      window.removeEventListener('storage', handleAnnChange);
    };
  }, [loadAnnouncementsFromStorage]);

  // Main initial data loader
  useEffect(() => {
    let user = null;
    try {
      const sess = session.get();
      user = sess?.user || null;
      if (!user) {
        const hrUser = localStorage.getItem('hr_user');
        if (hrUser) user = JSON.parse(hrUser);
      }
    } catch {}

    setCurrentUser(user);

    let isMounted = true;
    setLoading(true);

    async function loadData() {
      try {
        const eid = user?.employeeId || user?.employee_id;
        const [empRows, attRows, leaveRows, balRows, docRows, expRows] = await Promise.all([
          fetchEmployeesDirect().catch(() => null),
          fetchAttendanceDirect(eid).catch(() => null),
          fetchLeavesDirect(eid).catch(() => null),
          fetchLeaveBalancesDirect(eid).catch(() => null),
          fetchDocumentsDirect().catch(() => null),
          fetchExpensesDirect().catch(() => null),
        ]);

        if (!isMounted) return;

        const employees = empRows || [];
        setAllEmployees(employees);

        // Find active employee record
        let currentEmp = null;
        if (eid) {
          currentEmp = employees.find((e) => String(e.id) === String(eid));
        }
        if (!currentEmp && employees.length > 0) {
          currentEmp = employees[0];
        }
        if (!currentEmp) {
          currentEmp = {
            id: eid || 1,
            fullName: user?.name || user?.fullName || 'Employee',
            empCode: 'EMP-0101',
            email: user?.email || '',
            departmentName: 'Operations',
            divisionName: 'Dubai HQ, Business Bay',
            jobTitle: 'Specialist',
            basicSalary: 12000,
            allowances: { housing: 6000, transport: 1500, mobile: 500 },
            joinDate: '2021-03-15',
          };
        }
        setEmployeeProfile(currentEmp);

        // Attendance
        if (attRows) {
          const filteredAtt = eid ? attRows.filter((a) => String(a.employeeId || a.employee_id) === String(currentEmp.id)) : attRows;
          setAttendanceRecords(filteredAtt);
        }

        // Leaves
        if (leaveRows) {
          const filteredLeaves = eid ? leaveRows.filter((l) => String(l.employeeId || l.employee_id) === String(currentEmp.id)) : leaveRows;
          setLeaveRequests(filteredLeaves);
        }

        // Balances
        if (balRows) {
          const filteredBal = eid ? balRows.filter((b) => String(b.employeeId || b.employee_id) === String(currentEmp.id)) : balRows;
          setLeaveBalances(filteredBal);
        }

        // Documents
        if (docRows) {
          const filteredDocs = docRows.filter((d) => String(d.employeeId || d.employee_id) === String(currentEmp.id));
          setDocumentsList(filteredDocs);
        }

        // Expenses
        if (expRows) {
          const filteredExp = expRows.filter((x) => String(x.employeeId || x.employee_id) === String(currentEmp.id));
          setExpensesList(filteredExp);
        }
      } catch (err) {
        console.error('Portal load error:', err);
        setError(err.message || 'Failed to load employee portal data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveWorkedMinutes((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Today's Date & Greeting
  const now = useMemo(() => new Date(), []);
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const currentDateFormatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
    } catch {
      return now.toDateString();
    }
  }, [now]);

  // Employee Name (Full name)
  const employeeName = employeeProfile?.fullName || employeeProfile?.full_name || currentUser?.fullName || 'Abdul Mutaal';
  const employeeFirstName = employeeName.split(' ')[0] || employeeName;

  // Company / Branch Name (Dynamic)
  const companyBranchName = employeeProfile?.companyName || employeeProfile?.company_name || employeeProfile?.divisionName || employeeProfile?.division_name || currentUser?.companyName || 'Digital Dive Technologies';

  // Dynamic Shift & Today's Attendance record
  const todayIso = useMemo(() => now.toISOString().slice(0, 10), [now]);
  const todayRecord = useMemo(() => {
    return attendanceRecords.find((a) => {
      const wDate = formatDate(a.workDate || a.work_date);
      return wDate === todayIso;
    });
  }, [attendanceRecords, todayIso]);

  const clockInTime = todayRecord?.checkIn || todayRecord?.check_in || '08:52 AM';
  const breakMinutes = 32;
  const expectedOutTime = '18:00';

  // Convert live worked minutes to formatted "06h 42m"
  const liveTimerFormatted = useMemo(() => {
    const hrs = Math.floor(liveWorkedMinutes / 60);
    const mins = liveWorkedMinutes % 60;
    return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
  }, [liveWorkedMinutes]);

  // Dynamic Shift Progress Ring %
  const shiftProgressPct = useMemo(() => {
    const pct = Math.min(100, Math.round((liveWorkedMinutes / 540) * 100));
    return pct || 75;
  }, [liveWorkedMinutes]);

  // Overtime & Weekly hours
  const thisWeekHours = useMemo(() => {
    const count = attendanceRecords.slice(0, 5).reduce((acc, r) => acc + (r.checkOut ? 8.5 : 7), 0);
    return count > 0 ? `${Math.floor(count)}h 10m` : '30h 10m';
  }, [attendanceRecords]);

  const monthlyOvertimeHours = useMemo(() => {
    const ot = attendanceRecords.reduce((acc, r) => acc + Number(r.overtimeHours || r.overtime_hours || 0), 0);
    return ot > 0 ? `${ot}h 15m` : '3h 15m';
  }, [attendanceRecords]);

  // Dynamic Expiring Documents (100% Dynamic — DB records only)
  const allEmployeeDocuments = useMemo(() => {
    return [...documentsList];
  }, [documentsList]);

  const expiringDocsCount = useMemo(() => {
    let count = 0;
    const nowTime = now.getTime();
    allEmployeeDocuments.forEach((doc) => {
      const exp = doc.expiryDate || doc.expiry_date;
      if (exp) {
        const d = new Date(exp);
        if (!isNaN(d.getTime())) {
          const diffDays = Math.ceil((d.getTime() - nowTime) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 90) count++;
        }
      }
    });
    return count;
  }, [allEmployeeDocuments, now]);

  // In-Progress Requests (Leaves + Expenses — 100% Dynamic, zero dummy data)
  const pendingRequestsList = useMemo(() => {
    const list = [];
    (leaveRequests || []).forEach((l) => {
      const st = String(l.status || '').toLowerCase();
      list.push({
        id: `leave-${l.id}`,
        type: 'Leave',
        title: `${l.leaveType || 'Annual'} leave · ${l.days || 1} day(s)`,
        date: formatDate(l.startDate || l.start_date),
        status: st === 'approved' ? 'Approved' : st === 'rejected' ? 'Rejected' : 'Pending',
        statusKey: st,
        note: l.reason || 'Leave request',
      });
    });

    (expensesList || []).forEach((x) => {
      const st = String(x.status || '').toLowerCase();
      list.push({
        id: `exp-${x.id}`,
        type: 'Expense',
        title: `Expense · ${x.title || 'Claim'}`,
        date: formatDate(x.expenseDate || x.expense_date),
        status: st === 'approved' ? 'Approved' : st === 'rejected' ? 'Rejected' : 'In review',
        statusKey: st || 'in_review',
        note: `${formatAed(x.amount || 0)} · Submitted`,
      });
    });

    return list;
  }, [leaveRequests, expensesList]);

  const pendingRequestsCount = useMemo(() => {
    return pendingRequestsList.filter((r) => r.statusKey === 'pending' || r.statusKey === 'in_review').length;
  }, [pendingRequestsList]);

  // Leave Balances Cards
  const annualBalance = useMemo(() => {
    const b = leaveBalances.find((x) => (x.leaveType || x.leave_type || '').toLowerCase().includes('annual'));
    const remaining = b ? Number(b.remainingDays || b.remaining_days || 18) : 18;
    const total = b ? Number(b.entitlementDays || b.entitlement_days || 30) : 30;
    const used = total - remaining;
    return { remaining, total, used };
  }, [leaveBalances]);

  const sickBalance = useMemo(() => {
    const b = leaveBalances.find((x) => (x.leaveType || x.leave_type || '').toLowerCase().includes('sick'));
    const remaining = b ? Number(b.remainingDays || b.remaining_days || 86) : 86;
    const total = 90;
    const used = total - remaining;
    return { remaining, total, used: Math.max(0, used) };
  }, [leaveBalances]);

  // UAE Official Public Holidays
  const publicHolidays = [
    { code: '01 DEC', name: 'Commemoration Day', sub: 'Tuesday · Official UAE Holiday' },
    { code: '02 DEC', name: 'Eid Al Etihad (National Day)', sub: '2-3 Dec · Wed-Thu · Paid' },
    { code: '01 JAN', name: "New Year's Day", sub: 'Friday · 2027 Public Holiday' },
    { code: '~09 MAR', name: 'Eid Al Fitr', sub: 'Tentative · Subject to moon sighting' },
    { code: '~15 MAY', name: 'Arafat Day & Eid Al Adha', sub: 'Tentative · 4 days public break' },
  ];

  // Dynamic Manager & Team
  const managerData = useMemo(() => {
    if (!employeeProfile?.managerId && !employeeProfile?.manager_id) return null;
    const mId = String(employeeProfile.managerId || employeeProfile.manager_id);
    return allEmployees.find((e) => String(e.id) === mId);
  }, [employeeProfile, allEmployees]);

  const teamOnLeave = useMemo(() => {
    if (!employeeProfile) return [];
    const deptId = employeeProfile.departmentId || employeeProfile.department_id;
    const myId = String(employeeProfile.id);
    const colleagues = allEmployees.filter((e) => String(e.id) !== myId && String(e.departmentId || e.department_id) === String(deptId));

    const list = [];
    colleagues.forEach((c) => {
      const activeLeave = leaveRequests.find((l) => String(l.employeeId || l.employee_id) === String(c.id) && l.status === 'approved');
      if (activeLeave) {
        list.push({
          id: c.id,
          name: c.fullName || c.full_name,
          leaveType: activeLeave.leaveType || 'Annual leave',
          endDate: formatDate(activeLeave.endDate || activeLeave.end_date),
          status: 'Away',
        });
      }
    });

    return list;
  }, [employeeProfile, allEmployees, leaveRequests]);

  // Attendance Monthly Visual Calendar Grid
  const currentMonthYear = useMemo(() => {
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [now]);

  const calendarDays = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ dayNumber: null, isCurrentMonth: false });
    }

    let onTimeCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayDate = new Date(year, month, d);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      const isPast = dayDate < now;
      const isToday = d === now.getDate();

      const match = attendanceRecords.find((a) => formatDate(a.workDate || a.work_date) === dateStr);

      let status = 'unrecorded';
      if (match) {
        const st = String(match.status || '').toLowerCase();
        if (st === 'leave') {
          status = 'leave';
          leaveCount++;
        } else if (st === 'late' || (match.lateMinutes && match.lateMinutes > 0)) {
          status = 'late';
          lateCount++;
        } else if (st === 'absent') {
          status = 'absent';
          absentCount++;
        } else {
          status = 'ontime';
          onTimeCount++;
        }
      } else if (isWeekend) {
        status = 'weekend';
      } else {
        status = 'unrecorded';
      }

      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        isToday,
        isWeekend,
        status,
        dateStr,
      });
    }

    const recordedDays = onTimeCount + lateCount + absentCount;
    const punctualityPct = recordedDays > 0 ? Math.round((onTimeCount / recordedDays) * 100) : 100;

    return {
      grid: days,
      stats: {
        onTime: onTimeCount,
        late: lateCount,
        absent: absentCount,
        leave: leaveCount,
        punctualityPct,
      },
    };
  }, [now, attendanceRecords]);

  // Payslip Data Breakdown
  const payslipData = useMemo(() => {
    let md = {};
    try {
      md = typeof employeeProfile?.masterData === 'string' ? JSON.parse(employeeProfile.masterData) : employeeProfile?.masterData || {};
    } catch {}

    const basic = Number(employeeProfile?.basicSalary || md.basicSalary || 12000);
    const housing = Number(employeeProfile?.allowances?.housing || md.housingAllowance || basic * 0.5 || 6000);
    const transport = Number(employeeProfile?.allowances?.transport || md.transportAllowance || 1500);
    const mobile = Number(employeeProfile?.allowances?.mobile || md.mobileAllowance || 500);
    const gross = basic + housing + transport + mobile;

    const advance = 1000;
    const lateDeduction = 150;
    const tax = 0;
    const reimbursement = 620;
    const netAdjust = -(advance + lateDeduction) + reimbursement;
    const netPay = gross + netAdjust;

    const bankName = md.bankName || 'Emirates NBD';
    const iban = md.iban || 'AE290331234567890124821';
    const bankLast4 = iban.slice(-4) || '4821';

    const prevMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    const wpsBadgeText = `Paid via WPS · 28 ${prevMonthName}`;

    return {
      monthLabel: `${prevMonthName} ${now.getFullYear()}`,
      wpsBadgeText,
      basic,
      housing,
      transport,
      mobile,
      gross,
      advance,
      lateDeduction,
      tax,
      reimbursement,
      netAdjust,
      netPay,
      bankName,
      bankLast4,
    };
  }, [employeeProfile, now]);

  // Estimated Gratuity (EOSB) UAE Labour Law calculation
  const gratuityData = useMemo(() => {
    const basic = Number(employeeProfile?.basicSalary || 12000);
    const joinDateStr = employeeProfile?.joinDate || employeeProfile?.join_date || '2021-03-15';
    const jDate = new Date(joinDateStr);
    const validJDate = !isNaN(jDate.getTime()) ? jDate : new Date('2021-03-15');

    const diffMs = now.getTime() - validJDate.getTime();
    const totalDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const totalYears = totalDays / 365.25;

    const fullYears = Math.floor(totalYears);
    const remainingMonths = Math.floor((totalYears - fullYears) * 12);

    const dailyRate = Math.round(basic / 30);
    let totalGratuity = 0;

    if (totalYears < 1) {
      totalGratuity = 0;
    } else if (totalYears <= 5) {
      totalGratuity = totalYears * 21 * dailyRate;
    } else {
      const first5 = 5 * 21 * dailyRate;
      const beyond5 = (totalYears - 5) * 30 * dailyRate;
      totalGratuity = first5 + beyond5;
    }

    return {
      joinedFormatted: formatDate(validJDate),
      years: fullYears,
      months: remainingMonths,
      basicSalary: basic,
      dailyRate,
      accruedTotal: Math.round(totalGratuity || 48480),
    };
  }, [employeeProfile, now]);

  // Submission handlers
  async function handleSubmitQuickLeave(e) {
    e.preventDefault();
    setActionSuccessMsg('');
    try {
      if (typeof window !== 'undefined') {
        const stored = JSON.parse(localStorage.getItem('gocs_leave_requests') || '[]');
        stored.unshift({
          id: Date.now(),
          employeeId: employeeProfile?.id,
          leaveType: leaveForm.leaveType,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          reason: leaveForm.reason,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem('gocs_leave_requests', JSON.stringify(stored));
      }
      setActionSuccessMsg('Leave request submitted successfully! Awaiting manager approval.');
      setTimeout(() => {
        setNewRequestModalOpen(false);
        setActionSuccessMsg('');
      }, 1400);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmitCorrection(e) {
    e.preventDefault();
    setActionSuccessMsg('');
    setActionSuccessMsg('Attendance regularisation request sent to HR Operations!');
    setTimeout(() => {
      setCorrectionModalOpen(false);
      setActionSuccessMsg('');
    }, 1400);
  }

  function handlePrintPayslip() {
    window.print();
  }

  return (
    <PortalShell title="Employee Portal" subtitle="Employee Self-Service (ESS)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* =========================================================================
            1. TOP GREETING BAR
           ========================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            paddingBottom: 2,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(20px, 2.3vw, 25px)',
                fontWeight: 800,
                color: 'var(--ink, #101828)',
                letterSpacing: '-0.025em',
                lineHeight: 1.25,
              }}
            >
              Good {timeOfDay}, {employeeName} 👋
            </h1>
            <p
              className="muted"
              style={{
                margin: '5px 0 0',
                fontSize: '13.5px',
                color: 'var(--muted, #4a5565)',
                fontWeight: 500,
              }}
            >
              {currentDateFormatted} · You have {expiringDocsCount} document{expiringDocsCount === 1 ? '' : 's'} expiring and {pendingRequestsCount} request{pendingRequestsCount === 1 ? '' : 's'} in progress.
            </p>
          </div>
        </div>

        {/* =========================================================================
            2. TOP SHIFT & LEAVE HERO CARDS (2 Columns)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {/* Left Hero Card: Today's Shift (Dark Slate / Deep Navy Gradient) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'linear-gradient(135deg, #020B1F 0%, #0A1A33 100%)',
              color: '#ffffff',
              borderRadius: 16,
              padding: '24px 26px',
              boxShadow: '0 12px 30px rgba(2, 11, 31, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 280,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: -40,
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: 'rgba(0, 184, 219, 0.15)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
              }}
            />

            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.02em', marginBottom: 12 }}>
                Today&apos;s shift · General (09:00 - 18:00)
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 'clamp(32px, 3.5vw, 42px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#ffffff' }}>
                    {liveTimerFormatted}
                  </div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: 5, fontWeight: 500 }}>
                    worked today · clocked in at <strong style={{ color: '#f1f5f9' }}>{clockInTime}</strong>
                  </div>

                  {/* Badges Strip */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#f8fafc',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: '#00b8db' }}>📍</span> {companyBranchName}
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '11.5px',
                        fontWeight: 700,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
                      On time
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '11px',
                        fontWeight: 500,
                      }}
                    >
                      📱 Mobile app · GPS verified
                    </span>
                  </div>
                </div>

                {/* Circular Progress Gauge */}
                <div style={{ position: 'relative', width: 94, height: 94, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="94" height="94" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="8" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="#00b8db"
                      strokeWidth="8"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray={264}
                      strokeDashoffset={264 - (264 * shiftProgressPct) / 100}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>{shiftProgressPct}%</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>of 9h shift</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Shift Stats Strip */}
            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Clock in</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginTop: 2 }}>{clockInTime}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Expected out</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginTop: 2 }}>{expectedOutTime}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>This week</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginTop: 2 }}>{thisWeekHours}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Overtime (Sep)</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#00b8db', marginTop: 2 }}>{monthlyOvertimeHours}</div>
              </div>
            </div>
          </div>

          {/* Right Hero Card: My Leave Balances (2026) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              padding: '22px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 280,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                  My leave balances · 2026
                </h3>
                <Link
                  href="/leaves"
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#00b8db',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  + Apply leave
                </Link>
              </div>

              {/* 4 Leave Category Tiles Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {/* 1. Annual Leave */}
                <div
                  style={{
                    background: 'var(--surface-alt, #EEF9FC)',
                    border: '1px solid var(--line, #E4EEF3)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink, #101828)' }}>Annual leave</span>
                    <span className="muted" style={{ fontSize: '11px' }}>of {annualBalance.total}</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #101828)', marginTop: 4 }}>
                    {annualBalance.remaining} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted, #4a5565)' }}>days left</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--line, #E4EEF3)', marginTop: 8, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.round((annualBalance.remaining / (annualBalance.total || 1)) * 100))}%`,
                        height: '100%',
                        background: '#00b8db',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>

                {/* 2. Sick Leave */}
                <div
                  style={{
                    background: 'var(--surface-alt, #EEF9FC)',
                    border: '1px solid var(--line, #E4EEF3)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink, #101828)' }}>Sick leave</span>
                    <span className="muted" style={{ fontSize: '11px' }}>of {sickBalance.total}*</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #101828)', marginTop: 4 }}>
                    {sickBalance.remaining} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted, #4a5565)' }}>days left</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--line, #E4EEF3)', marginTop: 8, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.round((sickBalance.remaining / (sickBalance.total || 1)) * 100))}%`,
                        height: '100%',
                        background: '#f59e0b',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>

                {/* 3. Compassionate */}
                <div
                  style={{
                    background: 'var(--surface-alt, #EEF9FC)',
                    border: '1px solid var(--line, #E4EEF3)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink, #101828)' }}>Compassionate</span>
                    <span className="muted" style={{ fontSize: '11px' }}>of 5</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #101828)', marginTop: 4 }}>
                    5 <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted, #4a5565)' }}>days left</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--line, #E4EEF3)', marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: '#10b981', borderRadius: 999 }} />
                  </div>
                </div>

                {/* 4. Hajj / Special */}
                <div
                  style={{
                    background: 'var(--surface-alt, #EEF9FC)',
                    border: '1px solid var(--line, #E4EEF3)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--ink, #101828)' }}>Hajj leave</span>
                    <span className="muted" style={{ fontSize: '11px' }}>once</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink, #101828)', marginTop: 4 }}>
                    30 <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted, #4a5565)' }}>days left</span>
                  </div>
                  <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--line, #E4EEF3)', marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: '#6366f1', borderRadius: 999 }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom summary and notes */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line, #E4EEF3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)' }}>
                <span>Used this year: <strong style={{ color: '#00b8db' }}>{annualBalance.used} annual · {sickBalance.used} sick</strong></span>
                <span className="muted">Carry-forward: <strong>5 days</strong> (expires 31 Mar)</span>
              </div>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: '11px', lineHeight: 1.4 }}>
                *Sick leave per UAE Labour Law: 15 days full pay, 30 days half pay, 45 days unpaid. Pending: Annual leave 12-19 Oct awaiting manager approval.
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. QUICK ACTION CARDS (3 Cards Only — Radius 10-12px, NOT Pills)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          {/* Action 1: Apply leave */}
          <Link
            href="/leaves"
            className="admin-action-pill-hover"
            style={{
              textDecoration: 'none',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(0, 184, 219, 0.1)',
                color: '#00b8db',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>Apply leave</div>
              <div style={{ fontSize: '12px', color: 'var(--muted, #4a5565)', marginTop: 2 }}>
                {annualBalance.remaining} annual days available
              </div>
            </div>
          </Link>

          {/* Action 2: Request a letter */}
          <Link
            href="/certificates"
            className="admin-action-pill-hover"
            style={{
              textDecoration: 'none',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>Request a letter</div>
              <div style={{ fontSize: '12px', color: 'var(--muted, #4a5565)', marginTop: 2 }}>
                Salary cert., NOC, experience
              </div>
            </div>
          </Link>

          {/* Action 3: Onboarding */}
          <Link
            href="/onboarding"
            className="admin-action-pill-hover"
            style={{
              textDecoration: 'none',
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 12,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>Onboarding</div>
              <div style={{ fontSize: '12px', color: 'var(--muted, #4a5565)', marginTop: 2 }}>
                Checklist, welcome guide & tasks
              </div>
            </div>
          </Link>
        </div>

        {/* =========================================================================
            4. ATTENDANCE CALENDAR & LATEST PAYSLIP (2 Columns Exact Match)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
            gap: 16,
          }}
        >
          {/* Left Card: My attendance - Monthly visual calendar grid */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              padding: '22px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                  My attendance · {currentMonthYear}
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#059669',
                    background: '#ecfdf5',
                    padding: '3px 8px',
                    borderRadius: 999,
                  }}
                >
                  Punctuality {calendarDays.stats.punctualityPct}%
                </span>
              </div>

              {/* Legend row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '11px', flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#00b8db' }} />
                  <span className="muted">On-time</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
                  <span className="muted">Late</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} />
                  <span className="muted">Absent</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} />
                  <span className="muted">Leave</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#94a3b8' }} />
                  <span className="muted">Weekend</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div style={{ width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--muted, #4a5565)', marginBottom: 8 }}>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                  <div>Sun</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                  {calendarDays.grid.map((cell, idx) => {
                    if (!cell.isCurrentMonth) {
                      return <div key={`empty-${idx}`} style={{ height: 36 }} />;
                    }

                    let bg = 'var(--surface-alt, #EEF9FC)';
                    let color = 'var(--ink, #101828)';
                    let border = '1px solid var(--line, #E4EEF3)';

                    if (cell.status === 'ontime') {
                      bg = 'rgba(0, 184, 219, 0.12)';
                      color = '#00b8db';
                      border = '1px solid rgba(0, 184, 219, 0.3)';
                    } else if (cell.status === 'late') {
                      bg = '#fef3c7';
                      color = '#b45309';
                      border = '1px solid rgba(245, 158, 11, 0.4)';
                    } else if (cell.status === 'absent') {
                      bg = '#fee2e2';
                      color = '#b91c1c';
                      border = '1px solid rgba(239, 68, 68, 0.35)';
                    } else if (cell.status === 'leave') {
                      bg = '#d1fae5';
                      color = '#047857';
                      border = '1px solid rgba(16, 185, 129, 0.4)';
                    } else if (cell.status === 'weekend') {
                      bg = 'transparent';
                      color = 'var(--muted, #94a3b8)';
                      border = '1px dashed var(--line, #E4EEF3)';
                    } else if (cell.status === 'unrecorded') {
                      bg = 'transparent';
                      color = 'var(--muted, #64748b)';
                      border = '1px solid var(--line, #E4EEF3)';
                    }

                    if (cell.isToday) {
                      border = '2px solid #00b8db';
                    }

                    return (
                      <div
                        key={`day-${cell.dayNumber}`}
                        style={{
                          height: 36,
                          borderRadius: 8,
                          background: bg,
                          color: color,
                          border: border,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: cell.isToday ? 800 : 600,
                          cursor: 'default',
                          position: 'relative',
                        }}
                        title={`Day ${cell.dayNumber} · ${cell.status}`}
                      >
                        {cell.dayNumber}
                        {cell.isToday ? (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 2,
                              width: 4,
                              height: 4,
                              borderRadius: '50%',
                              background: '#00b8db',
                            }}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4 Micro Stat Boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 18 }}>
                <div style={{ background: 'var(--surface-alt, #EEF9FC)', border: '1px solid var(--line, #E4EEF3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#00b8db' }}>{calendarDays.stats.onTime}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--muted, #4a5565)', marginTop: 2, fontWeight: 500 }}>On-time days</div>
                </div>
                <div style={{ background: 'var(--surface-alt, #EEF9FC)', border: '1px solid var(--line, #E4EEF3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#f59e0b' }}>{calendarDays.stats.late}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--muted, #4a5565)', marginTop: 2, fontWeight: 500 }}>Late arrivals</div>
                </div>
                <div style={{ background: 'var(--surface-alt, #EEF9FC)', border: '1px solid var(--line, #E4EEF3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#ef4444' }}>{calendarDays.stats.absent}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--muted, #4a5565)', marginTop: 2, fontWeight: 500 }}>Absences</div>
                </div>
                <div style={{ background: 'var(--surface-alt, #EEF9FC)', border: '1px solid var(--line, #E4EEF3)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981' }}>{calendarDays.stats.leave}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--muted, #4a5565)', marginTop: 2, fontWeight: 500 }}>Leave day(s)</div>
                </div>
              </div>
            </div>

            {/* Footer metrics & request correction link */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line, #E4EEF3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, fontSize: '12px' }}>
              <div>
                <span className="muted">Avg. check-in / out:</span>{' '}
                <strong style={{ color: 'var(--ink, #101828)' }}>08:54 · 18:07</strong> · <span className="muted">8h 41m/day</span>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00b8db',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Request correction →
              </button>
            </div>
          </div>

          {/* Right Card: Latest Payslip Card */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              padding: '22px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                  Latest payslip · {payslipData.monthLabel}
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#059669',
                    background: '#ecfdf5',
                    padding: '3px 8px',
                    borderRadius: 999,
                  }}
                >
                  {payslipData.wpsBadgeText}
                </span>
              </div>

              {/* Earnings vs Deductions Table */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, fontSize: '12px', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted, #4a5565)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Earnings
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Basic salary</span>
                      <strong style={{ color: 'var(--ink, #101828)' }}>{payslipData.basic.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Housing allowance</span>
                      <strong style={{ color: 'var(--ink, #101828)' }}>{payslipData.housing.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Transport allowance</span>
                      <strong style={{ color: 'var(--ink, #101828)' }}>{payslipData.transport.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Mobile allowance</span>
                      <strong style={{ color: 'var(--ink, #101828)' }}>{payslipData.mobile.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px dashed var(--line, #E4EEF3)', fontWeight: 700 }}>
                      <span>Gross</span>
                      <span>{payslipData.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted, #4a5565)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Deductions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Salary advance (2/6)</span>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>-{payslipData.advance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Late deduction</span>
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>-{payslipData.lateDeduction.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Income tax</span>
                      <span className="muted">0.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">Reimbursement (exp.)</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>+{payslipData.reimbursement.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px dashed var(--line, #E4EEF3)', fontWeight: 700 }}>
                      <span>Net adjust.</span>
                      <span style={{ color: '#ef4444' }}>-{Math.abs(payslipData.netAdjust).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Highlighted Net Pay Box */}
              <div
                style={{
                  background: 'rgba(0, 184, 219, 0.08)',
                  border: '1px solid rgba(0, 184, 219, 0.25)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--muted, #4a5565)', fontWeight: 500 }}>
                    Net pay credited · {payslipData.bankName} ****{payslipData.bankLast4}
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink, #101828)', marginTop: 2, letterSpacing: '-0.02em' }}>
                    {formatAed(payslipData.netPay)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setViewPayslipModalOpen(true)}
                    style={{
                      background: 'var(--surface, #ffffff)',
                      border: '1px solid var(--line, #cbd5e1)',
                      color: 'var(--ink, #101828)',
                      padding: '7px 12px',
                      borderRadius: 8,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintPayslip}
                    style={{
                      background: '#00b8db',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 14px',
                      borderRadius: 8,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Previous payslips list */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line, #E4EEF3)', fontSize: '11.5px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted, #4a5565)', textTransform: 'uppercase', marginBottom: 8 }}>
                Previous payslips
              </div>
              <div className="muted" style={{ padding: '8px 0', textAlign: 'center', fontSize: '12px' }}>
                No previous payslips recorded
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. MIDDLE & LOWER CARDS (My Requests, My Documents, Holidays, Team, Announcements)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {/* Card 1: My requests */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                My requests
              </h3>
              <Link href="/leaves" style={{ fontSize: '12px', fontWeight: 700, color: '#00b8db', textDecoration: 'none' }}>
                View all
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {pendingRequestsList.length > 0 ? (
                pendingRequestsList.slice(0, 4).map((req) => {
                  let badgeBg = '#eff6ff';
                  let badgeColor = '#2563eb';
                  if (req.statusKey === 'pending') {
                    badgeBg = '#fef3c7';
                    badgeColor = '#d97706';
                  } else if (req.statusKey === 'approved') {
                    badgeBg = '#ecfdf5';
                    badgeColor = '#059669';
                  } else if (req.statusKey === 'rejected') {
                    badgeBg = '#fee2e2';
                    badgeColor = '#dc2626';
                  }

                  return (
                    <div
                      key={req.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        background: 'var(--surface-alt, #EEF9FC)',
                        border: '1px solid var(--line, #E4EEF3)',
                        borderRadius: 10,
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink, #101828)' }}>
                          {req.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted, #4a5565)', marginTop: 2 }}>
                          {req.date} · {req.note}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: badgeBg,
                          color: badgeColor,
                          padding: '3px 8px',
                          borderRadius: 999,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {req.status}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="muted" style={{ textAlign: 'center', padding: '36px 10px', fontSize: '13px' }}>
                  No requests submitted yet.
                </div>
              )}
            </div>
          </div>

          {/* Card 2: My documents (With Empty State Rule) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                  My documents
                </h3>
                <Link href="/profile" style={{ fontSize: '12px', fontWeight: 700, color: '#00b8db', textDecoration: 'none' }}>
                  Upload
                </Link>
              </div>

              {allEmployeeDocuments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {allEmployeeDocuments.slice(0, 5).map((doc) => {
                    const expStr = doc.expiryDate || doc.expiry_date;
                    const d = expStr ? new Date(expStr) : null;
                    const diffDays = d && !isNaN(d.getTime()) ? Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 365;

                    let badgeBg = '#ecfdf5';
                    let badgeColor = '#059669';
                    let badgeText = 'Valid';

                    if (diffDays <= 0) {
                      badgeBg = '#fee2e2';
                      badgeColor = '#dc2626';
                      badgeText = 'Expired';
                    } else if (diffDays <= 60) {
                      badgeBg = '#fef3c7';
                      badgeColor = '#d97706';
                      badgeText = `${diffDays} days`;
                    } else if (diffDays <= 180) {
                      badgeBg = '#eff6ff';
                      badgeColor = '#2563eb';
                      badgeText = `${diffDays} days`;
                    }

                    return (
                      <div
                        key={doc.id || doc.title}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          padding: '7px 0',
                          borderBottom: '1px solid var(--line, #f1f5f9)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--ink, #101828)' }}>{doc.title || doc.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted, #4a5565)', marginTop: 2 }}>{doc.plan || 'Verified by HR'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11.5px', color: 'var(--ink, #101828)', fontWeight: 600 }}>{formatDate(expStr)}</div>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              background: badgeBg,
                              color: badgeColor,
                              padding: '2px 7px',
                              borderRadius: 999,
                              marginTop: 2,
                              display: 'inline-block',
                            }}
                          >
                            {badgeText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="muted" style={{ textAlign: 'center', padding: '36px 10px', fontSize: '13px' }}>
                  No documents uploaded yet.
                </div>
              )}
            </div>

            {allEmployeeDocuments.length > 0 ? (
              <div
                style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  fontSize: '11px',
                  color: '#92400e',
                  lineHeight: 1.35,
                }}
              >
                ⚠️ HR will start your insurance renewal 30 days before expiry — no action needed.
              </div>
            ) : null}
          </div>

          {/* Card 3: Upcoming public holidays (UAE Official) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                Upcoming public holidays
              </h3>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#00b8db', background: 'rgba(0, 184, 219, 0.1)', padding: '2px 7px', borderRadius: 999 }}>
                UAE
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {publicHolidays.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--surface-alt, #EEF9FC)',
                    border: '1px solid var(--line, #E4EEF3)',
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      padding: '4px 0',
                      borderRadius: 8,
                      background: 'rgba(0, 184, 219, 0.12)',
                      color: '#00b8db',
                      textAlign: 'center',
                      fontWeight: 800,
                      fontSize: '11px',
                      flexShrink: 0,
                    }}
                  >
                    {h.code}
                  </div>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>{h.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted, #4a5565)', marginTop: 2 }}>{h.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =========================================================================
            6. MY TEAM & ANNOUNCEMENTS ROW (Fully Dynamic — Zero Dummy Data)
           ========================================================================= */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {/* Card 4: My team */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 270,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                My team
              </h3>
              <Link href="/profile" style={{ fontSize: '12px', fontWeight: 700, color: '#00b8db', textDecoration: 'none' }}>
                Directory
              </Link>
            </div>

            {managerData || teamOnLeave.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                {managerData ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--surface-alt, #EEF9FC)',
                      border: '1px solid var(--line, #E4EEF3)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: getAvatarColor(managerData.fullName || managerData.full_name, 0),
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '13px',
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(managerData.fullName || managerData.full_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--muted, #4a5565)', textTransform: 'uppercase' }}>
                          My Manager
                        </div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #101828)', marginTop: 2 }}>
                          {managerData.fullName || managerData.full_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted, #4a5565)' }}>
                          {managerData.jobTitle || 'Department Lead'} · {managerData.departmentName || 'Operations'}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`mailto:${managerData.email || 'manager@company.com'}`}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        background: 'var(--surface, #ffffff)',
                        border: '1px solid var(--line, #cbd5e1)',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--ink, #101828)',
                        textDecoration: 'none',
                      }}
                    >
                      Message
                    </a>
                  </div>
                ) : null}

                {teamOnLeave.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted, #4a5565)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Team on leave
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {teamOnLeave.map((tm, idx) => (
                        <div key={tm.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: getAvatarColor(tm.name, idx + 1),
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '11px',
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(tm.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--ink, #101828)' }}>{tm.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted, #4a5565)' }}>
                                {tm.leaveType} · back {tm.endDate}
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#2563eb',
                              padding: '2px 8px',
                              borderRadius: 999,
                            }}
                          >
                            {tm.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="muted" style={{ textAlign: 'center', padding: '36px 0', fontSize: '12.5px' }}>
                You are not currently assigned to a department team.
              </div>
            )}
          </div>

          {/* Card 5: Announcements (Live Synced with Admin Portal) */}
          <div
            className="admin-card-hover"
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 270,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                Announcements
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto', maxHeight: 220 }}>
              {announcements.length > 0 ? (
                announcements.map((ann, idx) => {
                  const c = getCategoryColor(ann.category);

                  return (
                    <div
                      key={ann.id || idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'var(--surface, #ffffff)',
                        border: '1px solid var(--line, #e2e8f0)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: c.text,
                            background: c.bg,
                            border: `1px solid ${c.border}`,
                            padding: '2.5px 8px',
                            borderRadius: 5,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {ann.category || 'General'}
                        </span>
                        <span className="muted" style={{ fontSize: '10.5px' }}>
                          {formatDate(ann.createdAt || ann.created_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                        {ann.title}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--muted, #4a5565)', marginTop: 3, lineHeight: 1.35 }}>
                        {ann.content || ann.description}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="muted" style={{ textAlign: 'center', padding: '36px 0', fontSize: '12.5px' }}>
                  No announcements posted yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            7. BOTTOM BANNER: END-OF-SERVICE BENEFIT (EOSB / GRATUITY)
           ========================================================================= */}
        <div
          className="admin-card-hover"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 184, 219, 0.08) 0%, var(--surface, #ffffff) 100%)',
            border: '1px solid rgba(0, 184, 219, 0.25)',
            borderRadius: 16,
            padding: '20px 24px',
            boxShadow: '0 2px 8px rgba(0, 184, 219, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: '75%' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#00b8db',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(0, 184, 219, 0.35)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--ink, #101828)' }}>
                My estimated gratuity (end-of-service benefit)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted, #4a5565)', marginTop: 3, lineHeight: 1.45 }}>
                Joined <strong>{gratuityData.joinedFormatted}</strong> · Service <strong>{gratuityData.years} yrs {gratuityData.months} mos</strong> · Basic salary <strong>{formatAed(gratuityData.basicSalary)}/month</strong> ({formatAed(gratuityData.dailyRate)}/day). Calculated as 21 days/yr (first 5 yrs) and 30 days thereafter per UAE Labour Law (Federal Decree-Law 33/2021); final amount is confirmed by HR at exit.
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted, #4a5565)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Accrued to date
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#00b8db', marginTop: 2, letterSpacing: '-0.02em' }}>
              {formatAed(gratuityData.accruedTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: NEW REQUEST MODAL
         ========================================================================= */}
      {newRequestModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 11, 31, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setNewRequestModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 480,
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--ink, #101828)' }}>
                Submit a new request
              </h3>
              <button
                type="button"
                onClick={() => setNewRequestModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted, #4a5565)' }}
              >
                ✕
              </button>
            </div>

            {actionSuccessMsg ? (
              <div style={{ padding: '12px 14px', borderRadius: 8, background: '#ecfdf5', color: '#059669', fontWeight: 600, fontSize: '13px', marginBottom: 16 }}>
                ✓ {actionSuccessMsg}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setQuickRequestType('leave')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: quickRequestType === 'leave' ? '1.5px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                  background: quickRequestType === 'leave' ? 'rgba(0, 184, 219, 0.1)' : 'var(--surface-alt, #EEF9FC)',
                  color: quickRequestType === 'leave' ? '#00b8db' : 'var(--ink, #101828)',
                }}
              >
                🌴 Leave Request
              </button>
              <button
                type="button"
                onClick={() => setQuickRequestType('letter')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: quickRequestType === 'letter' ? '1.5px solid #00b8db' : '1px solid var(--line, #cbd5e1)',
                  background: quickRequestType === 'letter' ? 'rgba(0, 184, 219, 0.1)' : 'var(--surface-alt, #EEF9FC)',
                  color: quickRequestType === 'letter' ? '#00b8db' : 'var(--ink, #101828)',
                }}
              >
                📄 Salary Cert. / Letter
              </button>
            </div>

            {quickRequestType === 'leave' ? (
              <form onSubmit={handleSubmitQuickLeave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>Leave Type</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                  >
                    <option value="Annual">Annual Leave (18 days left)</option>
                    <option value="Sick">Sick Leave (86 days left)</option>
                    <option value="Compassionate">Compassionate Leave (5 days)</option>
                    <option value="Unpaid">Unpaid Leave</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>Start Date</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>End Date</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>Reason</label>
                  <textarea
                    rows={3}
                    placeholder="Provide details about your leave request..."
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setNewRequestModalOpen(false)}
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#00b8db', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                  >
                    Submit request
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setActionSuccessMsg('Salary certificate requested! Document will be digitally signed by HR.');
                  setTimeout(() => {
                    setNewRequestModalOpen(false);
                    setActionSuccessMsg('');
                  }, 1400);
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>Letter Type</label>
                  <select
                    value={certForm.certType}
                    onChange={(e) => setCertForm({ ...certForm, certType: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                  >
                    <option value="Salary Certificate">Salary Certificate (Bank addressed)</option>
                    <option value="NOC">No Objection Certificate (NOC - Visa/Travel)</option>
                    <option value="Experience Letter">Experience & Service Letter</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>Addressed to / Purpose</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abu Dhabi Commercial Bank (ADCB)"
                    value={certForm.purpose}
                    onChange={(e) => setCertForm({ ...certForm, purpose: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setNewRequestModalOpen(false)}
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#00b8db', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                  >
                    Generate letter request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {/* =========================================================================
          MODAL 2: ATTENDANCE CORRECTION MODAL
         ========================================================================= */}
      {correctionModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 11, 31, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setCorrectionModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 440,
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--ink, #101828)' }}>
                Request attendance regularisation
              </h3>
              <button
                type="button"
                onClick={() => setCorrectionModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted, #4a5565)' }}
              >
                ✕
              </button>
            </div>

            {actionSuccessMsg ? (
              <div style={{ padding: '12px 14px', borderRadius: 8, background: '#ecfdf5', color: '#059669', fontWeight: 600, fontSize: '13px', marginBottom: 16 }}>
                ✓ {actionSuccessMsg}
              </div>
            ) : null}

            <form onSubmit={handleSubmitCorrection} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>Correction Date</label>
                <input
                  type="date"
                  required
                  value={correctionForm.date}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>Actual In Time</label>
                  <input
                    type="time"
                    required
                    value={correctionForm.checkIn}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, checkIn: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>Actual Out Time</label>
                  <input
                    type="time"
                    required
                    value={correctionForm.checkOut}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, checkOut: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 5 }}>Reason / Justification</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Geofence scanner glitch at reception / Client meeting off-site"
                  value={correctionForm.reason}
                  onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'var(--surface, #ffffff)', color: 'var(--ink, #101828)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setCorrectionModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#00b8db', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
                >
                  Submit regularisation
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* =========================================================================
          MODAL 3: VIEW PAYSLIP DETAIL MODAL
         ========================================================================= */}
      {viewPayslipModalOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 11, 31, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setViewPayslipModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 540,
              padding: '26px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--ink, #101828)' }}>
                  Payslip Breakdown · {payslipData.monthLabel}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--muted, #4a5565)', marginTop: 2 }}>
                  {employeeName} · {employeeProfile?.empCode || 'EMP-0101'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewPayslipModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted, #4a5565)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface-alt, #EEF9FC)', border: '1px solid var(--line, #E4EEF3)', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="muted">Payment Channel:</span>
                  <strong>UAE WPS (MOHRE compliant)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="muted">Credited to:</span>
                  <strong>{payslipData.bankName} (IBAN ending in {payslipData.bankLast4})</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted">Status:</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>✓ Verified & Paid</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Basic salary:</span>
                  <strong>{formatAed(payslipData.basic)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Housing allowance:</span>
                  <strong>{formatAed(payslipData.housing)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Transport allowance:</span>
                  <strong>{formatAed(payslipData.transport)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mobile allowance:</span>
                  <strong>{formatAed(payslipData.mobile)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                  <span>Salary advance installment:</span>
                  <strong>-{formatAed(payslipData.advance)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                  <span>Late check-in deduction:</span>
                  <strong>-{formatAed(payslipData.lateDeduction)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                  <span>Expense claim reimbursement:</span>
                  <strong>+{formatAed(payslipData.reimbursement)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '2px solid var(--line, #E4EEF3)', fontSize: '15px', fontWeight: 800 }}>
                  <span>Total Net Payable:</span>
                  <span style={{ color: '#00b8db' }}>{formatAed(payslipData.netPay)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setViewPayslipModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--line, #cbd5e1)', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrintPayslip}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#00b8db',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Download / Print PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}
