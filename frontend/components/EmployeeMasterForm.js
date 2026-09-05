import { useRef, useState } from 'react';
import { getApiBase } from '../lib/auth';
import { v } from '../lib/format';

const COUNTRIES = [
  'United Arab Emirates',
  'Pakistan',
  'India',
  'Egypt',
  'Philippines',
  'United Kingdom',
  'United States',
  'Canada',
  'Saudi Arabia',
  'Oman',
  'Kuwait',
  'Qatar',
  'Bahrain',
  'Jordan',
  'Lebanon',
  'Syria',
  'Bangladesh',
  'Sri Lanka',
  'Nepal',
  'South Africa',
  'Other',
];

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

const MARITAL_STATUSES = [
  'Single',
  'Married',
  'Divorced',
  'Widowed',
];

function CleanField({ label, required = false, children, helper = '', style = {} }) {
  return (
    <label style={{ display: 'block', margin: 0, ...style }}>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#475569',
          display: 'block',
          marginBottom: '5px',
        }}
      >
        {label} {required ? <span style={{ color: '#ef4444' }}>*</span> : null}
      </span>
      {children}
      {helper ? (
        <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
          {helper}
        </span>
      ) : null}
    </label>
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

  // Form Tabs State: 'Personal info' | 'Employee details' | 'Documents'
  const [activeTab, setActiveTab] = useState('Personal info');

  // Step 1: Gatekeeper Company Selection during create mode
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

  // Profile image handler
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const preview = URL.createObjectURL(file);
      setForm((prev) => ({ ...prev, photoFile: file, photoPreview: preview }));
    }
  };

  // Helper to resolve photo preview
  const photoUrl =
    form.photoPreview ||
    (form.photoPath
      ? `${getApiBase().replace(/\/api\/?$/, '')}/${form.photoPath.replace(/^\//, '')}`
      : null);

  const inputStyle = {
    width: '100%',
    padding: '8.5px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#0f172a',
    background: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  };

  return (
    <div className="emp-clean-form-container" style={{ width: '100%' }}>
      {/* =========================================================================
          STEP 1: Company Selection Gatekeeper (Only during create mode)
         ========================================================================= */}
      {!companyConfirmed && !isEdit ? (
        <div
          className="card company-select-gate"
          style={{
            padding: '36px 28px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
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
              Step 1: Select Company
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 24px', lineHeight: 1.5 }}>
              Please select the operating company this employee will work for. You can reassign or adjust divisions at any time.
            </p>

            <div style={{ marginBottom: '24px', textAlign: 'left' }}>
              <label
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#334155',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
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
                style={{
                  ...inputStyle,
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                }}
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
              {!divisions.length ? (
                <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '12px', color: '#94a3b8' }}>
                  No companies configured. Please add companies in Company Master first.
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              {onCancel ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={onCancel}
                  style={{
                    padding: '9px 22px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
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
                  boxShadow: '0 2px 6px rgba(0, 184, 219, 0.3)',
                }}
              >
                Continue to Employee Details →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
            STEP 2: Executive Multi-Tab Form (Exact Reference Screenshot Layout)
           ========================================================================= */
        <form onSubmit={onSubmit} style={{ width: '100%' }}>
          {/* Executive Top Header (Matching Screenshot) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Employee
              </h2>
              <div
                style={{
                  fontSize: '12px',
                  color: '#008fa8',
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                Employee / {isEdit ? 'Edit Employee Details' : 'Create Employee'}
              </div>
            </div>

            {/* Operating Company Badge & Change Action */}
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

          {/* Horizontal Tabs Navigation Bar (Cyan Underline on Active Tab) */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              borderBottom: '1px solid #e2e8f0',
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

          {/* Sub-header section name matching screenshot */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {activeTab}
            </h3>
          </div>

          {/* =========================================================================
              TAB 1: Personal info
             ========================================================================= */}
          {activeTab === 'Personal info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Card 1: Basic Information */}
              <div
                className="card"
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '24px',
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
                  <span style={{ color: '#008fa8', fontSize: '13px' }}>✎</span>
                </div>

                {/* Avatar + Fields Layout */}
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Left: Avatar circle with upload button */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      minWidth: 120,
                    }}
                  >
                    <div
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: '50%',
                        background: photoUrl
                          ? `url(${photoUrl}) center/cover no-repeat`
                          : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)',
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

                  {/* Right: Grid of fields */}
                  <div
                    style={{
                      flex: 1,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '14px',
                    }}
                  >
                    <CleanField label="Employee Code" helper="Auto-generated serial">
                      <input
                        style={{ ...inputStyle, background: '#f8fafc', fontWeight: 700, color: '#008fa8' }}
                        value={form.empCode || 'Auto-generated'}
                        readOnly={!isEdit}
                        onChange={(e) => set('empCode', e.target.value)}
                      />
                    </CleanField>

                    <CleanField label="First Name" required>
                      <input
                        required
                        style={inputStyle}
                        placeholder="e.g. John"
                        value={form.firstName || ''}
                        onChange={(e) => set('firstName', e.target.value)}
                      />
                    </CleanField>

                    <CleanField label="Last Name" required>
                      <input
                        required
                        style={inputStyle}
                        placeholder="e.g. Williams"
                        value={form.lastName || ''}
                        onChange={(e) => set('lastName', e.target.value)}
                      />
                    </CleanField>

                    <CleanField label="Gender">
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
                    </CleanField>

                    <CleanField label="App Login Email" required helper="Used for mobile app login">
                      <input
                        required
                        type="email"
                        style={inputStyle}
                        placeholder="e.g. john@digitaldive.demo"
                        value={form.email || ''}
                        onChange={(e) => set('email', e.target.value)}
                      />
                    </CleanField>

                    <CleanField label="Mobile Phone" helper="Official mobile contact">
                      <input
                        style={inputStyle}
                        placeholder="e.g. +971 50 1234567"
                        value={form.mobilePhone || ''}
                        onChange={(e) => set('mobilePhone', e.target.value)}
                      />
                    </CleanField>

                    <CleanField label="Birth date">
                      <input
                        type="date"
                        style={inputStyle}
                        value={form.dateOfBirth || form.personal?.dateOfBirth || ''}
                        onChange={(e) => {
                          set('dateOfBirth', e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            personal: { ...(prev.personal || {}), dateOfBirth: e.target.value },
                          }));
                        }}
                      />
                    </CleanField>

                    <CleanField label="Marital Status">
                      <select
                        style={inputStyle}
                        value={form.maritalStatus || form.personal?.maritalStatus || ''}
                        onChange={(e) => {
                          set('maritalStatus', e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            personal: { ...(prev.personal || {}), maritalStatus: e.target.value },
                          }));
                        }}
                      >
                        <option value="">— Select Status —</option>
                        {MARITAL_STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </CleanField>

                    <CleanField label="Nationality">
                      <select
                        style={inputStyle}
                        value={form.nationality || form.personal?.nationality || ''}
                        onChange={(e) => {
                          set('nationality', e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            personal: { ...(prev.personal || {}), nationality: e.target.value },
                          }));
                        }}
                      >
                        <option value="">— Select Country —</option>
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </CleanField>
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
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '22px',
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
                    <span style={{ color: '#008fa8', fontSize: '13px' }}>✎</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <CleanField label="Citizen ID Address / Home Country Address">
                      <input
                        style={inputStyle}
                        placeholder="e.g. Street 12, Sector F-8/3, Islamabad"
                        value={form.homeCountryAddress || ''}
                        onChange={(e) => set('homeCountryAddress', e.target.value)}
                      />
                    </CleanField>

                    <CleanField label="Residential Address / Address in UAE">
                      <input
                        style={inputStyle}
                        placeholder="e.g. Apt 402, Marina Heights, Dubai, UAE"
                        value={form.addressInUae || ''}
                        onChange={(e) => set('addressInUae', e.target.value)}
                      />
                    </CleanField>

                    <CleanField label="Current / Local Address (Optional)">
                      <input
                        style={inputStyle}
                        placeholder="e.g. Al Barsha 1, Dubai"
                        value={form.currentAddress || ''}
                        onChange={(e) => set('currentAddress', e.target.value)}
                      />
                    </CleanField>
                  </div>
                </div>

                {/* Card 3: Education */}
                <div
                  className="card"
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '22px',
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
                      Education (UAE Standard)
                    </h4>
                    <span style={{ color: '#008fa8', fontSize: '13px' }}>✎</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <CleanField label="Education Level">
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
                    </CleanField>

                    <CleanField label="Degree / Major Field">
                      <input
                        style={inputStyle}
                        placeholder="e.g. Master Degree in Business / Computer Science"
                        value={form.education?.degreeMajor || ''}
                        onChange={(e) => setEdu('degreeMajor', e.target.value)}
                      />
                    </CleanField>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <CleanField label="University / Institute">
                        <input
                          style={inputStyle}
                          placeholder="e.g. Heriot-Watt Dubai"
                          value={form.education?.universityName || ''}
                          onChange={(e) => setEdu('universityName', e.target.value)}
                        />
                      </CleanField>

                      <CleanField label="Graduation Year">
                        <input
                          style={inputStyle}
                          placeholder="e.g. 2021"
                          value={form.education?.graduationYear || ''}
                          onChange={(e) => setEdu('graduationYear', e.target.value)}
                        />
                      </CleanField>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <CleanField label="Country of Study">
                        <select
                          style={inputStyle}
                          value={form.education?.countryOfStudy || ''}
                          onChange={(e) => setEdu('countryOfStudy', e.target.value)}
                        >
                          <option value="">— Select Country —</option>
                          {COUNTRIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </CleanField>

                      <CleanField label="Grade / GPA">
                        <input
                          style={inputStyle}
                          placeholder="e.g. GPA (3.8)"
                          value={form.education?.gradeGpa || ''}
                          onChange={(e) => setEdu('gradeGpa', e.target.value)}
                        />
                      </CleanField>
                    </div>

                    <CleanField label="MOFA / MOE Attestation Status">
                      <select
                        style={inputStyle}
                        value={form.education?.attestationStatus || 'Not Attested'}
                        onChange={(e) => setEdu('attestationStatus', e.target.value)}
                      >
                        <option value="Not Attested">Not Attested</option>
                        <option value="Attested (MOFA/MOE UAE)">Attested (MOFA / MOE UAE)</option>
                        <option value="In Process">In Process</option>
                      </select>
                    </CleanField>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: Employee details
             ========================================================================= */}
          {activeTab === 'Employee details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Card 1: Job & Organization Profile */}
              <div
                className="card"
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '22px',
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
                  <span style={{ color: '#008fa8', fontSize: '13px' }}>✎</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <CleanField label="Operating Company">
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
                  </CleanField>

                  <CleanField label="Department">
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
                  </CleanField>

                  <CleanField label="Designation / Job Title">
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
                  </CleanField>

                  <CleanField label="Position / Role Level">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Senior Associate / Team Lead"
                      value={form.position || ''}
                      onChange={(e) => set('position', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Reporting Manager">
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
                  </CleanField>

                  <CleanField label="Employment Type">
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
                  </CleanField>

                  <CleanField label="Start / Joining Date">
                    <input
                      type="date"
                      style={inputStyle}
                      value={form.joinDate || ''}
                      onChange={(e) => set('joinDate', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Employment Status">
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
                  </CleanField>
                </div>
              </div>

              {/* Card 2: Work Experience */}
              <div
                className="card"
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '22px',
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
                  <span style={{ color: '#008fa8', fontSize: '13px' }}>✎</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <CleanField label="Previous Company Name">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Emirates Tech Solutions LLC"
                      value={form.workExperience?.previousCompany || ''}
                      onChange={(e) => setWorkExp('previousCompany', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Field of Work / Industry">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Information Technology / Logistics"
                      value={form.workExperience?.fieldOfWork || ''}
                      onChange={(e) => setWorkExp('fieldOfWork', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Position / Role Held">
                    <input
                      style={inputStyle}
                      placeholder="e.g. Software Engineer / Operations Officer"
                      value={form.workExperience?.position || ''}
                      onChange={(e) => setWorkExp('position', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Duration / Time Period">
                    <input
                      style={inputStyle}
                      placeholder="e.g. 2 Years (Jan 2022 – Dec 2023)"
                      value={form.workExperience?.duration || ''}
                      onChange={(e) => setWorkExp('duration', e.target.value)}
                    />
                  </CleanField>
                </div>
              </div>

              {/* Card 3: Mobile App Login Credentials (During Create Mode) */}
              {!isEdit ? (
                <div
                  className="card"
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    padding: '22px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  }}
                >
                  <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
                    Mobile App Login Credentials
                  </h4>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
                    Specify the default password for the employee&apos;s mobile app account. They will use their App Login Email and this password.
                  </p>

                  <div style={{ maxWidth: '340px' }}>
                    <CleanField label="Initial App Password" helper="Default: demo123 (min 6 chars)">
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
                    </CleanField>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* =========================================================================
              TAB 3: Documents
             ========================================================================= */}
          {activeTab === 'Documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Card 1: Passport & Emirates ID */}
              <div
                className="card"
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '22px',
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
                  <span style={{ color: '#008fa8', fontSize: '13px' }}>✎</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '14px',
                  }}
                >
                  <CleanField label="Passport Number">
                    <input
                      style={inputStyle}
                      placeholder="e.g. A12345678"
                      value={form.passportNumber || ''}
                      onChange={(e) => set('passportNumber', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Passport Issue Date">
                    <input
                      type="date"
                      style={inputStyle}
                      value={form.passportStartDate || ''}
                      onChange={(e) => set('passportStartDate', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Passport Expiry Date">
                    <input
                      type="date"
                      style={inputStyle}
                      value={form.passportExpiryDate || ''}
                      onChange={(e) => set('passportExpiryDate', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Emirates ID Number">
                    <input
                      style={inputStyle}
                      placeholder="784-1990-1234567-1"
                      value={form.emiratesIdNumber || ''}
                      onChange={(e) => set('emiratesIdNumber', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Emirates ID Issue Date">
                    <input
                      type="date"
                      style={inputStyle}
                      value={form.emiratesIdStartDate || ''}
                      onChange={(e) => set('emiratesIdStartDate', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Emirates ID Expiry Date">
                    <input
                      type="date"
                      style={inputStyle}
                      value={form.emiratesIdExpiryDate || ''}
                      onChange={(e) => set('emiratesIdExpiryDate', e.target.value)}
                    />
                  </CleanField>

                  <CleanField label="Previous Visa Type">
                    <select
                      style={inputStyle}
                      value={form.previousVisaType || 'N/A'}
                      onChange={(e) => set('previousVisaType', e.target.value)}
                    >
                      {PREVIOUS_VISA_TYPES.map((vt) => (
                        <option key={vt} value={vt}>{vt}</option>
                      ))}
                    </select>
                  </CleanField>
                </div>
              </div>

              {/* Card 2: Uploaded Files & Attachments */}
              <div
                className="card"
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '22px',
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
                    Uploaded Documents & Attachments
                  </h4>
                  <span style={{ color: '#008fa8', fontSize: '13px' }}>✎</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div>
                    <CleanField label="Experience Letter (Optional)">
                      <input
                        ref={expLetterRef}
                        type="file"
                        style={inputStyle}
                        onChange={(e) => set('experienceLetterName', e.target.files?.[0]?.name || '')}
                      />
                    </CleanField>
                    {form.experienceLetterName ? (
                      <div style={{ fontSize: '12px', color: '#10b981', marginTop: 4, fontWeight: 600 }}>
                        ✓ {form.experienceLetterName}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <CleanField label="Educational Certificate (Optional)">
                      <input
                        ref={eduCertRef}
                        type="file"
                        style={inputStyle}
                        onChange={(e) => set('educationalCertificateName', e.target.files?.[0]?.name || '')}
                      />
                    </CleanField>
                    {form.educationalCertificateName ? (
                      <div style={{ fontSize: '12px', color: '#10b981', marginTop: 4, fontWeight: 600 }}>
                        ✓ {form.educationalCertificateName}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions / Navigation Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            {/* Left: Tab switch shortcuts */}
            <div style={{ display: 'flex', gap: 8 }}>
              {activeTab !== 'Personal info' ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (activeTab === 'Documents') setActiveTab('Employee details');
                    else if (activeTab === 'Employee details') setActiveTab('Personal info');
                  }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
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
                  style={{
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#008fa8',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Next Tab →
                </button>
              ) : null}
            </div>

            {/* Right: Submit / Cancel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onCancel ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={onCancel}
                  style={{
                    padding: '8px 18px',
                    fontSize: '12.5px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
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
