'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '../../../components/AppShell';
import EmployeeMasterForm from '../../../components/EmployeeMasterForm';
import { api, apiUpload } from '../../../lib/auth';
import { emptyMasterForm, masterPayloadFromForm } from '../../../lib/employeeMaster';
import { v } from '../../../lib/format';

export default function CreateEmployeePage() {
  const router = useRouter();

  const [form, setForm] = useState(emptyMasterForm());
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employmentTypes, setEmploymentTypes] = useState([]);
  const [managers, setManagers] = useState([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Post-creation popup states: Case A (Credentials) vs Case B (Simple Success)
  const [createLoginPopup, setCreateLoginPopup] = useState(null);
  const [quickSuccessPopup, setQuickSuccessPopup] = useState(false);

  // Calculate next code from list
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
    return 'DD-' + (maxNum + 1);
  };

  useEffect(() => {
    // Load dropdown masters
    Promise.allSettled([
      api('/departments'),
      api('/divisions'),
      api('/designations'),
      api('/employment-types'),
      api('/employees'),
    ]).then(([deptRes, divRes, desRes, empTypeRes, empsRes]) => {
      if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) setDepartments(deptRes.value);
      if (divRes.status === 'fulfilled' && Array.isArray(divRes.value)) setDivisions(divRes.value);
      if (desRes.status === 'fulfilled' && Array.isArray(desRes.value)) setDesignations(desRes.value);
      if (empTypeRes.status === 'fulfilled' && Array.isArray(empTypeRes.value)) setEmploymentTypes(empTypeRes.value);
      if (empsRes.status === 'fulfilled' && Array.isArray(empsRes.value)) {
        const list = empsRes.value;
        setManagers(list);
        setForm((prev) => ({
          ...prev,
          empCode: prev.empCode || calculateNextCode(list),
        }));
      }
    });
  }, []);

  async function createEmployee(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = masterPayloadFromForm(form, { includePassword: true });
      const res = await api('/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const empId = v(res.employee, 'id');
      const appEmail = String(res.login?.email || form.email || payload.email || '')
        .trim()
        .toLowerCase();
      const appPassword = String(form.password || 'demo123').trim();
      const employeeName =
        v(res.employee, 'fullName', 'full_name') ||
        form.fullName ||
        [form.firstName, form.lastName].filter(Boolean).join(' ') ||
        'Employee';

      if (form.photoFile && empId) {
        const fd = new FormData();
        fd.append('file', form.photoFile);
        await apiUpload('/employees/' + empId + '/photo', fd);
      }

      // Check whether user filled out complete details across all sections
      const hasAddress = Boolean(form.homeCountryAddress?.trim() || form.addressInUae?.trim());
      const hasEducation = Boolean(
        (Array.isArray(form.educations) && form.educations.length > 0) ||
        form.education?.degreeMajor?.trim() ||
        form.education?.universityName?.trim()
      );
      const hasWorkExp = Boolean(
        (Array.isArray(form.workExperiences) && form.workExperiences.some((w) => w.previousCompany?.trim())) ||
        form.workExperience?.previousCompany?.trim()
      );
      const hasJobProfile = Boolean(
        form.departmentId && (form.designationId || (form.jobTitle && form.jobTitle !== '—'))
      );
      const hasIdDocument = Boolean(
        form.passportNumber?.trim() || form.emiratesIdNumber?.trim()
      );

      const isFullDetails = hasAddress && hasEducation && hasWorkExp && hasJobProfile && hasIdDocument;

      if (isFullDetails) {
        // Case A: Full details provided -> Show full credentials popup
        setCreateLoginPopup({
          name: employeeName,
          email: appEmail,
          password: appPassword,
        });
      } else {
        // Case B: Partial / Quick creation -> Show simple success popup
        setQuickSuccessPopup(true);
      }

      if (form.photoPreview) {
        try {
          URL.revokeObjectURL(form.photoPreview);
        } catch {}
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Create Employee"
      subtitle="Register new employee"
      actions={
        <Link
          href="/employees"
          className="btn secondary"
          style={{
            height: '40px',
            boxSizing: 'border-box',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '6px',
            padding: '0 14px',
            textDecoration: 'none',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>All Employees</span>
        </Link>
      }
    >
      {error ? (
        <div className="error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      <div className="card" style={{ padding: '24px 28px' }}>
        <EmployeeMasterForm
          mode="create"
          form={form}
          setForm={setForm}
          departments={departments}
          divisions={divisions}
          designations={designations}
          employmentTypes={employmentTypes}
          managers={managers}
          saving={saving}
          onSubmit={createEmployee}
          onCancel={() => router.push('/employees')}
        />
      </div>

      {/* Case A: Full Credentials Popup */}
      {createLoginPopup ? (
        <>
          <div
            className="backdrop show"
            onClick={() => {
              setCreateLoginPopup(null);
              router.push('/employees');
            }}
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
              zIndex: 60,
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
              onClick={() => {
                setCreateLoginPopup(null);
                router.push('/employees');
              }}
              style={{ background: '#00b8db', color: '#ffffff', fontWeight: 700, borderRadius: 8 }}
            >
              Done & View Employees
            </button>
          </div>
        </>
      ) : null}

      {/* Case B: Simple Success Popup for Quick / Partial Creation */}
      {quickSuccessPopup ? (
        <>
          <div
            className="backdrop show"
            onClick={() => {
              setQuickSuccessPopup(false);
              router.push('/employees');
            }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-success-title"
            style={{
              position: 'fixed',
              left: '50%',
              top: '20%',
              transform: 'translateX(-50%)',
              zIndex: 60,
              width: 'min(420px, calc(100vw - 32px))',
              background: 'var(--card, #fff)',
              border: '1px solid var(--border, #d7e3ef)',
              borderRadius: 14,
              boxShadow: '0 20px 50px rgba(2, 11, 31, 0.25)',
              padding: '26px 28px',
              textAlign: 'center',
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '20px', margin: '0 auto 14px' }}>
              ✓
            </div>
            <h3 id="quick-success-title" style={{ margin: '0 0 10px', fontSize: '17px', fontWeight: 700, color: 'var(--ink)' }}>
              Employee Created Successfully
            </h3>
            <p style={{ margin: '0 0 22px', fontSize: '13.5px', color: 'var(--muted, #64748b)', lineHeight: 1.5 }}>
              Your information has been saved and the employee has been created.
            </p>
            <button
              type="button"
              className="btn block"
              onClick={() => {
                setQuickSuccessPopup(false);
                router.push('/employees');
              }}
              style={{ background: '#00b8db', color: '#ffffff', fontWeight: 700, borderRadius: 8, padding: '10px 0' }}
            >
              Done & View Employees
            </button>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
