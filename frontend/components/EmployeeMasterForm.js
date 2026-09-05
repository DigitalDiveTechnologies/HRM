import { useRef, useState } from 'react';
import { getApiBase } from '../lib/auth';
import { v } from '../lib/format';

const PREVIOUS_VISA_TYPES = [
  'N/A',
  'Employment Visa',
  'Visit Visa / Tourist Visa',
  'Cancelled Visa',
  'Spouse / Family Visa',
  'Golden Visa',
  'Student Visa',
  'Investor / Partner Visa',
];

const DUBAI_EDUCATION_LEVELS = [
  'High School Diploma / Grade 12',
  "Bachelor's Degree / Undergraduate (Level 7 QFEmirates)",
  "Master's Degree (Level 9 QFEmirates)",
  'Doctorate / PhD (Level 10 QFEmirates)',
  'Postgraduate Diploma (Level 8 QFEmirates)',
  'Diploma / Associate Degree (Level 5 QFEmirates)',
  'Vocational / Professional Certification (KHDA / TVET)',
  'Other',
];

function FieldRow({ label, required = false, children, helper = '' }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '190px 1fr',
        gap: '16px',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid #f8fafc',
      }}
    >
      <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>
        {label} {required ? <span style={{ color: '#ef4444' }}>*</span> : null}
        {helper ? (
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 400, color: '#94a3b8', marginTop: 2 }}>
            {helper}
          </span>
        ) : null}
      </label>
      <div>{children}</div>
    </div>
  );
}

function SectionCard({ title, children, style = {} }) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        padding: '22px 24px',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          paddingBottom: '10px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <h4 style={{ fontSize: '15.5px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          {title}
        </h4>
        <span style={{ color: '#94a3b8' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </span>
      </div>
      {children}
    </div>
  );
}

export default function EmployeeMasterForm({
  mode = 'create',
  form,
  setForm,
  departments = [],
  divisions = [],
  designations = [],
  employmentTypes = [],
  managers = [],
  saving = false,
  onSubmit,
  onCancel,
  extraFooter = null,
}) {
  const isEdit = mode === 'edit';
  const fileInputRef = useRef(null);
  const expLetterRef = useRef(null);
  const eduCertRef = useRef(null);

  const [activeTab, setActiveTab] = useState('Personal info');

  // Step 1: Gatekeeper Company Selection during create mode (Locked 100%)
  const [selectedCompanies, setSelectedCompanies] = useState(() => {
    if (form.companyIds?.length) return form.companyIds;
    if (form.divisionId) return [String(form.divisionId)];
    return [];
  });
  const [companyConfirmed, setCompanyConfirmed] = useState(isEdit);

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const setWorkExp = (key, val) =>
    setForm((prev) => ({
      ...prev,
      workExperience: { ...(prev.workExperience || {}), [key]: val },
    }));

  const setEdu = (key, val) =>
    setForm((prev) => ({
      ...prev,
      education: { ...(prev.education || {}), [key]: val },
    }));

  const handleConfirmCompany = () => {
    if (!selectedCompanies.length) return;
    set('companyIds', selectedCompanies);
    set('divisionId', selectedCompanies[0] || '');
    setCompanyConfirmed(true);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      setForm((prev) => ({ ...prev, photoFile: file, photoPreview: preview }));
    }
  };

  const photoUrl =
    form.photoPreview ||
    (form.photoPath
      ? `${getApiBase().replace(/\/api\/?$/, '')}/${form.photoPath.replace(/^\//, '')}`
      : null);

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#0f172a',
    background: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ width: '100%' }}>
      {/* =========================================================================
          STEP 1: Company Selection Gatekeeper (Only during create mode - Locked)
         ========================================================================= */}
      {!companyConfirmed && !isEdit ? (
        <div
          style={{
            padding: '36px 28px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ maxWidth: '520px', margin: '0 auto' }}>
            <div
              style={{
                display: 'inline-flex',
                padding: '14px',
                borderRadius: '50%',
                background: 'rgba(0, 184, 219, 0.12)',
                marginBottom: '16px',
              }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#00b8db" strokeWidth="2">
                <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 3h6v4H9z" />
              </svg>
            </div>
            <h3 style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>
              Step 1: Select Operating Company
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
              Please select the operating company this employee will work for.
            </p>

            <div style={{ marginBottom: '24px', textAlign: 'left' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Select Operating Company <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={selectedCompanies[0] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSelectedCompanies([val]);
                    set('companyIds', [val]);
                    set('divisionId', val);
                  } else {
                    setSelectedCompanies([]);
                    set('companyIds', []);
                    set('divisionId', '');
                  }
                }}
                style={{ ...inputStyle, padding: '10px 14px', fontSize: '13.5px', fontWeight: 500 }}
              >
                <option value="">-- Select Company --</option>
                {divisions.map((div) => {
                  const id = String(v(div, 'id'));
                  const name = v(div, 'name');
                  const code = v(div, 'code');
                  return (
                    <option key={id} value={id}>
                      {name} {code ? `(Code: ${code})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              {onCancel ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={onCancel}
                  style={{ padding: '9px 22px', fontSize: '13px', borderRadius: '8px' }}
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                className="btn"
                disabled={!selectedCompanies.length}
                onClick={handleConfirmCompany}
                style={{
                  background: '#00b8db',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '9px 26px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: selectedCompanies.length ? 'pointer' : 'not-allowed',
                  opacity: selectedCompanies.length ? 1 : 0.6,
                }}
              >
                Continue to Employee Details →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
            STEP 2: Exact Reference Screenshot Cards Layout
           ========================================================================= */
        <form onSubmit={onSubmit} style={{ width: '100%' }}>
          {/* Top Bar matching screenshot */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Employee
              </h2>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>
                Employee / {isEdit ? 'Edit Employee Details' : 'Create Employee'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(0, 184, 219, 0.08)',
                  border: '1px solid rgba(0, 184, 219, 0.25)',
                  padding: '5px 12px',
                  borderRadius: '20px',
                }}
              >
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Company:</span>
                {(form.companyIds || selectedCompanies).map((id) => {
                  const div = divisions.find((d) => String(v(d, 'id')) === String(id));
                  return (
                    <span
                      key={id}
                      style={{
                        background: '#00b8db',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                      }}
                    >
                      {div ? v(div, 'name') : `Company #${id}`}
                    </span>
                  );
                })}
              </div>
              {!isEdit ? (
                <button
                  type="button"
                  onClick={() => setCompanyConfirmed(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#008fa8',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Change Company
                </button>
              ) : null}
            </div>
          </div>

          {/* Horizontal Tabs Navigation Bar */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              borderBottom: '1px solid #e5e7eb',
              marginBottom: '20px',
              overflowX: 'auto',
            }}
          >
            {[
              { id: 'Personal info', label: 'Personal info' },
              { id: 'Employee details', label: 'Employee details' },
              { id: 'Documents', label: 'Documents' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 4px 12px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#0f172a' : '#64748b',
                    borderBottom: isActive ? '2.5px solid #0f172a' : '2.5px solid transparent',
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

          {/* Subheader section name */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {activeTab}
            </h3>
          </div>

          {/* =========================================================================
              TAB 1: Personal info (Basic info, Address, Work experience, Education)
             ========================================================================= */}
          {activeTab === 'Personal info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Card 1: Basic Information */}
              <SectionCard title="Basic information">
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Left: Avatar Upload Circle */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 120 }}>
                    <div
                      style={{
                        width: 92,
                        height: 92,
                        borderRadius: '50%',
                        background: photoUrl
                          ? `url(${photoUrl}) center/cover no-repeat`
                          : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                        border: '3px solid #00b8db',
                        boxShadow: '0 2px 8px rgba(0, 184, 219, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                        fontSize: '12px',
                        fontWeight: 600,
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      title="Click to change photo"
                    >
                      {!photoUrl ? (
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="#94a3b8">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      ) : null}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={handlePhotoSelect}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                    >
                      {photoUrl ? 'Change Photo' : 'Upload Photo'}
                    </button>
                  </div>

                  {/* Right: Key-Value Rows for Basic Info */}
                  <div style={{ flex: 1 }}>
                    <FieldRow label="Employee Code" helper="Auto-generated serial">
                      <input
                        style={{ ...inputStyle, background: '#f8fafc', fontWeight: 700, color: '#008fa8' }}
                        value={form.empCode || 'Auto-generated'}
                        readOnly={!isEdit}
                        onChange={(e) => set('empCode', e.target.value)}
                      />
                    </FieldRow>

                    <FieldRow label="First Name" required>
                      <input
                        required
                        style={inputStyle}
                        placeholder="e.g. John"
                        value={form.firstName || ''}
                        onChange={(e) => set('firstName', e.target.value)}
                      />
                    </FieldRow>

                    <FieldRow label="Last Name" required>
                      <input
                        required
                        style={inputStyle}
                        placeholder="e.g. Williams"
                        value={form.lastName || ''}
                        onChange={(e) => set('lastName', e.target.value)}
                      />
                    </FieldRow>

                    <FieldRow label="Gender">
                      <select
                        style={inputStyle}
                        value={form.gender || form.personal?.gender || ''}
                        onChange={(e) => {
                          set('gender', e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            personal: { ...(prev.personal || {}), gender: e.target.value },
                          }));
                        }}
                      >
                        <option value="">— Select Gender —</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </FieldRow>

                    <FieldRow label="App Login Email" required helper="Used for mobile app login">
                      <input
                        required
                        type="email"
                        style={inputStyle}
                        placeholder="e.g. john@digitaldive.demo"
                        value={form.email || ''}
                        onChange={(e) => set('email', e.target.value)}
                      />
                    </FieldRow>

                    <FieldRow label="Mobile Phone" helper="Official mobile contact">
                      <input
                        style={inputStyle}
                        placeholder="e.g. +971 50 1234567"
                        value={form.mobilePhone || ''}
                        onChange={(e) => set('mobilePhone', e.target.value)}
                      />
                    </FieldRow>
                  </div>
                </div>
              </SectionCard>

              {/* 2-Column Grid: Address & Work Experience */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {/* Card 2: Address */}
                <SectionCard title="Address">
                  <FieldRow label="Citizen ID address">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Street 12, Sector F-8/3, Islamabad"
                      value={form.homeCountryAddress || ''}
                      onChange={(e) => set('homeCountryAddress', e.target.value)}
                    />
                  </FieldRow>

                  <FieldRow label="Residential address">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Apt 402, Marina Heights, Dubai, UAE"
                      value={form.addressInUae || ''}
                      onChange={(e) => set('addressInUae', e.target.value)}
                    />
                  </FieldRow>

                  <FieldRow label="Current address">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Al Barsha 1, Dubai"
                      value={form.currentAddress || ''}
                      onChange={(e) => set('currentAddress', e.target.value)}
                    />
                  </FieldRow>
                </SectionCard>

                {/* Card 3: Work Experience */}
                <SectionCard title="Work experience">
                  <FieldRow label="Previous company">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Emirates Tech Solutions LLC"
                      value={form.workExperience?.previousCompany || ''}
                      onChange={(e) => setWorkExp('previousCompany', e.target.value)}
                    />
                  </FieldRow>

                  <FieldRow label="Position / Role">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Software Engineer"
                      value={form.workExperience?.position || ''}
                      onChange={(e) => setWorkExp('position', e.target.value)}
                    />
                  </FieldRow>

                  <FieldRow label="Field of work">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Information Technology"
                      value={form.workExperience?.fieldOfWork || ''}
                      onChange={(e) => setWorkExp('fieldOfWork', e.target.value)}
                    />
                  </FieldRow>

                  <FieldRow label="Duration">
                    <input
                      style={inputStyle}
                      placeholder="e.g. 2 Years (Jan 2022 – Dec 2023)"
                      value={form.workExperience?.duration || ''}
                      onChange={(e) => setWorkExp('duration', e.target.value)}
                    />
                  </FieldRow>
                </SectionCard>
              </div>

              {/* Card 4: Education (Full Width) */}
              <SectionCard title="Education">
                <FieldRow label="Education Level">
                  <select
                    style={inputStyle}
                    value={form.education?.educationLevel || ''}
                    onChange={(e) => setEdu('educationLevel', e.target.value)}
                  >
                    <option value="">— Select Education Level —</option>
                    {DUBAI_EDUCATION_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Degree / Major">
                  <input
                    style={inputStyle}
                    placeholder="e.g. Master Degree in Business / Computer Science"
                    value={form.education?.degreeMajor || ''}
                    onChange={(e) => setEdu('degreeMajor', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="University / Institute">
                  <input
                    style={inputStyle}
                    placeholder="e.g. Heriot-Watt Dubai"
                    value={form.education?.universityName || ''}
                    onChange={(e) => setEdu('universityName', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Graduation Year">
                  <input
                    style={inputStyle}
                    placeholder="e.g. 2021"
                    value={form.education?.graduationYear || ''}
                    onChange={(e) => setEdu('graduationYear', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Grade / GPA">
                  <input
                    style={inputStyle}
                    placeholder="e.g. GPA (3.8)"
                    value={form.education?.gradeGpa || ''}
                    onChange={(e) => setEdu('gradeGpa', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="MOFA / MOE Attestation">
                  <select
                    style={inputStyle}
                    value={form.education?.attestationStatus || 'Not Attested'}
                    onChange={(e) => setEdu('attestationStatus', e.target.value)}
                  >
                    <option value="Not Attested">Not Attested</option>
                    <option value="Attested (MOFA/MOE UAE)">Attested (MOFA / MOE UAE)</option>
                    <option value="In Process">In Process</option>
                  </select>
                </FieldRow>
              </SectionCard>
            </div>
          )}

          {/* =========================================================================
              TAB 2: Employee details (Organization & App Credentials)
             ========================================================================= */}
          {activeTab === 'Employee details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SectionCard title="Job & Organization Profile">
                <FieldRow label="Operating Company">
                  <select
                    style={inputStyle}
                    value={form.divisionId || selectedCompanies[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      set('divisionId', val);
                      set('companyIds', [val]);
                    }}
                  >
                    <option value="">— Select Company —</option>
                    {divisions.map((d) => (
                      <option key={v(d, 'id')} value={v(d, 'id')}>
                        {v(d, 'name')}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Department">
                  <select
                    style={inputStyle}
                    value={form.departmentId || ''}
                    onChange={(e) => set('departmentId', e.target.value)}
                  >
                    <option value="">— Select Department —</option>
                    {departments.map((d) => (
                      <option key={v(d, 'id')} value={v(d, 'id')}>
                        {v(d, 'name')}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Designation / Job Title">
                  <select
                    style={inputStyle}
                    value={form.jobTitle || ''}
                    onChange={(e) => set('jobTitle', e.target.value)}
                  >
                    <option value="">— Select Designation —</option>
                    {designations.map((d) => (
                      <option key={v(d, 'id')} value={v(d, 'name')}>
                        {v(d, 'name')}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Position / Role Level">
                  <input
                    style={inputStyle}
                    placeholder="e.g. Senior Associate / Team Lead"
                    value={form.position || ''}
                    onChange={(e) => set('position', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Reporting Manager">
                  <select
                    style={inputStyle}
                    value={form.managerId || ''}
                    onChange={(e) => set('managerId', e.target.value)}
                  >
                    <option value="">— No Manager (Executive / Independent) —</option>
                    {managers.map((m) => (
                      <option key={v(m, 'id')} value={v(m, 'id')}>
                        {v(m, 'fullName', 'full_name')} {v(m, 'jobTitle') ? `(${v(m, 'jobTitle')})` : ''}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Employment Type">
                  <select
                    style={inputStyle}
                    value={form.employmentTypeId || ''}
                    onChange={(e) => set('employmentTypeId', e.target.value)}
                  >
                    <option value="">— Select Type —</option>
                    {employmentTypes.map((t) => (
                      <option key={v(t, 'id')} value={v(t, 'id')}>
                        {v(t, 'name')}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Joining Date">
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.joinDate || ''}
                    onChange={(e) => set('joinDate', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Employment Status">
                  <select
                    style={inputStyle}
                    value={form.status || 'active'}
                    onChange={(e) => set('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="on leave">On Leave</option>
                    <option value="exited">Exited</option>
                  </select>
                </FieldRow>
              </SectionCard>

              {!isEdit ? (
                <SectionCard title="Mobile App Login Credentials">
                  <FieldRow label="Initial App Password" helper="Default: demo123 (min 6 characters)">
                    <input
                      type="password"
                      style={inputStyle}
                      placeholder="demo123"
                      value={form.password || form.appPassword || 'demo123'}
                      onChange={(e) => {
                        set('password', e.target.value);
                        set('appPassword', e.target.value);
                      }}
                    />
                  </FieldRow>
                </SectionCard>
              ) : null}
            </div>
          )}

          {/* =========================================================================
              TAB 3: Documents (Passport, Emirates ID, Files)
             ========================================================================= */}
          {activeTab === 'Documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SectionCard title="Passport & Emirates ID Credentials">
                <FieldRow label="Passport Number">
                  <input
                    style={inputStyle}
                    placeholder="e.g. A12345678"
                    value={form.passportNumber || ''}
                    onChange={(e) => set('passportNumber', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Passport Issue Date">
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.passportStartDate || ''}
                    onChange={(e) => set('passportStartDate', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Passport Expiry Date">
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.passportExpiryDate || ''}
                    onChange={(e) => set('passportExpiryDate', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Emirates ID Number">
                  <input
                    style={inputStyle}
                    placeholder="784-1990-1234567-1"
                    value={form.emiratesIdNumber || ''}
                    onChange={(e) => set('emiratesIdNumber', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Emirates ID Issue Date">
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.emiratesIdStartDate || ''}
                    onChange={(e) => set('emiratesIdStartDate', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Emirates ID Expiry Date">
                  <input
                    type="date"
                    style={inputStyle}
                    value={form.emiratesIdExpiryDate || ''}
                    onChange={(e) => set('emiratesIdExpiryDate', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Previous Visa Type">
                  <select
                    style={inputStyle}
                    value={form.previousVisaType || 'N/A'}
                    onChange={(e) => set('previousVisaType', e.target.value)}
                  >
                    {PREVIOUS_VISA_TYPES.map((vt) => (
                      <option key={vt} value={vt}>{vt}</option>
                    ))}
                  </select>
                </FieldRow>
              </SectionCard>

              <SectionCard title="Uploaded Documents & Attachments">
                <FieldRow label="Experience Letter">
                  <input
                    ref={expLetterRef}
                    type="file"
                    style={inputStyle}
                    onChange={(e) => set('experienceLetterName', e.target.files?.[0]?.name || '')}
                  />
                </FieldRow>

                <FieldRow label="Educational Certificate">
                  <input
                    ref={eduCertRef}
                    type="file"
                    style={inputStyle}
                    onChange={(e) => set('educationalCertificateName', e.target.files?.[0]?.name || '')}
                  />
                </FieldRow>
              </SectionCard>
            </div>
          )}

          {/* Form Actions Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e7eb',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              {activeTab !== 'Personal info' ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (activeTab === 'Documents') setActiveTab('Employee details');
                    else if (activeTab === 'Employee details') setActiveTab('Personal info');
                  }}
                  style={{ padding: '8px 16px', fontSize: '12.5px', borderRadius: '8px' }}
                >
                  ← Previous Tab
                </button>
              ) : null}

              {activeTab !== 'Documents' ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (activeTab === 'Personal info') setActiveTab('Employee details');
                    else if (activeTab === 'Employee details') setActiveTab('Documents');
                  }}
                  style={{ padding: '8px 16px', fontSize: '12.5px', borderRadius: '8px', color: '#008fa8', fontWeight: 600 }}
                >
                  Next Tab →
                </button>
              ) : null}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onCancel ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={onCancel}
                  style={{ padding: '8px 18px', fontSize: '12.5px', borderRadius: '8px' }}
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                className="btn"
                disabled={saving}
                style={{
                  background: '#00b8db',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '9px 26px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: saving ? 'wait' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 184, 219, 0.3)',
                }}
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Employee Record'}
              </button>
            </div>
          </div>

          {extraFooter}
        </form>
      )}
    </div>
  );
}
