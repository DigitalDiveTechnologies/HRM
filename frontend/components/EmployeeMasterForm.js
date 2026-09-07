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

const DOCUMENT_CATEGORIES = [
  'Passport',
  'Visa',
  'Emirates ID',
  'CNIC / National ID',
  'Offer Letter / Employment Contract',
  'Other Document',
];

const NATIONALITIES = [
  'United Arab Emirates (UAE)',
  'Pakistan',
  'India',
  'Philippines',
  'Egypt',
  'United Kingdom',
  'United States',
  'Saudi Arabia',
  'Oman',
  'Qatar',
  'Bahrain',
  'Kuwait',
  'Bangladesh',
  'Sri Lanka',
  'Nepal',
  'Jordan',
  'Lebanon',
  'Syria',
  'Sudan',
  'Yemen',
  'Morocco',
  'Tunisia',
  'Algeria',
  'Canada',
  'Australia',
  'South Africa',
  'Russia',
  'Ukraine',
  'Turkey',
  'Iran',
  'China',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Afghanistan',
  'Nigeria',
  'Kenya',
  'Ghana',
  'Other',
];

function FieldRow({ label, required = false, children, helper = '' }) {
  return (
    <div
      className="emp-row-divider"
      style={{
        display: 'grid',
        gridTemplateColumns: '190px 1fr',
        gap: '16px',
        alignItems: 'center',
        padding: '10px 0',
      }}
    >
      <label className="emp-row-label" style={{ margin: 0 }}>
        {label} {required ? <span style={{ color: '#ef4444' }}>*</span> : null}
        {helper ? (
          <span style={{ display: 'block', fontSize: '11px', fontWeight: 400, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
            {helper}
          </span>
        ) : null}
      </label>
      <div>{children}</div>
    </div>
  );
}

function SectionCard({ title, children, style = {}, disabled = false, onSectionSave, isSaved = false }) {
  return (
    <div className="emp-card" style={style}>
      <div className="emp-card-header">
        <h4 className="emp-card-title">
          {title}
        </h4>
        <span style={{ color: 'var(--muted, #94a3b8)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </span>
      </div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line, #e2e8f0)' }}>
        <button
          type={onSectionSave ? "button" : "submit"}
          onClick={onSectionSave}
          disabled={disabled}
          className="btn"
          style={{
            background: isSaved ? '#059669' : (disabled ? '#94a3b8' : '#00b8db'),
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '12px',
            padding: '7px 18px',
            borderRadius: '6px',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: disabled ? 'none' : isSaved ? '0 2px 6px rgba(5, 150, 105, 0.3)' : '0 2px 6px rgba(0, 184, 219, 0.25)',
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {isSaved ? 'Saved' : `Save ${title}`}
        </button>
      </div>
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
  const [showPassword, setShowPassword] = useState(false);
  const [savedSectionName, setSavedSectionName] = useState('');

  const triggerSectionSuccess = (sectionName) => {
    setSavedSectionName(sectionName);
    setTimeout(() => {
      setSavedSectionName((curr) => (curr === sectionName ? '' : curr));
    }, 3000);
    if (onSubmit) {
      try {
        onSubmit();
      } catch (err) {
        console.error('Section save error:', err);
      }
    }
  };

  // Custom Documents state for Tab 3
  const [selectedDocType, setSelectedDocType] = useState('Passport');
  const [docTitle, setDocTitle] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);
  const docFileInputRef = useRef(null);

  const customDocs = Array.isArray(form.customDocuments) ? form.customDocuments : [];

  const handleDocFilesSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newDocs = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      const isImg = file.type.startsWith('image/');
      return {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
        type: selectedDocType,
        title: docTitle.trim() || selectedDocType,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        fileUrl: previewUrl,
        fileType: file.type,
        isImage: isImg,
        uploadDate: new Date().toLocaleDateString(),
        fileObject: file,
      };
    });

    const updated = [...customDocs, ...newDocs];
    setForm((prev) => ({
      ...prev,
      customDocuments: updated,
    }));
    setDocTitle('');
    if (docFileInputRef.current) docFileInputRef.current.value = '';
  };

  const removeCustomDoc = (docId) => {
    const docToRemove = customDocs.find((d) => d.id === docId);
    if (docToRemove?.fileUrl && docToRemove.fileUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(docToRemove.fileUrl);
      } catch {}
    }
    const updated = customDocs.filter((d) => d.id !== docId);
    setForm((prev) => ({
      ...prev,
      customDocuments: updated,
    }));
    if (previewDoc?.id === docId) setPreviewDoc(null);
  };

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const experiences = Array.isArray(form.workExperiences) && form.workExperiences.length > 0
    ? form.workExperiences
    : (form.workExperience?.previousCompany || form.workExperience?.position)
      ? [form.workExperience]
      : [{ previousCompany: '', position: '', fieldOfWork: '', duration: '' }];

  const updateExperience = (index, field, value) => {
    const updated = [...experiences];
    updated[index] = { ...updated[index], [field]: value };
    setForm((prev) => ({
      ...prev,
      workExperiences: updated,
      workExperience: updated[0] || {},
    }));
  };

  const addExperience = () => {
    const newExp = { previousCompany: '', position: '', fieldOfWork: '', duration: '' };
    const updated = [newExp, ...experiences];
    setForm((prev) => ({
      ...prev,
      workExperiences: updated,
      workExperience: updated[0] || {},
    }));
  };

  const removeExperience = (index) => {
    if (experiences.length <= 1) {
      const updated = [{ previousCompany: '', position: '', fieldOfWork: '', duration: '' }];
      setForm((prev) => ({
        ...prev,
        workExperiences: updated,
        workExperience: updated[0] || {},
      }));
      return;
    }
    const updated = experiences.filter((_, i) => i !== index);
    setForm((prev) => ({
      ...prev,
      workExperiences: updated,
      workExperience: updated[0] || {},
    }));
  };

  // Section disabled validation states (quick creation only requires Operating Company and First Name)
  const isBasicInfoDisabled = !form.divisionId || !form.firstName?.trim();
  const isAddressDisabled = !form.homeCountryAddress?.trim() && !form.addressInUae?.trim();
  const isEduDisabled = !form.education?.educationLevel && !form.education?.degreeMajor?.trim() && !form.education?.universityName?.trim();
  const isWorkExpDisabled = !experiences.some((e) => e.previousCompany?.trim() || e.position?.trim() || e.duration?.trim());
  const isJobProfileDisabled = !form.divisionId && !form.departmentId && !form.jobTitle;
  const isPassportDisabled = !form.passportNumber?.trim() && !form.emiratesIdNumber?.trim();
  const isDocsDisabled = customDocs.length === 0;

  const setWorkExp = (key, val) => {
    updateExperience(0, key, val);
  };

  const setEdu = (key, val) =>
    setForm((prev) => ({
      ...prev,
      education: { ...(prev.education || {}), [key]: val },
    }));

  const setFinance = (key, val) =>
    setForm((prev) => ({
      ...prev,
      finance: { ...(prev.finance || {}), [key]: val },
    }));

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
    border: '1px solid var(--line, #cbd5e1)',
    fontSize: '13px',
    color: 'var(--ink, #0f172a)',
    background: 'var(--input-bg, #ffffff)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ width: '100%' }}>
      <form onSubmit={onSubmit} noValidate style={{ width: '100%' }}>
        {/* Top Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--line, #e5e7eb)',
          }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink, #0f172a)' }}>
              {isEdit ? 'Edit Employee Details' : 'Create New Employee'}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--muted, #64748b)', marginTop: 2 }}>
              Employee / {isEdit ? 'Edit Employee' : 'Registration'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onCancel ? (
              <button
                type="button"
                className="btn secondary"
                onClick={onCancel}
                style={{
                  fontSize: '12.5px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                }}
              >
                Close
              </button>
            ) : null}
          </div>
        </div>

        {/* Horizontal Tabs Navigation Bar */}
        <div
          style={{
            display: 'flex',
            gap: '24px',
            borderBottom: '1px solid var(--line, #e5e7eb)',
            marginBottom: '20px',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'Personal info', label: 'Personal info' },
            { id: 'Employee details', label: 'Employee details' },
            { id: 'Documents', label: 'Documents' },
            { id: 'Payroll', label: 'Payroll' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`emp-tab-btn ${isActive ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Subheader section name */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink, #0f172a)' }}>
            {activeTab}
          </h3>
        </div>

        {/* =========================================================================
            TAB 1: Personal info (Basic info, Address, Work experience, Education)
           ========================================================================= */}
        {activeTab === 'Personal info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Card 1: Basic Information */}
            <SectionCard
              title="Basic information"
              disabled={isBasicInfoDisabled}
              onSectionSave={() => triggerSectionSuccess('Basic information')}
              isSaved={savedSectionName === 'Basic information'}
            >
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: '#334155',
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'center',
                      }}
                    >
                      {photoUrl ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {photoUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (form.photoPreview) {
                            try {
                              URL.revokeObjectURL(form.photoPreview);
                            } catch {}
                          }
                          if (fileInputRef.current) fileInputRef.current.value = '';
                          setForm((prev) => ({
                            ...prev,
                            photoFile: null,
                            photoPreview: '',
                            photoPath: '',
                            photoRemoved: true,
                          }));
                        }}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #fca5a5',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#ef4444',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'center',
                        }}
                      >
                        Remove Photo
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Right: Key-Value Rows for Basic Info */}
                <div style={{ flex: 1 }}>
                  <FieldRow label="Select Operating Company" required>
                    <select
                      required
                      value={form.divisionId || form.companyIds?.[0] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        set('divisionId', val);
                        set('companyIds', val ? [val] : []);
                      }}
                      style={inputStyle}
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
                  </FieldRow>

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

                  <FieldRow label="Nationality">
                    <select
                      style={inputStyle}
                      value={form.nationality || form.personal?.nationality || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        set('nationality', val);
                        setForm((prev) => ({
                          ...prev,
                          personal: { ...(prev.personal || {}), nationality: val },
                        }));
                      }}
                    >
                      <option value="">— Select Nationality —</option>
                      {NATIONALITIES.map((nat) => (
                        <option key={nat} value={nat}>
                          {nat}
                        </option>
                      ))}
                    </select>
                  </FieldRow>

                  <FieldRow label="Mobile Phone" helper="Official mobile contact">
                    <input
                      style={inputStyle}
                      placeholder="e.g. +971 50 1234567"
                      value={form.mobilePhone || ''}
                      onChange={(e) => set('mobilePhone', e.target.value)}
                    />
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

                  {!isEdit ? (
                    <FieldRow label="Initial App Password" helper="Default: demo123 (min 6 characters)">
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          style={{ ...inputStyle, paddingRight: '42px' }}
                          placeholder="demo123"
                          value={form.password !== undefined && form.password !== null ? form.password : (form.appPassword || 'demo123')}
                          onChange={(e) => {
                            set('password', e.target.value);
                            set('appPassword', e.target.value);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          title={showPassword ? 'Hide password' : 'Show password'}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px',
                          }}
                        >
                          {showPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </FieldRow>
                  ) : null}
                </div>
              </div>
            </SectionCard>

            {/* 2-Column Grid: Address & Education details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              {/* Card 2: Address */}
              <SectionCard
                title="Address"
                disabled={isAddressDisabled}
                onSectionSave={() => triggerSectionSuccess('Address details')}
                isSaved={savedSectionName === 'Address details'}
              >
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
              </SectionCard>

              {/* Card 3: Education (Swapped above Work Experience) */}
              <SectionCard
                title="Education details"
                disabled={isEduDisabled}
                onSectionSave={() => triggerSectionSuccess('Education details')}
                isSaved={savedSectionName === 'Education details'}
              >
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

                <FieldRow label="Degree / Major Title">
                  <input
                    style={inputStyle}
                    placeholder="e.g. BS Computer Science"
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

                <FieldRow label="Educational Certificate" helper="Degree / diploma certificate document">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      ref={eduCertRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      style={inputStyle}
                      onChange={(e) => set('educationalCertificateName', e.target.files?.[0]?.name || '')}
                    />
                    {form.educationalCertificateName ? (
                      <span style={{ fontSize: '11.5px', color: '#008fa8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        ✓ {form.educationalCertificateName}
                      </span>
                    ) : null}
                  </div>
                </FieldRow>
              </SectionCard>
            </div>

            {/* Card 4: Work Experience (Multiple Experiences Support, Latest on Top) */}
            <SectionCard
              title="Work experience"
              disabled={isWorkExpDisabled}
              onSectionSave={() => triggerSectionSuccess('Work experience')}
              isSaved={savedSectionName === 'Work experience'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '12.5px', color: 'var(--muted, #64748b)', fontWeight: 500 }}>
                  Add multiple previous companies (Latest experience is always on top)
                </span>
                <button
                  type="button"
                  onClick={addExperience}
                  className="btn secondary"
                  style={{
                    padding: '5px 12px',
                    fontSize: '11.5px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: 'var(--ink, #0f172a)',
                    fontWeight: 600,
                    borderColor: 'var(--line-strong, #cbd5e1)',
                    background: 'var(--surface, #ffffff)',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Another Experience
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {experiences.map((exp, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--surface, #ffffff)',
                      border: '1px solid var(--line, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px dashed var(--line, #cbd5e1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: 'var(--line, #e2e8f0)',
                            color: '#64748b',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                          {idx === 0 ? 'Latest Work Experience' : `Previous Experience #${idx + 1}`}
                        </span>
                      </div>

                      {experiences.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeExperience(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <FieldRow label="Previous company">
                      <input
                        style={inputStyle}
                        placeholder="e.g. Emirates Tech Solutions LLC"
                        value={exp.previousCompany || ''}
                        onChange={(e) => updateExperience(idx, 'previousCompany', e.target.value)}
                      />
                    </FieldRow>

                    <FieldRow label="Position / Role">
                      <input
                        style={inputStyle}
                        placeholder="e.g. Software Engineer"
                        value={exp.position || ''}
                        onChange={(e) => updateExperience(idx, 'position', e.target.value)}
                      />
                    </FieldRow>

                    <FieldRow label="Field of work">
                      <input
                        style={inputStyle}
                        placeholder="e.g. Information Technology"
                        value={exp.fieldOfWork || ''}
                        onChange={(e) => updateExperience(idx, 'fieldOfWork', e.target.value)}
                      />
                    </FieldRow>

                    <FieldRow label="Duration in years" helper="Total duration in years">
                      <input
                        style={inputStyle}
                        placeholder="e.g. 1 year, 2 years, 3.5 years"
                        value={exp.duration || ''}
                        onChange={(e) => updateExperience(idx, 'duration', e.target.value)}
                      />
                    </FieldRow>

                    <FieldRow label="Experience Letter" helper="Service / experience certificate">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          style={inputStyle}
                          onChange={(e) => {
                            const name = e.target.files?.[0]?.name || '';
                            updateExperience(idx, 'experienceLetterName', name);
                            if (idx === 0) set('experienceLetterName', name);
                          }}
                        />
                        {(exp.experienceLetterName || (idx === 0 && form.experienceLetterName)) ? (
                          <span style={{ fontSize: '11.5px', color: '#008fa8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            ✓ {exp.experienceLetterName || form.experienceLetterName}
                          </span>
                        ) : null}
                      </div>
                    </FieldRow>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

          {/* =========================================================================
              TAB 2: Employee details (Organization & App Credentials)
             ========================================================================= */}
          {activeTab === 'Employee details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SectionCard
                title="Job & Organization Profile"
                disabled={isJobProfileDisabled}
                onSectionSave={() => triggerSectionSuccess('Job & Organization profile')}
                isSaved={savedSectionName === 'Job & Organization profile'}
              >
                <FieldRow label="Operating Company">
                  <select
                    style={inputStyle}
                    value={form.divisionId || form.companyIds?.[0] || ''}
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
            </div>
          )}

          {/* =========================================================================
              TAB 3: Documents (Passport, Emirates ID, Files)
             ========================================================================= */}
          {activeTab === 'Documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SectionCard
                title="Passport & Emirates ID Credentials"
                disabled={isPassportDisabled}
                onSectionSave={() => triggerSectionSuccess('Passport & Emirates ID credentials')}
                isSaved={savedSectionName === 'Passport & Emirates ID credentials'}
              >
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

              {/* Card 2: Custom Documents & Attachments (Multiple Uploads, Preview & Delete) */}
              <SectionCard
                title="Custom Documents & Attachments"
                disabled={isDocsDisabled}
                onSectionSave={() => triggerSectionSuccess('Custom Documents')}
                isSaved={savedSectionName === 'Custom Documents'}
              >
                {/* Upload Controls Bar */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--line, #e2e8f0)',
                    borderRadius: '10px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)', marginBottom: 10 }}>
                    Upload New Document / Images
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'center' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--muted, #64748b)', marginBottom: 4 }}>
                        Document Type <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        value={selectedDocType}
                        onChange={(e) => setSelectedDocType(e.target.value)}
                        style={inputStyle}
                      >
                        {DOCUMENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--muted, #64748b)', marginBottom: 4 }}>
                        Label / Title (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Front & Back / Stamped Page"
                        value={docTitle}
                        onChange={(e) => setDocTitle(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingTop: 18 }}>
                      <input
                        ref={docFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        style={{ display: 'none' }}
                        onChange={handleDocFilesSelect}
                      />
                      <button
                        type="button"
                        onClick={() => docFileInputRef.current?.click()}
                        className="btn"
                        style={{
                          background: '#00b8db',
                          color: '#ffffff',
                          fontWeight: 600,
                          fontSize: '12.5px',
                          padding: '9px 16px',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 2px 6px rgba(0, 184, 219, 0.25)',
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Upload Document Files
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted, #94a3b8)', marginTop: 8 }}>
                    Supported formats: PNG, JPG, JPEG, WEBP, PDF, DOCX (Select multiple files at once).
                  </div>
                </div>

                {/* Uploaded Documents List */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h5 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                      Uploaded Documents ({customDocs.length})
                    </h5>
                  </div>

                  {customDocs.length === 0 ? (
                    <div
                      style={{
                        padding: '24px',
                        textAlign: 'center',
                        background: '#ffffff',
                        borderRadius: '8px',
                        border: '1px dashed var(--line, #cbd5e1)',
                        color: 'var(--muted, #64748b)',
                        fontSize: '13px',
                      }}
                    >
                      No custom documents uploaded yet. Select a document type above and click <strong>Upload Document Files</strong>.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {customDocs.map((doc) => {
                        let badgeColor = '#008fa8';
                        let badgeBg = 'rgba(0, 184, 219, 0.12)';
                        if (doc.type === 'Visa') {
                          badgeColor = '#6366f1';
                          badgeBg = 'rgba(99, 102, 241, 0.12)';
                        } else if (doc.type === 'Emirates ID') {
                          badgeColor = '#d97706';
                          badgeBg = 'rgba(245, 158, 11, 0.12)';
                        } else if (doc.type === 'CNIC / National ID') {
                          badgeColor = '#059669';
                          badgeBg = 'rgba(16, 185, 129, 0.12)';
                        } else if (doc.type === 'Offer Letter / Employment Contract') {
                          badgeColor = '#0d9488';
                          badgeBg = 'rgba(13, 148, 136, 0.12)';
                        }

                        return (
                          <div
                            key={doc.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 12,
                              padding: '12px 16px',
                              background: 'var(--surface, #ffffff)',
                              border: '1px solid var(--line, #e2e8f0)',
                              borderRadius: '8px',
                              transition: 'box-shadow 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 }}>
                              {/* Document Icon / Thumbnail */}
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: '6px',
                                  background: badgeBg,
                                  color: badgeColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                  <polyline points="10 9 9 9 8 9" />
                                </svg>
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      background: badgeBg,
                                      color: badgeColor,
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {doc.type}
                                  </span>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
                                    {doc.title || doc.type}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--muted, #64748b)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {doc.fileName} {doc.fileSize ? `• ${doc.fileSize}` : ''} {doc.uploadDate ? `• Uploaded: ${doc.uploadDate}` : ''}
                                </div>
                              </div>
                            </div>

                            {/* Actions: Preview & Delete */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {doc.fileUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(doc)}
                                  className="btn secondary"
                                  style={{
                                    padding: '5px 12px',
                                    fontSize: '11.5px',
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    color: '#008fa8',
                                    fontWeight: 600,
                                  }}
                                  title="Preview Document"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  Preview
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => removeCustomDoc(doc.id)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  color: '#ef4444',
                                  padding: '5px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                                title="Delete Document"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
          )}

          {/* =========================================================================
              TAB 4: Payroll (Compensation & WPS Details)
             ========================================================================= */}
          {activeTab === 'Payroll' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SectionCard
                title="Compensation & WPS Details"
                onSectionSave={() => triggerSectionSuccess('Compensation & WPS details')}
                isSaved={savedSectionName === 'Compensation & WPS details'}
              >
                <FieldRow label="Basic Salary (AED)">
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 5000"
                    value={form.finance?.basicSalary || ''}
                    onChange={(e) => {
                      const basic = e.target.value;
                      setFinance('basicSalary', basic);
                      setFinance('grossSalary', String((Number(basic) || 0) + (Number(form.finance?.allowances) || 0)));
                    }}
                  />
                </FieldRow>

                <FieldRow label="Housing & Transport Allowance (AED)">
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 2500"
                    value={form.finance?.allowances || ''}
                    onChange={(e) => {
                      const allow = e.target.value;
                      setFinance('allowances', allow);
                      setFinance('grossSalary', String((Number(form.finance?.basicSalary) || 0) + (Number(allow) || 0)));
                    }}
                  />
                </FieldRow>

                <FieldRow label="Gross Monthly Remuneration (AED)">
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 7500"
                    value={form.finance?.grossSalary || ''}
                    onChange={(e) => setFinance('grossSalary', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Payment Method">
                  <select
                    style={inputStyle}
                    value={form.finance?.paymentMethod || 'WPS (SIF File Generation)'}
                    onChange={(e) => setFinance('paymentMethod', e.target.value)}
                  >
                    <option value="WPS (SIF File Generation)">WPS (SIF File Generation)</option>
                    <option value="Direct Bank Transfer">Direct Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </FieldRow>

                <FieldRow label="Operating Bank">
                  <input
                    style={inputStyle}
                    placeholder="e.g. Emirates NBD / ADCB / FAB"
                    value={form.finance?.bankName || ''}
                    onChange={(e) => setFinance('bankName', e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="IBAN / Account Number">
                  <input
                    style={inputStyle}
                    placeholder="e.g. AE07033123456789012"
                    value={form.finance?.iban || form.finance?.accountNo || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFinance('iban', val);
                      setFinance('accountNo', val);
                    }}
                  />
                </FieldRow>
              </SectionCard>
            </div>
          )}

          {/* Document Preview Modal */}
          {previewDoc ? (
            <>
              <div
                className="backdrop show"
                onClick={() => setPreviewDoc(null)}
                aria-hidden="true"
                style={{ zIndex: 999 }}
              />
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1000,
                  width: 'min(780px, calc(100vw - 32px))',
                  maxHeight: '85vh',
                  background: 'var(--surface, #ffffff)',
                  borderRadius: 12,
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--line, #cbd5e1)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--line, #e2e8f0)',
                    background: 'var(--surface-alt, #f8fafc)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(0, 184, 219, 0.15)', color: '#008fa8' }}>
                      {previewDoc.type}
                    </span>
                    <strong style={{ fontSize: '14px', color: 'var(--ink, #0f172a)' }}>
                      {previewDoc.title || previewDoc.fileName}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '20px',
                      color: 'var(--muted, #64748b)',
                      cursor: 'pointer',
                      padding: '2px 6px',
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    padding: '20px',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0b1120',
                    minHeight: '300px',
                  }}
                >
                  {previewDoc.isImage || (previewDoc.fileType && previewDoc.fileType.startsWith('image/')) || (previewDoc.fileName && /\.(png|jpe?g|webp|gif)$/i.test(previewDoc.fileName)) ? (
                    <img
                      src={previewDoc.fileUrl}
                      alt={previewDoc.title || previewDoc.fileName}
                      style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 6 }}
                    />
                  ) : (
                    <div style={{ color: '#ffffff', textAlign: 'center', padding: '30px' }}>
                      <div style={{ fontSize: '42px', marginBottom: 12 }}>📄</div>
                      <div style={{ fontSize: '15px', fontWeight: 600 }}>{previewDoc.fileName}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 4 }}>
                        {previewDoc.fileSize || 'Document file'}
                      </div>
                      <a
                        href={previewDoc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 18,
                          background: '#00b8db',
                          color: '#ffffff',
                          padding: '8px 18px',
                          borderRadius: 6,
                          textDecoration: 'none',
                          fontSize: '12.5px',
                          fontWeight: 600,
                        }}
                      >
                        Open Document in New Tab ↗
                      </a>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: '12px 20px',
                    borderTop: '1px solid var(--line, #e2e8f0)',
                    background: 'var(--surface-alt, #f8fafc)',
                  }}
                >
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setPreviewDoc(null)}
                    style={{ padding: '6px 16px', fontSize: '12.5px', borderRadius: 6 }}
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </>
          ) : null}

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
              borderTop: '1px solid var(--line, #e5e7eb)',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              {activeTab !== 'Personal info' ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (activeTab === 'Payroll') setActiveTab('Documents');
                    else if (activeTab === 'Documents') setActiveTab('Employee details');
                    else if (activeTab === 'Employee details') setActiveTab('Personal info');
                  }}
                  style={{ padding: '8px 16px', fontSize: '12.5px', borderRadius: '8px' }}
                >
                  ← Previous Tab
                </button>
              ) : null}

              {activeTab !== 'Payroll' ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    if (activeTab === 'Personal info') setActiveTab('Employee details');
                    else if (activeTab === 'Employee details') setActiveTab('Documents');
                    else if (activeTab === 'Documents') setActiveTab('Payroll');
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
    </div>
  );
}
