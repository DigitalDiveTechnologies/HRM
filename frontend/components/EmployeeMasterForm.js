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

function Field({ label, required = false, children, className = '', helper = '' }) {
  return (
    <label className={`field emp-clean-field ${className}`} style={{ margin: 0 }}>
      <span className="emp-clean-label" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', display: 'block', marginBottom: '4px' }}>
        {label} {required ? <span style={{ color: '#ef4444' }}>*</span> : null}
      </span>
      {children}
      {helper ? <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>{helper}</span> : null}
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

  // Toggle company selection (supports 1 or multiple companies)
  const toggleCompany = (compId) => {
    const sId = String(compId);
    let next;
    if (selectedCompanies.includes(sId)) {
      next = selectedCompanies.filter((id) => id !== sId);
    } else {
      next = [...selectedCompanies, sId];
    }
    setSelectedCompanies(next);
    set('companyIds', next);
    set('divisionId', next[0] || '');
  };

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

  return (
    <div className="emp-clean-form-container">
      {/* =========================================================================
          STEP 1: Company Selection Gatekeeper (Only during create mode)
         ========================================================================= */}
      {!companyConfirmed && !isEdit ? (
        <div className="card company-select-gate" style={{ padding: '28px', textAlign: 'center' }}>
          <div style={{ maxWidth: '520px', margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(0, 184, 219, 0.12)', marginBottom: '14px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00b8db" strokeWidth="2">
                <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 3h6v4H9z" />
              </svg>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px', color: 'var(--ink)' }}>
              Step 1: Select Company
            </h3>
            <p className="muted" style={{ fontSize: '13px', margin: '0 0 22px' }}>
              Please select the company this employee will work for. An employee can also be assigned to multiple companies.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', marginBottom: '22px' }}>
              {divisions.map((div) => {
                const id = String(v(div, 'id'));
                const name = v(div, 'name');
                const code = v(div, 'code');
                const isChecked = selectedCompanies.includes(id);

                return (
                  <label
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: `2px solid ${isChecked ? '#00b8db' : 'var(--line)'}`,
                      background: isChecked ? 'rgba(0, 184, 219, 0.05)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCompany(id)}
                        style={{ width: '18px', height: '18px', accentColor: '#00b8db' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>{name}</div>
                        {code ? <div className="muted" style={{ fontSize: '12px' }}>Code: {code}</div> : null}
                      </div>
                    </div>
                    {isChecked ? (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#008fa8', background: 'rgba(0, 184, 219, 0.12)', padding: '2px 8px', borderRadius: '4px' }}>
                        Selected
                      </span>
                    ) : null}
                  </label>
                );
              })}
              {!divisions.length ? (
                <div className="muted" style={{ textAlign: 'center', padding: '16px' }}>
                  No companies configured. Please add companies in Company Master first.
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              {onCancel ? (
                <button type="button" className="btn secondary" onClick={onCancel} style={{ padding: '8px 20px' }}>
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
                  padding: '8px 24px',
                  borderRadius: '6px',
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
            STEP 2: Clean Employee Details Form (Sequenced Sections)
           ========================================================================= */
        <form onSubmit={onSubmit} className="stack emp-form-sections" style={{ gap: '20px' }}>
          {/* Assigned Company Header / Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'rgba(0, 184, 219, 0.08)',
              border: '1px solid rgba(0, 184, 219, 0.25)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>Assigned Company:</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(form.companyIds || selectedCompanies).map((id) => {
                  const div = divisions.find((d) => String(v(d, 'id')) === String(id));
                  return (
                    <span key={id} style={{ background: '#00b8db', color: '#ffffff', fontSize: '11.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>
                      {div ? v(div, 'name') : `Company #${id}`}
                    </span>
                  );
                })}
              </div>
            </div>
            {!isEdit ? (
              <button
                type="button"
                onClick={() => setCompanyConfirmed(false)}
                style={{ background: 'transparent', border: 'none', color: '#008fa8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Change Company
              </button>
            ) : null}
          </div>

          {/* Profile Photo Uploader at Top */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: photoUrl ? `url(${photoUrl}) center/cover no-repeat` : 'var(--surface-alt)',
                border: '2px dashed var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted)',
                fontSize: '11px',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {!photoUrl ? 'No Photo' : null}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)', marginBottom: '4px' }}>
                Profile Photo
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: '8px' }}>
                Upload employee avatar for ID badge & mobile profile (PNG, JPG, max 5MB)
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
                className="btn secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '12px', padding: '4px 12px' }}
              >
                {form.photoFile ? 'Change Photo' : 'Upload Photo'}
              </button>
              {form.photoFile ? (
                <span style={{ fontSize: '11px', color: '#10b981', marginLeft: '10px', fontWeight: 600 }}>
                  Selected: {form.photoFile.name}
                </span>
              ) : null}
            </div>
          </div>

          {/* -----------------------------------------------------------------------
              SECTION 1: Personal & Official Details
             ----------------------------------------------------------------------- */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '10px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
                1. Personal & Official Details
              </h3>
              <p className="muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
                Basic identification, contact information, official assignments and legal travel documents
              </p>
            </div>

            {/* Grid 1: Basic Identity & Logins */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <Field label="Employee Code" helper="Auto-generated serial">
                <input
                  value={form.empCode || 'Auto-generated'}
                  readOnly={!isEdit}
                  onChange={(e) => set('empCode', e.target.value)}
                  style={{ background: !isEdit ? 'var(--surface-alt)' : 'inherit', fontWeight: 600 }}
                />
              </Field>

              <Field label="First Name" required>
                <input
                  required
                  placeholder="e.g. John"
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                />
              </Field>

              <Field label="Last Name" required>
                <input
                  required
                  placeholder="e.g. Doe"
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                />
              </Field>

              <Field label="App Login Email" required helper="Used for mobile app login">
                <input
                  required
                  type="email"
                  placeholder="e.g. john@digitaldive.demo"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>

              <Field label="Phone Number" helper="Official mobile contact">
                <input
                  placeholder="e.g. +971 50 1234567"
                  value={form.mobilePhone}
                  onChange={(e) => set('mobilePhone', e.target.value)}
                />
              </Field>

              {!isEdit ? (
                <Field label="App Login Password" helper="Default: demo123">
                  <input
                    type="password"
                    placeholder="demo123"
                    value={form.appPassword || 'demo123'}
                    onChange={(e) => set('appPassword', e.target.value)}
                  />
                </Field>
              ) : null}
            </div>

            {/* Grid 2: Official Corporate Assignments */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <Field label="Department">
                <select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                  <option value="">— Select Department —</option>
                  {departments.map((d) => (
                    <option key={v(d, 'id')} value={v(d, 'id')}>
                      {v(d, 'name')}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Designation / Job Title">
                <select value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)}>
                  <option value="">— Select Designation —</option>
                  {designations.map((d) => (
                    <option key={v(d, 'id')} value={v(d, 'name')}>
                      {v(d, 'name')}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Position / Role Level">
                <input
                  placeholder="e.g. Senior Associate / Team Lead"
                  value={form.position}
                  onChange={(e) => set('position', e.target.value)}
                />
              </Field>

              <Field label="Reporting Manager">
                <select value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
                  <option value="">— No Manager (Executive / Independent) —</option>
                  {managers.map((m) => (
                    <option key={v(m, 'id')} value={v(m, 'id')}>
                      {v(m, 'fullName', 'full_name')} {v(m, 'jobTitle') ? `(${v(m, 'jobTitle')})` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Employment Type">
                <select value={form.employmentTypeId} onChange={(e) => set('employmentTypeId', e.target.value)}>
                  <option value="">— Select Type —</option>
                  {employmentTypes.map((t) => (
                    <option key={v(t, 'id')} value={v(t, 'id')}>
                      {v(t, 'name')}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Start / Joining Date">
                <input
                  type="date"
                  value={form.joinDate}
                  onChange={(e) => set('joinDate', e.target.value)}
                />
              </Field>
            </div>

            {/* Grid 3: Nationality & Addresses */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <Field label="Nationality">
                <select value={form.nationality} onChange={(e) => set('nationality', e.target.value)}>
                  <option value="">— Select Country / Nationality —</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Current Address">
                <input
                  placeholder="e.g. Apt 402, Marina Heights, Dubai"
                  value={form.currentAddress}
                  onChange={(e) => set('currentAddress', e.target.value)}
                />
              </Field>

              <Field label="Address in UAE">
                <input
                  placeholder="e.g. Al Barsha 1, Dubai, UAE"
                  value={form.addressInUae}
                  onChange={(e) => set('addressInUae', e.target.value)}
                />
              </Field>

              <Field label="Home Country Address">
                <input
                  placeholder="e.g. Street 12, F-8/3, Islamabad"
                  value={form.homeCountryAddress}
                  onChange={(e) => set('homeCountryAddress', e.target.value)}
                />
              </Field>
            </div>

            {/* Grid 4: Passport, Emirates ID & Visa Credentials */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <Field label="Passport Number">
                <input
                  placeholder="e.g. A12345678"
                  value={form.passportNumber}
                  onChange={(e) => set('passportNumber', e.target.value)}
                />
              </Field>

              <Field label="Passport Issue Date">
                <input
                  type="date"
                  value={form.passportStartDate}
                  onChange={(e) => set('passportStartDate', e.target.value)}
                />
              </Field>

              <Field label="Passport Expiry Date">
                <input
                  type="date"
                  value={form.passportExpiryDate}
                  onChange={(e) => set('passportExpiryDate', e.target.value)}
                />
              </Field>

              <Field label="Emirates ID Number">
                <input
                  placeholder="784-1990-1234567-1"
                  value={form.emiratesIdNumber}
                  onChange={(e) => set('emiratesIdNumber', e.target.value)}
                />
              </Field>

              <Field label="Emirates ID Issue Date">
                <input
                  type="date"
                  value={form.emiratesIdStartDate}
                  onChange={(e) => set('emiratesIdStartDate', e.target.value)}
                />
              </Field>

              <Field label="Emirates ID Expiry Date">
                <input
                  type="date"
                  value={form.emiratesIdExpiryDate}
                  onChange={(e) => set('emiratesIdExpiryDate', e.target.value)}
                />
              </Field>

              <Field label="Previous Visa Type">
                <select value={form.previousVisaType} onChange={(e) => set('previousVisaType', e.target.value)}>
                  {PREVIOUS_VISA_TYPES.map((vt) => (
                    <option key={vt} value={vt}>{vt}</option>
                  ))}
                </select>
              </Field>

              <Field label="Experience Letter (Optional)">
                <input
                  ref={expLetterRef}
                  type="file"
                  onChange={(e) => set('experienceLetterName', e.target.files?.[0]?.name || '')}
                />
              </Field>

              <Field label="Educational Certificate (Optional)">
                <input
                  ref={eduCertRef}
                  type="file"
                  onChange={(e) => set('educationalCertificateName', e.target.files?.[0]?.name || '')}
                />
              </Field>
            </div>
          </div>

          {/* -----------------------------------------------------------------------
              SECTION 2: Work Experience (No duplicate personal fields)
             ----------------------------------------------------------------------- */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '10px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
                2. Work Experience
              </h3>
              <p className="muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
                Previous employment background, industry field, and past roles (optional)
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <Field label="Previous Company Name">
                <input
                  placeholder="e.g. Emirates Tech Solutions LLC"
                  value={form.workExperience?.previousCompany || ''}
                  onChange={(e) => setWorkExp('previousCompany', e.target.value)}
                />
              </Field>

              <Field label="Field of Work / Industry">
                <input
                  placeholder="e.g. Information Technology / Logistics"
                  value={form.workExperience?.fieldOfWork || ''}
                  onChange={(e) => setWorkExp('fieldOfWork', e.target.value)}
                />
              </Field>

              <Field label="Position / Job Title Held">
                <input
                  placeholder="e.g. Software Engineer / Operations Officer"
                  value={form.workExperience?.position || ''}
                  onChange={(e) => setWorkExp('position', e.target.value)}
                />
              </Field>

              <Field label="Duration / Time Period">
                <input
                  placeholder="e.g. 2 Years (Jan 2022 – Dec 2023)"
                  value={form.workExperience?.duration || ''}
                  onChange={(e) => setWorkExp('duration', e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* -----------------------------------------------------------------------
              SECTION 3: Education Details (Dubai / UAE Accredited Standard)
             ----------------------------------------------------------------------- */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
            <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '10px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--ink)' }}>
                3. Education Details
              </h3>
              <p className="muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
                Academic qualifications structured in accordance with UAE / Dubai Ministry of Education standards (all optional)
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <Field label="Education Level (UAE Standard)">
                <select
                  value={form.education?.educationLevel || ''}
                  onChange={(e) => setEdu('educationLevel', e.target.value)}
                >
                  <option value="">— Select Education Level —</option>
                  {DUBAI_EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </Field>

              <Field label="Degree / Major Field">
                <input
                  placeholder="e.g. B.Sc. Computer Science / Business Administration"
                  value={form.education?.degreeMajor || ''}
                  onChange={(e) => setEdu('degreeMajor', e.target.value)}
                />
              </Field>

              <Field label="University / Institute Name">
                <input
                  placeholder="e.g. Heriot-Watt University Dubai"
                  value={form.education?.universityName || ''}
                  onChange={(e) => setEdu('universityName', e.target.value)}
                />
              </Field>

              <Field label="Country of Study">
                <select
                  value={form.education?.countryOfStudy || ''}
                  onChange={(e) => setEdu('countryOfStudy', e.target.value)}
                >
                  <option value="">— Select Country —</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Graduation Year">
                <input
                  placeholder="e.g. 2021"
                  value={form.education?.graduationYear || ''}
                  onChange={(e) => setEdu('graduationYear', e.target.value)}
                />
              </Field>

              <Field label="UAE MOFA / MOE Attestation (Optional)">
                <select
                  value={form.education?.attestationStatus || 'Not Attested'}
                  onChange={(e) => setEdu('attestationStatus', e.target.value)}
                >
                  <option value="Not Attested">Not Attested</option>
                  <option value="Attested (MOFA/MOE UAE)">Attested (MOFA / MOE UAE)</option>
                  <option value="In Process">In Process</option>
                </select>
              </Field>

              <Field label="Grade / GPA / Division (Optional)">
                <input
                  placeholder="e.g. 3.7 GPA / First Class"
                  value={form.education?.gradeGpa || ''}
                  onChange={(e) => setEdu('gradeGpa', e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            {onCancel ? (
              <button type="button" className="btn secondary" onClick={onCancel} style={{ padding: '8px 18px' }}>
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
                fontWeight: 600,
                fontSize: '13px',
                padding: '8px 24px',
                borderRadius: '6px',
                border: 'none',
                cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Employee Record'}
            </button>
          </div>

          {extraFooter}
        </form>
      )}
    </div>
  );
}
