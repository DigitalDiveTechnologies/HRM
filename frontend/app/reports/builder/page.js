'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '../../../components/AppShell';
import { api, getToken, getApiBase } from '../../../lib/auth';

const STANDARD_COLUMNS = [
  {
    category: 'Identity',
    icon: '👤',
    columns: [
      { key: 'emp_code', label: 'Employee Code', defaultChecked: true },
      { key: 'full_name', label: 'Full Name', defaultChecked: true },
      { key: 'email', label: 'Work Email', defaultChecked: true },
      { key: 'phone', label: 'Phone Number' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'dob', label: 'Date of Birth' },
      { key: 'status', label: 'Employment Status', defaultChecked: true },
      { key: 'is_emirati', label: 'Is Emirati (UAE Citizen)' },
    ],
  },
  {
    category: 'Job Details',
    icon: '💼',
    columns: [
      { key: 'job_title', label: 'Job Title', defaultChecked: true },
      { key: 'department_name', label: 'Department', defaultChecked: true },
      { key: 'division_name', label: 'Division / Company', defaultChecked: true },
      { key: 'join_date', label: 'Join Date' },
      { key: 'contract_end', label: 'Contract End Date' },
      { key: 'probation_end', label: 'Probation End Date' },
      { key: 'manager_name', label: 'Direct Manager' },
    ],
  },
  {
    category: 'Compensation',
    icon: '💵',
    columns: [
      { key: 'basic_salary', label: 'Basic Salary (Monthly)' },
      { key: 'allowances', label: 'Allowances (Monthly)' },
      { key: 'gross_salary', label: 'Gross Salary (Monthly)' },
      { key: 'annual_cash_salary', label: 'Annual Cash Salary' },
      { key: 'pension_salary', label: 'Pension Salary' },
    ],
  },
  {
    category: 'Document Expirations',
    icon: '📄',
    columns: [
      { key: 'passport_no', label: 'Passport Number' },
      { key: 'passport_expiry', label: 'Passport Expiry Date' },
      { key: 'emirates_id', label: 'Emirates ID Number' },
      { key: 'emirates_id_expiry', label: 'Emirates ID Expiry' },
      { key: 'visa_no', label: 'UAE Visa Number' },
      { key: 'visa_expiry', label: 'Visa Expiry Date' },
    ],
  },
];

export default function CustomReportBuilderPage() {
  const [customFields, setCustomFields] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);

  // Selected Columns
  const [selectedColumns, setSelectedColumns] = useState(() => {
    const initial = [];
    STANDARD_COLUMNS.forEach((cat) => {
      cat.columns.forEach((col) => {
        if (col.defaultChecked) initial.push(col.key);
      });
    });
    return initial;
  });

  // Filters
  const [filters, setFilters] = useState({
    departmentId: '',
    divisionId: '',
    status: 'all',
    joinDateStart: '',
    joinDateEnd: '',
    search: '',
  });

  // Preview & Export States
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // Load masters & custom fields
  useEffect(() => {
    Promise.all([
      api('/custom-fields').catch(() => []),
      api('/departments').catch(() => []),
      api('/divisions').catch(() => []),
    ]).then(([cf, depts, divs]) => {
      if (Array.isArray(cf)) setCustomFields(cf);
      if (Array.isArray(depts)) setDepartments(depts);
      if (Array.isArray(divs)) setDivisions(divs);
    });
  }, []);

  // Live preview fetcher
  const fetchPreview = async () => {
    if (selectedColumns.length === 0) {
      setPreviewData(null);
      return;
    }
    setPreviewLoading(true);
    setError('');
    try {
      const payload = {
        columns: selectedColumns,
        filters: {
          departmentId: filters.departmentId ? Number(filters.departmentId) : null,
          divisionId: filters.divisionId ? Number(filters.divisionId) : null,
          status: filters.status !== 'all' ? filters.status : null,
          joinDateStart: filters.joinDateStart || null,
          joinDateEnd: filters.joinDateEnd || null,
          search: filters.search.trim() || null,
        },
      };

      const res = await api('/reports/preview-custom', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPreviewData(res);
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.message || 'Failed to generate report preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [selectedColumns, filters]);

  // Toggle single column
  const toggleColumn = (key) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Toggle category
  const toggleCategory = (cols) => {
    const keys = cols.map((c) => c.key);
    const allSelected = keys.every((k) => selectedColumns.includes(k));
    if (allSelected) {
      setSelectedColumns((prev) => prev.filter((k) => !keys.includes(k)));
    } else {
      setSelectedColumns((prev) => Array.from(new Set([...prev, ...keys])));
    }
  };

  // Presets
  const applyPreset = (preset) => {
    switch (preset) {
      case 'roster':
        setSelectedColumns(['emp_code', 'full_name', 'email', 'phone', 'job_title', 'department_name', 'division_name', 'status']);
        break;
      case 'payroll':
        setSelectedColumns(['emp_code', 'full_name', 'department_name', 'basic_salary', 'allowances', 'gross_salary', 'annual_cash_salary', 'pension_salary']);
        break;
      case 'documents':
        setSelectedColumns(['emp_code', 'full_name', 'passport_no', 'passport_expiry', 'emirates_id', 'emirates_id_expiry', 'visa_no', 'visa_expiry']);
        break;
      case 'offshore':
        setSelectedColumns(['emp_code', 'full_name', 'department_name', 'sea_crew_id', 'offshore_clearance', 'clearance_expiry_date', 'uniform_size']);
        break;
      case 'all': {
        const all = [];
        STANDARD_COLUMNS.forEach((cat) => cat.columns.forEach((c) => all.push(c.key)));
        customFields.forEach((cf) => all.push(cf.fieldKey));
        setSelectedColumns(all);
        break;
      }
      case 'clear':
        setSelectedColumns([]);
        break;
      default:
        break;
    }
  };

  // Instant CSV Download
  const handleExportCsv = async () => {
    if (selectedColumns.length === 0) {
      alert('Please select at least one column to export.');
      return;
    }

    setExporting(true);
    try {
      const token = getToken();
      const payload = {
        columns: selectedColumns,
        filters: {
          departmentId: filters.departmentId ? Number(filters.departmentId) : null,
          divisionId: filters.divisionId ? Number(filters.divisionId) : null,
          status: filters.status !== 'all' ? filters.status : null,
          joinDateStart: filters.joinDateStart || null,
          joinDateEnd: filters.joinDateEnd || null,
          search: filters.search.trim() || null,
        },
      };

      const res = await fetch(`${getApiBase()}/api/reports/export-custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Custom-HR-Report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      alert(err.message || 'Failed to download custom report CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell title="Self-Service Dynamic Report Builder" subtitle="Task 2.5: Build, Filter & Stream Custom CSV Exports">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Header Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            borderRadius: 16,
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 4px 15px rgba(15, 23, 42, 0.2)',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38bdf8', fontWeight: 700 }}>
              Self-Service Reporting Intelligence
            </div>
            <h1 style={{ margin: '4px 0 6px', fontSize: '24px', fontWeight: 800 }}>
              Dynamic CSV & Excel Report Builder
            </h1>
            <p style={{ margin: 0, fontSize: '13px', opacity: 0.85, maxWidth: 640, lineHeight: 1.5 }}>
              Select any combination of standard identity, compensation, compliance, and dynamic custom fields. Apply real-time criteria filters and stream instant RFC 4180 CSV downloads.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link
              href="/reports"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 10,
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              ← Back to Analytics
            </Link>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || selectedColumns.length === 0}
              style={{
                background: '#00b8db',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '10px 22px',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: exporting || selectedColumns.length === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(0, 184, 219, 0.3)',
                opacity: exporting || selectedColumns.length === 0 ? 0.6 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exporting ? 'Streaming CSV…' : `Export Custom CSV (${selectedColumns.length} Columns)`}
            </button>
          </div>
        </div>

        {/* Quick Presets Strip */}
        <div
          style={{
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: 12,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--muted, #64748b)', textTransform: 'uppercase' }}>
              Quick Presets:
            </span>
            <button
              type="button"
              className="btn secondary"
              onClick={() => applyPreset('roster')}
              style={{ padding: '5px 12px', fontSize: '12px', borderRadius: 8 }}
            >
              📋 Full Employee Roster
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => applyPreset('payroll')}
              style={{ padding: '5px 12px', fontSize: '12px', borderRadius: 8 }}
            >
              💰 Payroll & WPS Audit
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => applyPreset('documents')}
              style={{ padding: '5px 12px', fontSize: '12px', borderRadius: 8 }}
            >
              🛂 Document Expiry Watchlist
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => applyPreset('offshore')}
              style={{ padding: '5px 12px', fontSize: '12px', borderRadius: 8 }}
            >
              ⚓ Offshore & Marine Ops
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => applyPreset('all')}
              style={{ background: 'none', border: 'none', color: '#00b8db', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
            >
              Select All
            </button>
            <span style={{ color: 'var(--line, #cbd5e1)' }}>|</span>
            <button
              type="button"
              onClick={() => applyPreset('clear')}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* 2-Column Main Section: Left = Column Checkboxes, Right = Criteria Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          {/* Column Matrix Card */}
          <div
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 14,
              padding: '20px 22px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                  1. Pick Report Columns
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', marginTop: 2 }}>
                  Selected: <strong style={{ color: '#00b8db' }}>{selectedColumns.length}</strong> columns
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {STANDARD_COLUMNS.map((cat) => (
                <div key={cat.category} style={{ borderBottom: '1px solid var(--line, #f1f5f9)', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                      {cat.icon} {cat.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.columns)}
                      style={{ background: 'none', border: 'none', fontSize: '11px', color: '#0284c7', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {cat.columns.every((c) => selectedColumns.includes(c.key)) ? 'Deselect category' : 'Select all'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
                    {cat.columns.map((col) => {
                      const isChecked = selectedColumns.includes(col.key);
                      return (
                        <label
                          key={col.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            fontSize: '12px',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: 6,
                            background: isChecked ? 'rgba(0, 184, 219, 0.06)' : 'transparent',
                            color: isChecked ? 'var(--ink, #101828)' : 'var(--muted, #64748b)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleColumn(col.key)}
                          />
                          <span>{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Dynamic Custom Attributes Category */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                    ✨ Custom Attributes (JSONB Engine)
                  </span>
                  {customFields.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleCategory(customFields.map((cf) => ({ key: cf.fieldKey })))}
                      style={{ background: 'none', border: 'none', fontSize: '11px', color: '#0284c7', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {customFields.every((cf) => selectedColumns.includes(cf.fieldKey)) ? 'Deselect category' : 'Select all'}
                    </button>
                  )}
                </div>

                {customFields.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--muted, #94a3b8)', fontStyle: 'italic' }}>
                    No custom fields configured yet.{' '}
                    <Link href="/custom-fields" style={{ color: '#00b8db', textDecoration: 'none', fontWeight: 600 }}>
                      Define fields →
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
                    {customFields.map((cf) => {
                      const isChecked = selectedColumns.includes(cf.fieldKey);
                      return (
                        <label
                          key={cf.fieldKey}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            fontSize: '12px',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: 6,
                            background: isChecked ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                            color: isChecked ? 'var(--ink, #101828)' : 'var(--muted, #64748b)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleColumn(cf.fieldKey)}
                          />
                          <span>{cf.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Criteria Filters Card */}
          <div
            style={{
              background: 'var(--surface, #ffffff)',
              border: '1px solid var(--line, #e2e8f0)',
              borderRadius: 14,
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                2. Filter Criteria Builder
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                Narrow down workforce scope before exporting.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Search Keyword */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                    Search Keyword
                  </label>
                  <input
                    type="text"
                    className="emp-input"
                    placeholder="Search name, code, email…"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  />
                </div>

                {/* Department & Division */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                      Department
                    </label>
                    <select
                      className="emp-input"
                      value={filters.departmentId}
                      onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
                    >
                      <option value="">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                      Division / Entity
                    </label>
                    <select
                      className="emp-input"
                      value={filters.divisionId}
                      onChange={(e) => setFilters({ ...filters, divisionId: e.target.value })}
                    >
                      <option value="">All Divisions</option>
                      {divisions.map((dv) => (
                        <option key={dv.id} value={dv.id}>
                          {dv.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status & Join Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                      Employment Status
                    </label>
                    <select
                      className="emp-input"
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="probation">Probation</option>
                      <option value="notice">Notice Period</option>
                      <option value="exited">Exited</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink, #101828)', display: 'block', marginBottom: 4 }}>
                      Joined After
                    </label>
                    <input
                      type="date"
                      className="emp-input"
                      value={filters.joinDateStart}
                      onChange={(e) => setFilters({ ...filters, joinDateStart: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Summary Badge Box */}
            <div
              style={{
                marginTop: 20,
                padding: '14px 16px',
                borderRadius: 10,
                background: 'var(--surface-alt, #f8fafc)',
                border: '1px solid var(--line, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--muted, #64748b)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Live Matching Headcount
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#00b8db', marginTop: 2 }}>
                  {previewLoading ? 'Counting…' : `${previewData?.totalRows ?? 0} Records`}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFilters({
                    departmentId: '',
                    divisionId: '',
                    status: 'all',
                    joinDateStart: '',
                    joinDateEnd: '',
                    search: '',
                  })
                }
                style={{
                  background: 'none',
                  border: '1px solid var(--line, #cbd5e1)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  color: 'var(--muted, #64748b)',
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Table */}
        <div style={{ background: 'var(--surface, #ffffff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 14, overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--line, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-alt, #f8fafc)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--ink, #101828)' }}>
                Live Data Preview
              </h3>
              <span style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)' }}>
                (Showing first {previewData?.previewRows?.length || 0} of {previewData?.totalRows || 0} records)
              </span>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting || selectedColumns.length === 0}
              style={{
                background: '#00b8db',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Export CSV →
            </button>
          </div>

          {previewLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted, #64748b)', fontSize: '13px' }}>
              Generating live SQL projection…
            </div>
          ) : !previewData || previewData.previewRows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted, #64748b)' }}>
              No matching records found for current criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-alt, #f8fafc)', borderBottom: '1px solid var(--line, #e2e8f0)', textAlign: 'left', color: 'var(--muted, #64748b)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {previewData.headers?.map((h, i) => (
                      <th key={i} style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.previewRows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                      {Object.keys(row).map((k, cIdx) => (
                        <td key={cIdx} style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--ink, #101828)' }}>
                          {row[k] !== null && row[k] !== undefined && String(row[k]).trim() !== '' ? String(row[k]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
