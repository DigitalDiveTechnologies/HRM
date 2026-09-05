'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell, { Badge } from '../../components/AppShell';
import EmployeeMasterForm from '../../components/EmployeeMasterForm';
import { api, apiBlob, apiUpload, getApiBase, getUser, normalizeRole } from '../../lib/auth';
import {
  emptyMasterForm,
  masterFormFromEmployee,
  masterPayloadFromForm,
} from '../../lib/employeeMaster';
import { formatDate, v } from '../../lib/format';

function EmployeesContent() {
  const role = normalizeRole(getUser());
  const isAdmin = role === 'admin';
  const [rows, setRows] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_employees');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [chart, setChart] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_org');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [loadingEmps, setLoadingEmps] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('gocs_cached_employees');
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch {}
    }
    return true;
  });
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [masterForm, setMasterForm] = useState(emptyMasterForm());
  const [savingEdit, setSavingEdit] = useState(false);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [createForm, setCreateForm] = useState(emptyMasterForm());
  const [creating, setCreating] = useState(false);
  const [createLoginPopup, setCreateLoginPopup] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Profile View multi-tab state (matching reference screenshot)
  const [selectedTab, setSelectedTab] = useState('Personal info');
  const [empPayslips, setEmpPayslips] = useState([]);
  const [empDocuments, setEmpDocuments] = useState([]);
  const [empLeaves, setEmpLeaves] = useState([]);
  const [empBalances, setEmpBalances] = useState([]);
  const [empAttendance, setEmpAttendance] = useState([]);
  const [loadingTabDetails, setLoadingTabDetails] = useState(false);

  // Table search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [histForm, setHistForm] = useState({
    jobTitle: '',
    departmentName: '',
    managerName: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  const searchParams = useSearchParams();
  const queryId = searchParams ? searchParams.get('id') : null;

  useEffect(() => {
    if (queryId && rows.length) {
      const found = rows.find((r) => String(v(r, 'id')) === String(queryId));
      if (found) {
        openDetail(found);
        setTimeout(() => {
          const el = document.getElementById('employee-profile-detail');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    }
  }, [queryId, rows]);

  // Calculate next sequential employee code (e.g. DD-1015)
  const calculateNextCode = (list) => {
    let maxNum = 1000;
    (list || []).forEach((e) => {
      const code = String(v(e, 'empCode', 'emp_code') || '');
      const match = code.match(/(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `DD-${maxNum + 1}`;
  };

  const load = useCallback(() => {
    // 1. Prioritized immediate load for Employees table
    api('/employees')
      .then((emps) => {
        const list = emps || [];
        setRows(list);
        setLoadingEmps(false);
        try {
          localStorage.setItem('gocs_cached_employees', JSON.stringify(list));
        } catch {}
        setCreateForm((prev) => ({
          ...prev,
          empCode: prev.empCode || calculateNextCode(list),
        }));
      })
      .catch((e) => {
        setError(e.message);
        setLoadingEmps(false);
      });

    // 2. Load Org Chart concurrently
    api('/org/chart')
      .then((org) => {
        const o = org || [];
        setChart(o);
        try {
          localStorage.setItem('gocs_cached_org', JSON.stringify(o));
        } catch {}
      })
      .catch(() => {});

    // 3. Load Admin dropdown masters in background
    if (isAdmin) {
      Promise.all([
        api('/employees/departments'),
        api('/divisions?activeOnly=true'),
        api('/designations?activeOnly=true'),
        api('/employment-types?activeOnly=true'),
      ])
        .then(([depts, divs, desigs, empTypes]) => {
          if (depts) setDepartments(depts || []);
          if (divs) setDivisions(divs || []);
          if (desigs) setDesignations(desigs || []);
          if (empTypes) setEmploymentTypes(empTypes || []);
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(e) {
    const empId = String(v(e, 'id'));
    setSelected(e);
    setIsEditingProfile(false);
    setSelectedTab('Personal info');
    setMasterForm(masterFormFromEmployee(e));
    setLoadingTabDetails(true);

    try {
      const [fullRes, histRes, payRes, docRes, leaveRes, balRes, attRes] = await Promise.allSettled([
        api(`/employees/${empId}`),
        api(`/org/history/${empId}`),
        api('/payroll'),
        api('/documents'),
        api('/leave'),
        api('/leave/balances'),
        api('/attendance'),
      ]);

      if (fullRes.status === 'fulfilled' && fullRes.value) {
        setSelected(fullRes.value);
        setMasterForm(masterFormFromEmployee(fullRes.value));
      }
      if (histRes.status === 'fulfilled') {
        setHistory(histRes.value || []);
      }
      if (payRes.status === 'fulfilled' && Array.isArray(payRes.value)) {
        setEmpPayslips(payRes.value.filter((p) => String(v(p, 'employeeId', 'employee_id')) === empId));
      }
      if (docRes.status === 'fulfilled' && Array.isArray(docRes.value)) {
        setEmpDocuments(docRes.value.filter((d) => String(v(d, 'employeeId', 'employee_id')) === empId));
      }
      if (leaveRes.status === 'fulfilled' && Array.isArray(leaveRes.value)) {
        setEmpLeaves(leaveRes.value.filter((l) => String(v(l, 'employeeId', 'employee_id')) === empId));
      }
      if (balRes.status === 'fulfilled' && Array.isArray(balRes.value)) {
        setEmpBalances(balRes.value.filter((b) => String(v(b, 'employeeId', 'employee_id')) === empId));
      }
      if (attRes.status === 'fulfilled' && Array.isArray(attRes.value)) {
        setEmpAttendance(attRes.value.filter((a) => String(v(a, 'employeeId', 'employee_id')) === empId));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTabDetails(false);
    }
  }

  async function addHistory(ev) {
    ev.preventDefault();
    if (!selected) return;
    try {
      await api('/org/history', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(v(selected, 'id')),
          ...histForm,
          endDate: histForm.endDate || null,
        }),
      });
      setHistForm({ jobTitle: '', departmentName: '', managerName: '', startDate: '', endDate: '', notes: '' });
      openDetail(selected);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createEmployee(ev) {
    ev.preventDefault();
    setError('');
    setMsg('');
    setCreating(true);
    try {
      const payload = masterPayloadFromForm(createForm, { includePassword: true });
      const res = await api('/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const empId = v(res.employee, 'id');
      const appEmail = String(res.login?.email || createForm.email || '')
        .trim()
        .toLowerCase();
      const appPassword = String(createForm.password || 'demo123').trim();
      const employeeName =
        v(res.employee, 'fullName', 'full_name') ||
        createForm.fullName ||
        [createForm.firstName, createForm.lastName].filter(Boolean).join(' ') ||
        'Employee';
      if (createForm.photoFile && empId) {
        const fd = new FormData();
        fd.append('file', createForm.photoFile);
        await apiUpload(`/employees/${empId}/photo`, fd);
      }
      setCreateLoginPopup({
        name: employeeName,
        email: appEmail,
        password: appPassword,
      });
      setMsg(`Employee created: ${employeeName}`);
      if (createForm.photoPreview) {
        try {
          URL.revokeObjectURL(createForm.photoPreview);
        } catch {
          /* ignore */
        }
      }
      setCreateForm(emptyMasterForm());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function saveEmployeeEdit(ev) {
    ev.preventDefault();
    if (!selected) return;
    setError('');
    setMsg('');
    setSavingEdit(true);
    try {
      const payload = masterPayloadFromForm(masterForm);
      const res = await api(`/employees/${v(selected, 'id')}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (masterForm.photoFile) {
        const fd = new FormData();
        fd.append('file', masterForm.photoFile);
        await apiUpload(`/employees/${v(selected, 'id')}/photo`, fd);
      }
      setMsg(res.message || 'Employee updated.');
      const updated = await api(`/employees/${v(selected, 'id')}`);
      setSelected(updated);
      setMasterForm(masterFormFromEmployee(updated));
      setIsEditingProfile(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }


  async function resetAppPassword(ev) {
    ev.preventDefault();
    if (!selected || !resetPassword.trim()) return;
    setError('');
    setMsg('');
    setResetting(true);
    try {
      const res = await api(`/employees/${v(selected, 'id')}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: resetPassword.trim() }),
      });
      setMsg(res.message || 'App login password updated successfully.');
      setResetPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  // Filtered employees list
  const filteredRows = useMemo(() => {
    return rows.filter((e) => {
      const search = searchTerm.toLowerCase();
      const code = String(v(e, 'empCode', 'emp_code') || '').toLowerCase();
      const name = String(v(e, 'fullName', 'full_name') || '').toLowerCase();
      const email = String(v(e, 'email') || '').toLowerCase();
      const title = String(v(e, 'jobTitle', 'job_title') || '').toLowerCase();

      const matchesSearch = !search || code.includes(search) || name.includes(search) || email.includes(search) || title.includes(search);
      const matchesCompany = !filterCompany || String(v(e, 'divisionId', 'division_id')) === String(filterCompany);
      const matchesDept = !filterDept || String(v(e, 'departmentId', 'department_id')) === String(filterDept);
      const matchesStatus = !filterStatus || String(v(e, 'status')).toLowerCase() === filterStatus.toLowerCase();

      return matchesSearch && matchesCompany && matchesDept && matchesStatus;
    });
  }, [rows, searchTerm, filterCompany, filterDept, filterStatus]);

  // Hierarchical Org Chart (Modern Concentric Avatars with Dotted Directional Connectors)
  const childrenOf = useCallback((id) => chart.filter((c) => String(v(c, 'managerId', 'manager_id')) === String(id)), [chart]);

  // Leadership roots: nodes with direct reports whose manager is null or not found in chart
  const leadershipRoots = useMemo(() => {
    const withKids = chart.filter((c) => childrenOf(v(c, 'id')).length > 0);
    const rootsWithKids = withKids.filter((c) => {
      const mId = v(c, 'managerId', 'manager_id');
      return !mId || !chart.some((other) => String(v(other, 'id')) === String(mId));
    });
    if (rootsWithKids.length) return rootsWithKids;
    const anyRoots = chart.filter((c) => !v(c, 'managerId', 'manager_id'));
    return anyRoots.length ? anyRoots : chart.slice(0, 1);
  }, [chart, childrenOf]);

  // Individual contributors: employees with no manager and 0 direct reports
  const individualStaff = useMemo(() => {
    return chart.filter((c) => {
      const mId = v(c, 'managerId', 'manager_id');
      const hasKids = childrenOf(v(c, 'id')).length > 0;
      return !mId && !hasKids;
    });
  }, [chart, childrenOf]);

  const chartContainerRef = useRef(null);
  const [connectorLines, setConnectorLines] = useState([]);

  const updateConnectorLines = useCallback(() => {
    if (!chartContainerRef.current) return;
    const contRect = chartContainerRef.current.getBoundingClientRect();
    const lines = [];

    chart.forEach((node) => {
      const nodeId = v(node, 'id');
      const textEl = document.getElementById(`org-text-${nodeId}`);
      if (!textEl) return;

      const kids = childrenOf(nodeId);
      kids.forEach((child) => {
        const childId = v(child, 'id');
        const childAvatarEl = document.getElementById(`org-avatar-${childId}`);
        if (!childAvatarEl) return;

        const pRect = textEl.getBoundingClientRect();
        const cRect = childAvatarEl.getBoundingClientRect();

        const x1 = pRect.left + pRect.width / 2 - contRect.left;
        const y1 = pRect.bottom - contRect.top + 4;
        const x2 = cRect.left + cRect.width / 2 - contRect.left;
        const y2 = cRect.top - contRect.top - 2;

        lines.push({ x1, y1, x2, y2, key: `${nodeId}-${childId}` });
      });
    });

    setConnectorLines(lines);
  }, [chart, childrenOf]);

  useEffect(() => {
    updateConnectorLines();
    const t1 = setTimeout(updateConnectorLines, 100);
    const t2 = setTimeout(updateConnectorLines, 400);
    window.addEventListener('resize', updateConnectorLines);

    let ro;
    if (typeof ResizeObserver !== 'undefined' && chartContainerRef.current) {
      ro = new ResizeObserver(updateConnectorLines);
      ro.observe(chartContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updateConnectorLines);
      if (ro) ro.disconnect();
    };
  }, [updateConnectorLines]);

  function OrgNodeView({ node }) {
    const kids = childrenOf(v(node, 'id'));
    const title = v(node, 'jobTitle', 'job_title') || v(node, 'fullName', 'full_name') || 'Employee';
    const name = v(node, 'fullName', 'full_name');
    const dept = v(node, 'departmentName', 'department_name');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        {/* Concentric Dual-Ring Avatar Node (Matching Client Screenshot) */}
        <div
          onClick={() => openDetail(node)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: 3,
          }}
          title={`Click to view profile of ${name}`}
        >
          {/* Outer Concentric Ring */}
          <div
            id={`org-avatar-${v(node, 'id')}`}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '1.5px solid rgba(0, 184, 219, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 3,
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.borderColor = '#00b8db';
              e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 184, 219, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = 'rgba(0, 184, 219, 0.45)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Inner Circle with Solid Silhouette Persona Icon (Matching Image 1) */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                border: '2px solid #00b8db',
                boxShadow: '0 4px 10px rgba(15, 23, 42, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          </div>

          {/* Role & Name beneath Circle (Arrow starts under this container) */}
          <div id={`org-text-${v(node, 'id')}`} style={{ textAlign: 'center', marginTop: 8, maxWidth: 140 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #0f172a)', lineHeight: 1.25 }}>
              {title}
            </div>
            {name && name !== title ? (
              <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 2 }}>{name}</div>
            ) : null}
            {dept ? (
              <div style={{ fontSize: '9.5px', color: '#008fa8', fontWeight: 600, marginTop: 2 }}>{dept}</div>
            ) : null}
          </div>
        </div>

        {/* Children Row with Natural Angled Branches */}
        {kids.length > 0 ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 48,
              marginTop: 38,
              zIndex: 2,
              position: 'relative',
            }}
          >
            {kids.map((child) => (
              <OrgNodeView key={v(child, 'id')} node={child} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // Selected Employee Master Data helper
  const selectedMd = useMemo(() => {
    if (!selected) return {};
    const raw = v(selected, 'masterData', 'master_data');
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  }, [selected]);

  const selectedPhotoUrl = useMemo(() => {
    if (!selected) return null;
    const p = v(selected, 'photoPath', 'photo_path');
    if (!p) return null;
    return `${getApiBase().replace(/\/api\/?$/, '')}/${p.replace(/^\//, '')}`;
  }, [selected]);

  return (
    <AppShell title="Employee Information" subtitle="Profiles, org chart, employment history, ID / passport / visa">
      {error ? <div className="error">{error}</div> : null}
      {msg ? <div className="success">{msg}</div> : null}

      {/* Login Popup for newly created employee */}
      {createLoginPopup ? (
        <>
          <div
            className="backdrop show"
            onClick={() => setCreateLoginPopup(null)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-login-title"
            style={{
              position: 'fixed',
              left: '50%',
              top: '12%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              width: 'min(440px, calc(100vw - 32px))',
              background: 'var(--card, #fff)',
              border: '1px solid var(--border, #d7e3ef)',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(2, 11, 31, 0.2)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                ✓
              </div>
              <h3 id="create-login-title" style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: 'var(--ink)' }}>
                Employee Created
              </h3>
            </div>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: '13px' }}>
              <strong>{createLoginPopup.name}</strong> has been registered. The employee can use these credentials to log in to the mobile application:
            </p>
            <div className="stack" style={{ gap: 10, marginBottom: 18, background: 'var(--surface-alt)', padding: '14px', borderRadius: 8, border: '1px solid var(--line)' }}>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>App Login Email</span>
                <input readOnly value={createLoginPopup.email} style={{ fontWeight: 700, background: 'var(--surface)' }} />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>App Login Password</span>
                <input readOnly value={createLoginPopup.password} style={{ fontWeight: 700, background: 'var(--surface)', color: '#008fa8' }} />
              </label>
            </div>
            <button
              type="button"
              className="btn block"
              onClick={() => setCreateLoginPopup(null)}
              style={{ background: '#00b8db', color: '#ffffff', fontWeight: 700, borderRadius: 8 }}
            >
              Done & Close
            </button>
          </div>
        </>
      ) : null}

      {/* =========================================================================
          1. ALL EMPLOYEES LIST TABLE (Ultra-Clean, Filters & Search - NO AVATARS)
         ========================================================================= */}
      <div id="all-employees" className="card" style={{ marginBottom: 20, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>All Employees {loadingEmps && !filteredRows.length ? '' : `(${filteredRows.length})`}</span>
              {loadingEmps && !filteredRows.length ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 13,
                    height: 13,
                    border: '2px solid rgba(0, 184, 219, 0.3)',
                    borderTopColor: '#00b8db',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                  title="Loading..."
                />
              ) : null}
            </h3>
            <p className="muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
              Click any employee row to open their profile details & edit credentials
            </p>
          </div>

          {/* Quick Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search code, name, email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                fontSize: '12.5px',
                padding: '6px 12px',
                borderRadius: 6,
                minWidth: 220,
                border: '1px solid var(--line-strong, #d0d5dd)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />

            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
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
              <option value="">All Companies</option>
              {divisions.map((d) => (
                <option key={v(d, 'id')} value={v(d, 'id')}>
                  {v(d, 'name')}
                </option>
              ))}
            </select>

            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
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
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={v(d, 'id')} value={v(d, 'id')}>
                  {v(d, 'name')}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
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
              <option value="active">Active</option>
              <option value="onboarding">Onboarding</option>
              <option value="exited">Exited</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '85px' }}>Code</th>
                <th>Employee Name</th>
                <th>Company</th>
                <th>Department</th>
                <th>Job Title</th>
                <th>Manager</th>
                <th>Join Date</th>
                <th>Passport Exp</th>
                <th>Visa Exp</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((e) => {
                const isSelected = selected && String(v(selected, 'id')) === String(v(e, 'id'));

                return (
                  <tr
                    key={v(e, 'id')}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(0, 184, 219, 0.08)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    onClick={() => openDetail(e)}
                  >
                    <td>
                      <strong style={{ color: '#008fa8' }}>{v(e, 'empCode', 'emp_code')}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{v(e, 'fullName', 'full_name')}</div>
                      <div className="muted" style={{ fontSize: '11.5px' }}>{v(e, 'email')}</div>
                    </td>
                    <td>{v(e, 'divisionName', 'division_name') || '-'}</td>
                    <td>{v(e, 'departmentName', 'department_name') || '-'}</td>
                    <td>{v(e, 'jobTitle', 'job_title') || '-'}</td>
                    <td>{v(e, 'managerName', 'manager_name') || '—'}</td>
                    <td>{formatDate(v(e, 'joinDate', 'join_date', 'hireDate', 'hire_date')) || '-'}</td>
                    <td>{formatDate(v(e, 'passportExpiry', 'passport_expiry')) || '-'}</td>
                    <td>{formatDate(v(e, 'visaExpiry', 'visa_expiry')) || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge status={v(e, 'status')} />
                    </td>
                  </tr>
                );
              })}
              {loadingEmps && !filteredRows.length ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px 16px' }} className="muted">
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          border: '2.5px solid rgba(0, 184, 219, 0.25)',
                          borderTopColor: '#00b8db',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>Loading employees...</span>
                    </div>
                  </td>
                </tr>
              ) : !filteredRows.length ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }} className="muted">
                    No employees matching current filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          2. CREATE EMPLOYEE FORM (Clean 3-Section + Step 1 Company Selection)
         ========================================================================= */}
      {isAdmin ? (
        <div className="card emp-master-card" style={{ marginBottom: 18, padding: '20px' }}>
          <div className="panel-title" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>Create New Employee</h3>
              <p className="muted" style={{ fontSize: '12.5px', margin: '2px 0 0' }}>
                Select operating company, assign official designation, and enter personal and UAE travel credentials
              </p>
            </div>
          </div>
          <EmployeeMasterForm
            mode="create"
            form={createForm}
            setForm={setCreateForm}
            departments={departments}
            divisions={divisions}
            designations={designations}
            employmentTypes={employmentTypes}
            managers={rows}
            saving={creating}
            onSubmit={createEmployee}
          />
        </div>
      ) : null}


      {/* =========================================================================
          3. ORG CHART (Concentric Dual-Ring Avatars with Cyan Connector Arrows)
         ========================================================================= */}
      <div className="card" style={{ marginBottom: 18, padding: '24px 20px', overflowX: 'auto' }}>
        <div className="panel-title" style={{ marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Company Structure</h3>
            <p className="muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
              Hierarchical reporting tree structure
            </p>
          </div>
        </div>

        <div
          ref={chartContainerRef}
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            padding: '24px 16px',
            minWidth: 'max-content',
            margin: '0 auto',
          }}
        >
          {/* Dynamic SVG Dotted Connector Arrows Overlay (Matching Client Screenshot) */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <defs>
              <marker
                id="cyan-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#00b8db" />
              </marker>
            </defs>
            {connectorLines.map((line) => (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#00b8db"
                strokeWidth="1.6"
                strokeDasharray="3 3"
                markerEnd="url(#cyan-arrow)"
              />
            ))}
          </svg>

          {leadershipRoots.length ? (
            <div style={{ display: 'flex', gap: 56, justifyContent: 'center', zIndex: 2 }}>
              {leadershipRoots.map((r) => (
                <OrgNodeView key={v(r, 'id')} node={r} />
              ))}
            </div>
          ) : (
            <div className="muted" style={{ padding: '16px 0' }}>No hierarchy relationships configured yet.</div>
          )}
        </div>

        {/* Individual Contributors / Direct Staff */}
        {individualStaff.length ? (
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed var(--line, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, justifyContent: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00b8db', display: 'inline-block' }}></span>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>
                Direct Staff / Individual Contributors ({individualStaff.length})
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 36 }}>
              {individualStaff.map((staff) => {
                const title = v(staff, 'jobTitle', 'job_title') || v(staff, 'fullName', 'full_name') || 'Staff';
                const name = v(staff, 'fullName', 'full_name');
                const dept = v(staff, 'departmentName', 'department_name');
                return (
                  <div
                    key={v(staff, 'id')}
                    onClick={() => openDetail(staff)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      transition: 'all 0.15s ease',
                      maxWidth: 140,
                    }}
                    title="Click to view employee profile"
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        border: '1.5px solid rgba(0, 184, 219, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 3,
                        boxSizing: 'border-box',
                        marginBottom: 6,
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.08)';
                        e.currentTarget.style.borderColor = '#00b8db';
                        e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 184, 219, 0.45)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.borderColor = 'rgba(0, 184, 219, 0.45)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
                          border: '2px solid #00b8db',
                          boxShadow: '0 4px 10px rgba(15, 23, 42, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', maxWidth: 130 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink, #0f172a)', lineHeight: 1.25 }}>
                        {title}
                      </div>
                      {name && name !== title ? (
                        <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: 2 }}>{name}</div>
                      ) : null}
                      {dept ? (
                        <div style={{ fontSize: '9.5px', color: '#008fa8', fontWeight: 600, marginTop: 2 }}>{dept}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* =========================================================================
          5. EMPLOYEE PROFILE DETAIL VIEW (Exact Reference Screenshot Multi-Tab Design)
         ========================================================================= */}
      {selected ? (
        <div
          id="employee-profile-detail"
          className="card"
          style={{
            marginTop: 24,
            padding: '28px',
            borderRadius: '14px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          }}
        >
          {/* Top Header & Navigation (Matching Screenshot) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: 18,
              marginBottom: 20,
            }}
          >
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Employee
              </h2>
              <div style={{ fontSize: '12px', color: '#008fa8', fontWeight: 600, marginTop: 2 }}>
                Employee / Employee Detail
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Employee Persona Tag (Right side of header) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 12px 4px 6px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '30px',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: selectedPhotoUrl
                      ? `url(${selectedPhotoUrl}) center/cover no-repeat`
                      : 'linear-gradient(135deg, #00b8db 0%, #008fa8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  {!selectedPhotoUrl
                    ? String(v(selected, 'fullName', 'full_name') || 'E')
                        .split(' ')
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                    : null}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
                    {v(selected, 'fullName', 'full_name')}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                    {v(selected, 'jobTitle', 'job_title') || 'Employee'}
                  </div>
                </div>
              </div>

              {isAdmin ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  style={{
                    background: isEditingProfile ? '#f1f5f9' : '#00b8db',
                    color: isEditingProfile ? '#334155' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  {isEditingProfile ? '✕ Cancel Edit' : '✎ Edit Details'}
                </button>
              ) : null}

              <button
                type="button"
                className="btn secondary"
                onClick={() => setSelected(null)}
                style={{
                  fontSize: '12.5px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>

          {/* Horizontal Tabs Navigation Bar (Exact Screenshot Structure) */}
          <div
            style={{
              display: 'flex',
              gap: '26px',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '20px',
              overflowX: 'auto',
            }}
          >
            {[
              { id: 'Personal info', label: 'Personal info' },
              { id: 'Employee details', label: 'Employee details' },
              { id: 'Payroll', label: 'Payroll' },
              { id: 'Documents', label: 'Documents' },
              { id: 'Leave history', label: 'Leave history' },
              { id: 'Attendance', label: 'Attendance' },
            ].map((tab) => {
              const isActive = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSelectedTab(tab.id);
                    setIsEditingProfile(false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 4px 12px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#0f172a' : '#64748b',
                    borderBottom: isActive ? '2.5px solid #00b8db' : '2.5px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Subheader section title matching reference screenshot */}
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {isEditingProfile ? `Edit ${selectedTab}` : selectedTab}
            </h3>
          </div>

          {/* EDIT MODE: Render full editable form inside the executive tabs layout */}
          {isEditingProfile ? (
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                  Editing Profile: {v(selected, 'fullName', 'full_name')}
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                  Update employee attributes, job specifications, and travel credentials. Click &quot;Save Changes&quot; to apply.
                </p>
              </div>

              <EmployeeMasterForm
                mode="edit"
                form={masterForm}
                setForm={setMasterForm}
                departments={departments}
                divisions={divisions}
                designations={designations}
                employmentTypes={employmentTypes}
                managers={rows.filter((r) => String(v(r, 'id')) !== String(v(selected, 'id')))}
                saving={savingEdit}
                onSubmit={saveEmployeeEdit}
                onCancel={() => setIsEditingProfile(false)}
              />
            </div>
          ) : (
            /* VIEW MODE: Exact Reference Screenshot Layout */
            <div>
              {/* =========================================================================
                  TAB 1: Personal info (Exact Card 1 Basic Info, Card 2 Address, Card 3 Education)
                 ========================================================================= */}
              {selectedTab === 'Personal info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Basic Information */}
                  <div
                    className="card"
                    style={{
                      padding: '24px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '18px',
                      }}
                    >
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                        Basic information
                      </h4>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(true)}
                          style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '14px' }}
                          title="Edit Basic information"
                        >
                          ✎
                        </button>
                      ) : null}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'center' }}>
                      {/* Left: Avatar & Primary Contact */}
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div
                          style={{
                            width: 88,
                            height: 88,
                            borderRadius: '50%',
                            background: selectedPhotoUrl
                              ? `url(${selectedPhotoUrl}) center/cover no-repeat`
                              : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
                            border: '3px solid #00b8db',
                            boxShadow: '0 2px 8px rgba(0, 184, 219, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            fontWeight: 700,
                            color: '#008fa8',
                            flexShrink: 0,
                          }}
                        >
                          {!selectedPhotoUrl
                            ? String(v(selected, 'fullName', 'full_name') || 'E')
                                .split(' ')
                                .map((p) => p[0])
                                .join('')
                                .slice(0, 2)
                            : null}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>
                              {v(selected, 'fullName', 'full_name')}
                            </h3>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                            {v(selected, 'empCode', 'emp_code') || 'DD-1000'}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                            {/* Gender with icon */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px', color: '#475569' }}>
                              <span>⚥</span>
                              <span>{selectedMd.personal?.gender || selectedMd.gender || 'Not specified'}</span>
                            </div>

                            {/* Email with icon */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px', color: '#475569' }}>
                              <span>✉</span>
                              <span>{v(selected, 'email') || '—'}</span>
                            </div>

                            {/* Phone with icon */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px', color: '#475569' }}>
                              <span>📞</span>
                              <span>{v(selected, 'phone') || selectedMd.mobilePhone || '—'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Personal Attributes (Excludes Place of birth, Blood type, Religion) */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
                        <div>
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>
                            Birth date
                          </div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                            {formatDate(selectedMd.personal?.dateOfBirth || selectedMd.dateOfBirth) || '—'}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>
                            Marital Status
                          </div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                            {selectedMd.personal?.maritalStatus || selectedMd.maritalStatus || '—'}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>
                            Nationality
                          </div>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                            {selectedMd.nationality || selectedMd.personal?.nationality || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cards Grid 2: Address & Education */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                      gap: '20px',
                    }}
                  >
                    {/* Card 2: Address */}
                    <div
                      className="card"
                      style={{
                        padding: '22px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px',
                        }}
                      >
                        <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                          Address
                        </h4>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(true)}
                            style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '14px' }}
                            title="Edit Address"
                          >
                            ✎
                          </button>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>
                            Citizen ID Address / Home Country Address
                          </div>
                          <div style={{ fontSize: '13px', color: '#0f172a', marginTop: 3 }}>
                            {selectedMd.homeCountryAddress || '—'}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>
                            Residential Address / Address in UAE
                          </div>
                          <div style={{ fontSize: '13px', color: '#0f172a', marginTop: 3 }}>
                            {selectedMd.addressInUae || '—'}
                          </div>
                        </div>

                        {selectedMd.currentAddress ? (
                          <div>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>
                              Current Address
                            </div>
                            <div style={{ fontSize: '13px', color: '#0f172a', marginTop: 3 }}>
                              {selectedMd.currentAddress}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Card 3: Education (Timeline Dots Matching Reference Screenshot) */}
                    <div
                      className="card"
                      style={{
                        padding: '22px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px',
                        }}
                      >
                        <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                          Education
                        </h4>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(true)}
                            style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '14px' }}
                            title="Edit Education"
                          >
                            ✎
                          </button>
                        ) : null}
                      </div>

                      {selectedMd.education?.degreeMajor || selectedMd.education?.educationLevel ? (
                        <div style={{ position: 'relative', paddingLeft: 18, borderLeft: '2px solid #00b8db' }}>
                          {/* Dot indicator */}
                          <div
                            style={{
                              position: 'absolute',
                              left: -6,
                              top: 2,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: '#00b8db',
                            }}
                          />
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                            {selectedMd.education.degreeMajor || selectedMd.education.educationLevel}
                            {selectedMd.education.universityName ? ` – ${selectedMd.education.universityName}` : ''}
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: 2 }}>
                            {selectedMd.education.countryOfStudy ? `${selectedMd.education.countryOfStudy} · ` : ''}
                            {selectedMd.education.educationLevel || 'Degree'}
                          </div>
                          {selectedMd.education.gradeGpa ? (
                            <div style={{ fontSize: '12px', color: '#008fa8', fontWeight: 600, marginTop: 2 }}>
                              GPA ({selectedMd.education.gradeGpa})
                            </div>
                          ) : null}
                          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: 2 }}>
                            {selectedMd.education.graduationYear || 'Graduation year not listed'}
                          </div>
                          {selectedMd.education.attestationStatus ? (
                            <div style={{ marginTop: 6 }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: selectedMd.education.attestationStatus.includes('Attested')
                                    ? 'rgba(16, 185, 129, 0.12)'
                                    : '#f1f5f9',
                                  color: selectedMd.education.attestationStatus.includes('Attested')
                                    ? '#10b981'
                                    : '#64748b',
                                }}
                              >
                                {selectedMd.education.attestationStatus}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                          No formal education credentials recorded.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 2: Employee details (Job Profile, Work Exp, App Password Reset, History)
                 ========================================================================= */}
              {selectedTab === 'Employee details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Job & Organization Profile */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px',
                      }}
                    >
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                        Job & Organization Profile
                      </h4>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(true)}
                          style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '14px' }}
                          title="Edit Job Details"
                        >
                          ✎
                        </button>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '14px 20px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Operating Company</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{v(selected, 'divisionName', 'division_name') || '—'}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Department</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{v(selected, 'departmentName', 'department_name') || '—'}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Designation / Job Title</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{v(selected, 'jobTitle', 'job_title') || '—'}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Position / Role Level</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{v(selected, 'position') || selectedMd.position || '—'}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Reporting Manager</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{v(selected, 'managerName', 'manager_name') || '—'}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Employment Type</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{v(selected, 'employmentTypeName', 'employment_type_name') || 'Full-time'}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Joining Date</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{formatDate(v(selected, 'joinDate', 'join_date')) || '—'}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Status</div>
                        <div style={{ marginTop: 2 }}><Badge status={v(selected, 'status')} /></div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Work Experience */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px',
                      }}
                    >
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                        Work Experience
                      </h4>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(true)}
                          style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '14px' }}
                          title="Edit Work Experience"
                        >
                          ✎
                        </button>
                      ) : null}
                    </div>

                    {selectedMd.workExperience?.previousCompany ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                          {selectedMd.workExperience.position || 'Role not specified'}
                        </div>
                        <div style={{ fontSize: '13px', color: '#008fa8', fontWeight: 600 }}>
                          {selectedMd.workExperience.previousCompany}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          Industry: {selectedMd.workExperience.fieldOfWork || '—'} · Duration: {selectedMd.workExperience.duration || '—'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                        No previous work experience recorded.
                      </div>
                    )}
                  </div>

                  {/* Card 3: App Login & Reset Password (Password Reset Lock Intact) */}
                  {isAdmin ? (
                    <div
                      className="card"
                      style={{
                        padding: '22px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>
                        Mobile App Security & Password Reset
                      </h4>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                        Reset mobile app password for <strong>{v(selected, 'email')}</strong>:
                      </p>
                      <form onSubmit={resetAppPassword} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          required
                          type="password"
                          placeholder="Enter new app password (min 6 characters)"
                          minLength={6}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          style={{
                            minWidth: 280,
                            padding: '8.5px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                          }}
                        />
                        <button
                          className="btn"
                          type="submit"
                          disabled={resetting || !resetPassword.trim()}
                          style={{
                            background: '#00b8db',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            padding: '9px 18px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: resetting ? 'wait' : 'pointer',
                          }}
                        >
                          {resetting ? 'Updating…' : 'Update App Password'}
                        </button>
                      </form>
                    </div>
                  ) : null}

                  {/* Card 4: Internal Promotion / Employment History Timeline */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>
                      Internal Employment History
                    </h4>

                    <div className="table-wrap" style={{ marginBottom: 14 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Job Title</th>
                            <th>Department</th>
                            <th>Manager</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h) => (
                            <tr key={v(h, 'id')}>
                              <td style={{ fontWeight: 600 }}>{v(h, 'jobTitle', 'job_title')}</td>
                              <td>{v(h, 'departmentName', 'department_name') || '-'}</td>
                              <td>{v(h, 'managerName', 'manager_name') || '-'}</td>
                              <td>{formatDate(v(h, 'startDate', 'start_date'))}</td>
                              <td>{formatDate(v(h, 'endDate', 'end_date')) || 'Present'}</td>
                            </tr>
                          ))}
                          {!history.length ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: 14, color: '#94a3b8' }}>
                                No internal role history records.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>

                    {isAdmin ? (
                      <form className="stack" onSubmit={addHistory} style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', marginBottom: 8 }}>
                          + Add Role / Promotion History
                        </div>
                        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                          <label className="field" style={{ margin: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Job Title</span>
                            <input required value={histForm.jobTitle} onChange={(e) => setHistForm({ ...histForm, jobTitle: e.target.value })} />
                          </label>
                          <label className="field" style={{ margin: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Department</span>
                            <input value={histForm.departmentName} onChange={(e) => setHistForm({ ...histForm, departmentName: e.target.value })} />
                          </label>
                          <label className="field" style={{ margin: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Manager</span>
                            <input value={histForm.managerName} onChange={(e) => setHistForm({ ...histForm, managerName: e.target.value })} />
                          </label>
                          <label className="field" style={{ margin: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Start Date</span>
                            <input required type="date" value={histForm.startDate} onChange={(e) => setHistForm({ ...histForm, startDate: e.target.value })} />
                          </label>
                          <label className="field" style={{ margin: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>End Date</span>
                            <input type="date" value={histForm.endDate} onChange={(e) => setHistForm({ ...histForm, endDate: e.target.value })} />
                          </label>
                        </div>
                        <button className="btn secondary" type="submit" style={{ alignSelf: 'flex-start', marginTop: 8, fontSize: '12px' }}>
                          Save History Record
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 3: Payroll (Single Combined Details + Payslip History Tab)
                 ========================================================================= */}
              {selectedTab === 'Payroll' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Current Salary & Compensation Details */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px',
                      }}
                    >
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                        Current Compensation & WPS Details
                      </h4>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#008fa8', background: 'rgba(0, 184, 219, 0.1)', padding: '3px 10px', borderRadius: '12px' }}>
                        WPS Compliant
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '16px 20px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Basic Salary</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                          {selectedMd.finance?.basicSalary ? `AED ${Number(selectedMd.finance.basicSalary).toLocaleString()}` : 'AED 5,000'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Housing & Transport Allowance</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                          {selectedMd.finance?.allowances ? `AED ${Number(selectedMd.finance.allowances).toLocaleString()}` : 'AED 2,500'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Gross Monthly Remuneration</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#008fa8', marginTop: 2 }}>
                          {selectedMd.finance?.grossSalary
                            ? `AED ${Number(selectedMd.finance.grossSalary).toLocaleString()}`
                            : `AED ${(Number(selectedMd.finance?.basicSalary || 5000) + Number(selectedMd.finance?.allowances || 2500)).toLocaleString()}`}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Payment Method</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {selectedMd.finance?.paymentMethod || 'WPS (SIF File Generation)'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Operating Bank</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {selectedMd.finance?.bankName || 'Emirates NBD'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>IBAN / Account Number</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {selectedMd.finance?.iban || selectedMd.finance?.accountNo || 'AE07033123456789012'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Payroll History (Payslips) */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: '#0f172a' }}>
                      Payroll & Payslip History
                    </h4>

                    {empPayslips.length > 0 ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Period / Month</th>
                              <th>Basic Salary</th>
                              <th>Allowances</th>
                              <th>Deductions</th>
                              <th>Net Salary</th>
                              <th>Method</th>
                              <th style={{ textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {empPayslips.map((p, idx) => (
                              <tr key={v(p, 'id') || idx}>
                                <td style={{ fontWeight: 700, color: '#008fa8' }}>
                                  {v(p, 'periodLabel', 'period_label') || 'Current Period'}
                                </td>
                                <td>AED {Number(v(p, 'basicSalary', 'basic_salary') || 0).toLocaleString()}</td>
                                <td>AED {Number(v(p, 'allowances') || 0).toLocaleString()}</td>
                                <td>AED {Number(v(p, 'deductions') || 0).toLocaleString()}</td>
                                <td style={{ fontWeight: 700 }}>AED {Number(v(p, 'netSalary', 'net_salary') || 0).toLocaleString()}</td>
                                <td>{v(p, 'paymentMethod', 'payment_method') || 'WPS'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <Badge status={v(p, 'status') || 'paid'} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '32px 16px',
                          textAlign: 'center',
                          color: '#94a3b8',
                          fontSize: '13px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                        }}
                      >
                        No payroll history found for this employee.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 4: Documents (Passport, Emirates ID & Uploaded Attachments)
                 ========================================================================= */}
              {selectedTab === 'Documents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Legal Identity & Travel Documents */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px',
                      }}
                    >
                      <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                        Passport & Emirates ID Credentials
                      </h4>
                      {isAdmin ? (
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(true)}
                          style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '14px' }}
                          title="Edit Credentials"
                        >
                          ✎
                        </button>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '14px 20px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Passport Number</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {selectedMd.passportNumber || v(selected, 'passportNo', 'passport_no') || '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Passport Issue Date</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {formatDate(selectedMd.passportStartDate) || '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Passport Expiry Date</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {formatDate(selectedMd.passportExpiryDate || v(selected, 'passportExpiry', 'passport_expiry')) || '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Emirates ID Number</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {selectedMd.emiratesIdNumber || '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Emirates ID Issue Date</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {formatDate(selectedMd.emiratesIdStartDate) || '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Emirates ID Expiry Date</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {formatDate(selectedMd.emiratesIdExpiryDate) || '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#94a3b8' }}>Previous Visa Type</div>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                          {selectedMd.previousVisaType || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Uploaded Documents & Attachments (Empty State if None) */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: '#0f172a' }}>
                      Official Files & Document Attachments
                    </h4>

                    {empDocuments.length > 0 || selectedMd.experienceLetterName || selectedMd.educationalCertificateName ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                        {selectedMd.experienceLetterName ? (
                          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '22px' }}>📄</span>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Experience Letter</div>
                              <div style={{ fontSize: '11.5px', color: '#64748b' }}>{selectedMd.experienceLetterName}</div>
                            </div>
                          </div>
                        ) : null}

                        {selectedMd.educationalCertificateName ? (
                          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '22px' }}>📜</span>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Educational Certificate</div>
                              <div style={{ fontSize: '11.5px', color: '#64748b' }}>{selectedMd.educationalCertificateName}</div>
                            </div>
                          </div>
                        ) : null}

                        {empDocuments.map((doc, idx) => (
                          <div key={v(doc, 'id') || idx} style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: '22px' }}>📁</span>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                  {v(doc, 'documentType', 'document_type', 'title') || 'Official Document'}
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                  {v(doc, 'fileName', 'file_name') || `File #${v(doc, 'id')}`}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn secondary"
                              onClick={async () => {
                                try {
                                  const blob = await apiBlob(`/documents/${v(doc, 'id')}/file`);
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = v(doc, 'fileName', 'file_name') || 'document.pdf';
                                  document.body.appendChild(a);
                                  a.click();
                                  a.remove();
                                  window.URL.revokeObjectURL(url);
                                } catch (err) {
                                  setError(err.message);
                                }
                              }}
                              style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '32px 16px',
                          textAlign: 'center',
                          color: '#94a3b8',
                          fontSize: '13px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                        }}
                      >
                        No documents found for this employee yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 5: Leave history (Live Leave Quotas & Requests)
                 ========================================================================= */}
              {selectedTab === 'Leave history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Leave Balances & Quotas */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
                      Annual Leave Balances & Entitlements
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                      {/* Annual */}
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#008fa8' }}>Annual Leave</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>
                          {empBalances[0] ? (v(empBalances[0], 'annualTotal', 'annual_total') - v(empBalances[0], 'annualUsed', 'annual_used')) : 30} Days
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          Used: {empBalances[0] ? v(empBalances[0], 'annualUsed', 'annual_used') : 0} of {empBalances[0] ? v(empBalances[0], 'annualTotal', 'annual_total') : 30}
                        </div>
                      </div>

                      {/* Sick */}
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#10b981' }}>Sick Leave</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>
                          {empBalances[0] ? (v(empBalances[0], 'sickTotal', 'sick_total') - v(empBalances[0], 'sickUsed', 'sick_used')) : 15} Days
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          Used: {empBalances[0] ? v(empBalances[0], 'sickUsed', 'sick_used') : 0} of {empBalances[0] ? v(empBalances[0], 'sickTotal', 'sick_total') : 15}
                        </div>
                      </div>

                      {/* Casual / Emergency */}
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#f59e0b' }}>Casual / Emergency</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>
                          {empBalances[0] ? (v(empBalances[0], 'casualTotal', 'casual_total') - v(empBalances[0], 'casualUsed', 'casual_used')) : 5} Days
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          Used: {empBalances[0] ? v(empBalances[0], 'casualUsed', 'casual_used') : 0} of {empBalances[0] ? v(empBalances[0], 'casualTotal', 'casual_total') : 5}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Leave Requests History */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: '#0f172a' }}>
                      Leave Requests & Approval History
                    </h4>

                    {empLeaves.length > 0 ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Start Date</th>
                              <th>End Date</th>
                              <th>Duration</th>
                              <th>Reason</th>
                              <th style={{ textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {empLeaves.map((l, idx) => (
                              <tr key={v(l, 'id') || idx}>
                                <td style={{ fontWeight: 700, color: '#008fa8' }}>
                                  {v(l, 'leaveType', 'leave_type') || 'Annual'}
                                </td>
                                <td>{formatDate(v(l, 'startDate', 'start_date'))}</td>
                                <td>{formatDate(v(l, 'endDate', 'end_date'))}</td>
                                <td>{v(l, 'days') || 1} Day(s)</td>
                                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {v(l, 'reason') || '—'}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <Badge status={v(l, 'status')} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '32px 16px',
                          textAlign: 'center',
                          color: '#94a3b8',
                          fontSize: '13px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                        }}
                      >
                        No leave requests found for this employee.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================================
                  TAB 6: Attendance (Live Clock-in & Working Hours Records)
                 ========================================================================= */}
              {selectedTab === 'Attendance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Card 1: Attendance Summary Overview */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
                      Attendance Summary Overview
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                      <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: '#64748b' }}>Total Logged Days</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                          {empAttendance.length}
                        </div>
                      </div>

                      <div style={{ padding: '14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#10b981' }}>Present</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', marginTop: 4 }}>
                          {empAttendance.filter((a) => String(v(a, 'status')).toLowerCase() === 'present').length || empAttendance.length}
                        </div>
                      </div>

                      <div style={{ padding: '14px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#f59e0b' }}>Late / Half-Day</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>
                          {empAttendance.filter((a) => String(v(a, 'status')).toLowerCase().includes('late')).length}
                        </div>
                      </div>

                      <div style={{ padding: '14px', background: 'rgba(0, 184, 219, 0.08)', borderRadius: '8px', border: '1px solid rgba(0, 184, 219, 0.2)' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#008fa8' }}>Assigned Shift</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#008fa8', marginTop: 8 }}>
                          General (09:00 - 18:00)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Recent Clock-in / Attendance Logs */}
                  <div
                    className="card"
                    style={{
                      padding: '22px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: '#0f172a' }}>
                      Recent Clock-In / Attendance Records
                    </h4>

                    {empAttendance.length > 0 ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Check-In</th>
                              <th>Check-Out</th>
                              <th>Shift</th>
                              <th>Overtime</th>
                              <th style={{ textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {empAttendance.map((a, idx) => (
                              <tr key={v(a, 'id') || idx}>
                                <td style={{ fontWeight: 600 }}>{formatDate(v(a, 'date'))}</td>
                                <td>{v(a, 'checkIn', 'check_in') || '09:00'}</td>
                                <td>{v(a, 'checkOut', 'check_out') || '18:00'}</td>
                                <td>{v(a, 'shiftName', 'shift_name') || 'General'}</td>
                                <td>{v(a, 'overtimeHours', 'overtime_hours') ? `${v(a, 'overtimeHours', 'overtime_hours')} hrs` : '0 hrs'}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <Badge status={v(a, 'status') || 'present'} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: '32px 16px',
                          textAlign: 'center',
                          color: '#94a3b8',
                          fontSize: '13px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                        }}
                      >
                        No attendance records found for this employee.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<div className="app-shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><div className="muted">Loading…</div></div>}>
      <EmployeesContent />
    </Suspense>
  );
}
