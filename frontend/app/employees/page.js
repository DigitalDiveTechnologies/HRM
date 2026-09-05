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
    setSelected(e);
    setIsEditingProfile(false);
    setMasterForm(masterFormFromEmployee(e));
    try {
      const full = await api(`/employees/${v(e, 'id')}`);
      setSelected(full);
      setMasterForm(masterFormFromEmployee(full));
      const h = await api(`/org/history/${v(e, 'id')}`);
      setHistory(h || []);
    } catch (err) {
      setError(err.message);
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
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Organization Chart</h3>
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
          5. EMPLOYEE PROFILE DETAIL VIEW (Exact Image 4 Executive Cards Design)
         ========================================================================= */}
      {selected ? (
        <div id="employee-profile-detail" className="card" style={{ marginTop: 20, padding: '24px', borderRadius: 12 }}>
          {/* Breadcrumb & Top Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--line)', paddingBottom: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Employee / Employee Detail
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '4px 0 0', color: 'var(--ink)' }}>
                {v(selected, 'fullName', 'full_name')}
              </h2>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {isAdmin ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  style={{
                    background: isEditingProfile ? 'var(--surface-alt)' : '#00b8db',
                    color: isEditingProfile ? 'var(--ink)' : '#ffffff',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                  }}
                >
                  {isEditingProfile ? '✕ Cancel Edit' : '✎ Edit Details'}
                </button>
              ) : null}
              <button
                type="button"
                className="btn secondary"
                onClick={() => setSelected(null)}
                style={{ fontSize: '12.5px', padding: '8px 16px', borderRadius: 8 }}
              >
                Close
              </button>
            </div>
          </div>

          {/* EDIT MODE: Render full editable form */}
          {isEditingProfile ? (
            <div style={{ background: 'var(--surface-alt)', padding: 18, borderRadius: 10, marginBottom: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
                  Editing Profile: {v(selected, 'fullName', 'full_name')}
                </h3>
                <p className="muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
                  Update employee attributes, job specifications, and legal document dates. Click &quot;Save Changes&quot; to apply.
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
            /* VIEW MODE: Exact Image 4 Executive Cards Grid */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
              {/* Card 1: Basic Information */}
              <div
                className="card"
                style={{
                  padding: 20,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  gridColumn: '1 / -1',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
                    Basic Information
                  </h4>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '13px' }}
                      title="Edit basic information"
                    >
                      ✎
                    </button>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: '50%',
                      background: selectedPhotoUrl
                        ? `url(${selectedPhotoUrl}) center/cover no-repeat`
                        : 'rgba(0, 184, 219, 0.12)',
                      border: '3px solid #00b8db',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      fontWeight: 600,
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

                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
                        {v(selected, 'fullName', 'full_name')}
                      </h3>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#008fa8', background: 'rgba(0, 184, 219, 0.12)', padding: '2px 8px', borderRadius: 4 }}>
                        {v(selected, 'empCode', 'emp_code')}
                      </span>
                      <Badge status={v(selected, 'status')} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 18px', marginTop: 14 }}>
                      <div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>App Login Email</div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{v(selected, 'email') || '—'}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Phone Number</div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{v(selected, 'phone') || selectedMd.mobilePhone || '—'}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Company</div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{v(selected, 'divisionName', 'division_name') || '—'}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Department</div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{v(selected, 'departmentName', 'department_name') || '—'}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Designation / Title</div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{v(selected, 'jobTitle', 'job_title') || '—'}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Reporting Manager</div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{v(selected, 'managerName', 'manager_name') || '—'}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Employment Type</div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{v(selected, 'employmentTypeName', 'employment_type_name') || 'Full-time'}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Join Date</div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{formatDate(v(selected, 'joinDate', 'join_date')) || '—'}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Nationality</div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{selectedMd.nationality || selectedMd.personal?.nationality || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Address Information */}
              <div
                className="card"
                style={{
                  padding: 20,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
                    Address
                  </h4>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '13px' }}
                    >
                      ✎
                    </button>
                  ) : null}
                </div>

                <div className="stack" style={{ gap: 12 }}>
                  <div>
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Current Address</div>
                    <div style={{ fontSize: '13px', color: 'var(--ink)', marginTop: 2 }}>{selectedMd.currentAddress || '—'}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Address in UAE</div>
                    <div style={{ fontSize: '13px', color: 'var(--ink)', marginTop: 2 }}>{selectedMd.addressInUae || '—'}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Home Country Address</div>
                    <div style={{ fontSize: '13px', color: 'var(--ink)', marginTop: 2 }}>{selectedMd.homeCountryAddress || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Card 3: Passport, Emirates ID & Visa */}
              <div
                className="card"
                style={{
                  padding: 20,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
                    Passport & Visa Credentials
                  </h4>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '13px' }}
                    >
                      ✎
                    </button>
                  ) : null}
                </div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Passport Number</div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{selectedMd.passportNumber || v(selected, 'passportNo', 'passport_no') || '—'}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Passport Expiry</div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{formatDate(selectedMd.passportExpiryDate || v(selected, 'passportExpiry', 'passport_expiry')) || '—'}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Emirates ID</div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{selectedMd.emiratesIdNumber || '—'}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Emirates ID Expiry</div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{formatDate(selectedMd.emiratesIdExpiryDate) || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Previous Visa Type</div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{selectedMd.previousVisaType || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Card 4: Work Experience */}
              <div
                className="card"
                style={{
                  padding: 20,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
                    Work Experience
                  </h4>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '13px' }}
                    >
                      ✎
                    </button>
                  ) : null}
                </div>

                {selectedMd.workExperience?.previousCompany ? (
                  <div className="stack" style={{ gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--ink)' }}>
                      {selectedMd.workExperience.position || 'Position not listed'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#008fa8', fontWeight: 600 }}>
                      {selectedMd.workExperience.previousCompany}
                    </div>
                    <div className="muted" style={{ fontSize: '12px' }}>
                      Field: {selectedMd.workExperience.fieldOfWork || '—'} · Duration: {selectedMd.workExperience.duration || '—'}
                    </div>
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: '12.5px' }}>No previous work experience recorded.</div>
                )}
              </div>

              {/* Card 5: Education Details (Dubai Standard) */}
              <div
                className="card"
                style={{
                  padding: 20,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
                    Education (UAE Standard)
                  </h4>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      style={{ background: 'transparent', border: 'none', color: '#008fa8', cursor: 'pointer', fontSize: '13px' }}
                    >
                      ✎
                    </button>
                  ) : null}
                </div>

                {selectedMd.education?.degreeMajor || selectedMd.education?.educationLevel ? (
                  <div className="stack" style={{ gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--ink)' }}>
                      {selectedMd.education.degreeMajor || selectedMd.education.educationLevel}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#008fa8', fontWeight: 600 }}>
                      {selectedMd.education.universityName || 'Institute not specified'}
                      {selectedMd.education.countryOfStudy ? ` (${selectedMd.education.countryOfStudy})` : ''}
                    </div>
                    <div className="muted" style={{ fontSize: '12px' }}>
                      Level: {selectedMd.education.educationLevel || '—'} · Year: {selectedMd.education.graduationYear || '—'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: selectedMd.education.attestationStatus?.includes('Attested') ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-alt)', color: selectedMd.education.attestationStatus?.includes('Attested') ? '#10b981' : 'var(--muted)' }}>
                        {selectedMd.education.attestationStatus || 'Not Attested'}
                      </span>
                      {selectedMd.education.gradeGpa ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(0, 184, 219, 0.12)', color: '#008fa8' }}>
                          GPA: {selectedMd.education.gradeGpa}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: '12.5px' }}>No formal education credentials recorded.</div>
                )}
              </div>

              {/* Card 6: App Login & Reset Password */}
              {isAdmin ? (
                <div
                  className="card"
                  style={{
                    padding: 20,
                    borderRadius: 10,
                    border: '1px solid var(--line)',
                    background: 'var(--surface)',
                    gridColumn: '1 / -1',
                  }}
                >
                  <h4 style={{ fontSize: '14.5px', fontWeight: 600, margin: '0 0 6px', color: 'var(--ink)' }}>
                    Mobile App Security & Password Reset
                  </h4>
                  <p className="muted" style={{ fontSize: '12px', margin: '0 0 14px' }}>
                    If the employee cannot sign in on the mobile app or forgets their password, reset it here:
                  </p>
                  <form onSubmit={resetAppPassword} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      required
                      type="password"
                      placeholder="Enter new app password (min 6 characters)"
                      minLength={6}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      style={{ minWidth: 280, fontSize: '13px' }}
                    />
                    <button
                      className="btn"
                      type="submit"
                      disabled={resetting || !resetPassword.trim()}
                      style={{ background: '#00b8db', color: '#fff', fontWeight: 700, fontSize: '12.5px' }}
                    >
                      {resetting ? 'Updating…' : 'Update App Password'}
                    </button>
                  </form>
                </div>
              ) : null}

              {/* Card 7: Employment History Timeline */}
              <div
                className="card"
                style={{
                  padding: 20,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  gridColumn: '1 / -1',
                }}
              >
                <h4 style={{ fontSize: '14.5px', fontWeight: 600, margin: '0 0 12px', color: 'var(--ink)' }}>
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
                          <td>{v(h, 'jobTitle', 'job_title')}</td>
                          <td>{v(h, 'departmentName', 'department_name') || '-'}</td>
                          <td>{v(h, 'managerName', 'manager_name') || '-'}</td>
                          <td>{formatDate(v(h, 'startDate', 'start_date'))}</td>
                          <td>{formatDate(v(h, 'endDate', 'end_date')) || 'Present'}</td>
                        </tr>
                      ))}
                      {!history.length ? (
                        <tr>
                          <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 14 }}>
                            No internal role history rows.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {isAdmin ? (
                  <form className="stack" onSubmit={addHistory} style={{ background: 'var(--surface-alt)', padding: 14, borderRadius: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink)', marginBottom: 8 }}>
                      + Add Role / Promotion History
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      <label className="field" style={{ margin: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>Job Title</span>
                        <input required value={histForm.jobTitle} onChange={(e) => setHistForm({ ...histForm, jobTitle: e.target.value })} />
                      </label>
                      <label className="field" style={{ margin: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>Department</span>
                        <input value={histForm.departmentName} onChange={(e) => setHistForm({ ...histForm, departmentName: e.target.value })} />
                      </label>
                      <label className="field" style={{ margin: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>Manager</span>
                        <input value={histForm.managerName} onChange={(e) => setHistForm({ ...histForm, managerName: e.target.value })} />
                      </label>
                      <label className="field" style={{ margin: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>Start Date</span>
                        <input required type="date" value={histForm.startDate} onChange={(e) => setHistForm({ ...histForm, startDate: e.target.value })} />
                      </label>
                      <label className="field" style={{ margin: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>End Date</span>
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
