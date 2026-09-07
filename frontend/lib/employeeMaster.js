import { todayISO, v } from './format.js';

const emptyAddress = () => ({
  street: '',
  streetNo: '',
  block: '',
  buildingFloorRoom: '',
  zip: '',
  city: '',
  county: '',
  state: '',
  country: '',
});

export const MASTER_TABS = [
  'Address',
  'Membership',
  'Administration',
  'Personal',
  'Finance',
  'Remarks',
  'Attachments',
];

export function emptyMasterForm() {
  return {
    firstName: '',
    middleName: '',
    lastName: '',
    empCode: '',
    extEmployeeNo: '',
    activeEmployee: true,
    jobTitle: '',
    position: '',
    departmentId: '',
    divisionId: '',
    branch: '',
    managerId: '',
    userCode: '',
    salesEmployee: '',
    costCenter: '',
    officePhone: '',
    officeExt: '',
    mobilePhone: '',
    pager: '',
    homePhone: '',
    fax: '',
    email: '',
    linkedVendor: '',
    password: 'demo123',
    designationId: '',
    employmentTypeId: '',
    joinDate: todayISO(),
    status: 'active',
    workAddress: emptyAddress(),
    homeAddress: emptyAddress(),
    membership: {
      union: '',
      membershipNo: '',
      startDate: '',
      endDate: '',
    },
    administration: {
      userGroup: '',
      licenseType: '',
      portalAccess: '',
      notes: '',
    },
    personal: {
      dateOfBirth: '',
      gender: '',
      nationality: '',
      maritalStatus: '',
      bloodGroup: '',
      religion: '',
      emergencyContact: '',
      emergencyPhone: '',
    },
    // New simplified fields
    gender: '',
    dateOfBirth: '',
    maritalStatus: '',
    nationality: '',
    currentAddress: '',
    addressInUae: '',
    homeCountryAddress: '',
    passportNumber: '',
    passportStartDate: '',
    passportExpiryDate: '',
    emiratesIdNumber: '',
    emiratesIdStartDate: '',
    emiratesIdExpiryDate: '',
    previousVisaType: 'N/A',
    experienceLetterName: '',
    educationalCertificateName: '',
    customDocuments: [],
    workExperiences: [
      {
        previousCompany: '',
        fieldOfWork: '',
        position: '',
        duration: '',
      },
    ],
    workExperience: {
      previousCompany: '',
      fieldOfWork: '',
      position: '',
      duration: '',
    },
    education: {
      educationLevel: '',
      degreeMajor: '',
      universityName: '',
      countryOfStudy: '',
      graduationYear: '',
      attestationStatus: 'Not Attested',
      gradeGpa: '',
    },
    educations: [],
    companyIds: [],
    finance: {
      basicSalary: '',
      allowances: '',
      grossSalary: '',
      bankName: '',
      accountNo: '',
      iban: '',
      paymentMethod: 'WPS (SIF File Generation)',
      taxId: '',
    },
    remarks: '',
    attachmentsNote: '',
    naturalPerson: true,
    dataProtectionStatus: 'none',
    photoPath: '',
    photoPreview: '',
    photoFile: null,
  };
}

function pickMaster(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

function splitFullName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: '', middleName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

const cleanVal = (val) => {
  if (val === '—' || val === '-' || val === 'null' || val === 'undefined') return '';
  return typeof val === 'string' ? val : (val ?? '');
};

export function masterFormFromEmployee(employee) {
  const base = emptyMasterForm();
  if (!employee) return base;

  const md = pickMaster(v(employee, 'masterData', 'master_data'));
  const names = splitFullName(v(employee, 'fullName', 'full_name'));
  const status = v(employee, 'status') || 'active';

  return {
    ...base,
    ...md,
    firstName: cleanVal(md.firstName ?? names.firstName),
    middleName: cleanVal(md.middleName ?? names.middleName),
    lastName: cleanVal(md.lastName ?? names.lastName),
    empCode: v(employee, 'empCode', 'emp_code') || '',
    email: cleanVal(v(employee, 'email') || md.email || ''),
    mobilePhone: cleanVal(md.mobilePhone || v(employee, 'phone') || ''),
    jobTitle: (() => {
      const jt = md.jobTitle || v(employee, 'jobTitle', 'job_title') || '';
      return jt === '—' || jt === '-' ? '' : cleanVal(jt);
    })(),
    departmentId: String(v(employee, 'departmentId', 'department_id') || ''),
    divisionId: String(v(employee, 'divisionId', 'division_id') || ''),
    branch: cleanVal(md.branch || v(employee, 'divisionName', 'division_name') || ''),
    designationId: String(v(employee, 'designationId', 'designation_id') || ''),
    employmentTypeId: String(v(employee, 'employmentTypeId', 'employment_type_id') || ''),
    managerId: String(v(employee, 'managerId', 'manager_id') || ''),
    joinDate: v(employee, 'joinDate', 'join_date')
      ? String(v(employee, 'joinDate', 'join_date')).slice(0, 10)
      : todayISO(),
    status,
    activeEmployee: status !== 'exited',
    workAddress: { ...emptyAddress(), ...(md.workAddress || {}) },
    homeAddress: { ...emptyAddress(), ...(md.homeAddress || {}) },
    membership: { ...base.membership, ...(md.membership || {}) },
    administration: { ...base.administration, ...(md.administration || {}) },
    personal: { ...base.personal, ...(md.personal || {}) },
    gender: cleanVal(md.gender || md.personal?.gender || ''),
    dateOfBirth: cleanVal(md.dateOfBirth || md.personal?.dateOfBirth || ''),
    maritalStatus: cleanVal(md.maritalStatus || md.personal?.maritalStatus || ''),
    nationality: cleanVal(md.nationality || md.personal?.nationality || ''),
    currentAddress: cleanVal(md.currentAddress || ''),
    addressInUae: cleanVal(md.addressInUae || ''),
    homeCountryAddress: cleanVal(md.homeCountryAddress || ''),
    passportNumber: cleanVal(md.passportNumber || v(employee, 'passportNo', 'passport_no') || ''),
    passportStartDate: cleanVal(md.passportStartDate || ''),
    passportExpiryDate: cleanVal(md.passportExpiryDate || (v(employee, 'passportExpiry', 'passport_expiry') ? String(v(employee, 'passportExpiry', 'passport_expiry')).slice(0, 10) : '')),
    emiratesIdNumber: cleanVal(md.emiratesIdNumber || ''),
    emiratesIdStartDate: cleanVal(md.emiratesIdStartDate || ''),
    emiratesIdExpiryDate: cleanVal(md.emiratesIdExpiryDate || ''),
    previousVisaType: md.previousVisaType || 'N/A',
    experienceLetterName: cleanVal(md.experienceLetterName || ''),
    educationalCertificateName: cleanVal(md.educationalCertificateName || ''),
    customDocuments: Array.isArray(md.customDocuments) ? md.customDocuments : [],
    workExperiences: (Array.isArray(md.workExperiences) && md.workExperiences.length)
      ? md.workExperiences
      : (md.workExperience && (md.workExperience.previousCompany || md.workExperience.position))
        ? [md.workExperience]
        : [
            {
              previousCompany: '',
              fieldOfWork: '',
              position: '',
              duration: '',
            },
          ],
    workExperience: md.workExperience || {
      previousCompany: '',
      fieldOfWork: '',
      position: '',
      duration: '',
    },
    education: md.education || {
      educationLevel: '',
      degreeMajor: '',
      universityName: '',
      countryOfStudy: '',
      graduationYear: '',
      attestationStatus: 'Not Attested',
      gradeGpa: '',
    },
    educations: (Array.isArray(md.educations) && md.educations.length)
      ? md.educations
      : (md.education?.degreeMajor || md.education?.educationLevel || md.education?.universityName)
        ? [md.education]
        : [],
    companyIds: md.companyIds || (v(employee, 'divisionId', 'division_id') ? [String(v(employee, 'divisionId', 'division_id'))] : []),
    finance: { ...base.finance, ...(md.finance || {}) },
    remarks: cleanVal(md.remarks || ''),
    attachmentsNote: cleanVal(md.attachmentsNote || ''),
    naturalPerson: md.naturalPerson !== false,
    dataProtectionStatus: md.dataProtectionStatus || 'none',
    password: '',
    photoPath: v(employee, 'photoPath', 'photo_path') || '',
    photoPreview: '',
    photoFile: null,
  };
}

export function buildFullName(form) {
  const parts = [form.firstName, form.middleName, form.lastName].map((p) => String(p || '').trim()).filter(Boolean);
  return parts.join(' ');
}

export function masterPayloadFromForm(form, { includePassword = false } = {}) {
  const currentCode = String(form.empCode || '').trim();
  const builtName = buildFullName(form);
  const fullName = builtName || (currentCode ? `Employee ${currentCode}` : 'Employee');
  const fallbackFirstName = builtName ? (form.firstName?.trim() || '') : (currentCode ? `Employee ${currentCode}` : 'Employee');

  const status = form.activeEmployee ? form.status || 'active' : 'exited';
  const phone = form.mobilePhone?.trim() || form.officePhone?.trim() || null;

  const safeCode = currentCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fallbackEmail = `emp.${safeCode || Date.now()}@gocs.hr`;
  const email = form.email?.trim() || fallbackEmail;

  const cleanExperiences = (form.workExperiences || [])
    .filter((w) => w.previousCompany?.trim() || w.position?.trim() || w.fieldOfWork?.trim() || w.duration?.trim())
    .map((w) => ({
      previousCompany: w.previousCompany?.trim() || '',
      position: w.position?.trim() || '',
      fieldOfWork: w.fieldOfWork?.trim() || '',
      duration: w.duration?.trim() || '',
    }));

  const cleanEducations = (form.educations || [])
    .filter((e) => e.educationLevel?.trim() || e.degreeMajor?.trim() || e.universityName?.trim() || e.graduationYear)
    .map((e) => ({
      id: e.id || `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      educationLevel: e.educationLevel?.trim() || '',
      degreeMajor: e.degreeMajor?.trim() || '',
      universityName: e.universityName?.trim() || '',
      countryOfStudy: e.countryOfStudy?.trim() || '',
      graduationYear: String(e.graduationYear || '').trim(),
      attestationStatus: e.attestationStatus || 'Not Attested',
      gradeGpa: String(e.gradeGpa || '').trim(),
    }));

  const cleanDocuments = (form.customDocuments || []).map((d) => ({
    id: d.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: d.type || 'Other Document',
    title: d.title || '',
    fileName: d.fileName || d.name || '',
    fileUrl: d.fileUrl || '',
    fileType: d.fileType || '',
    uploadDate: d.uploadDate || new Date().toISOString(),
  }));

  const masterData = {
    firstName: fallbackFirstName,
    middleName: form.middleName?.trim() || '',
    lastName: form.lastName?.trim() || '',
    extEmployeeNo: form.extEmployeeNo?.trim() || '',
    activeEmployee: !!form.activeEmployee,
    position: form.position?.trim() || '',
    managerId: form.managerId ? Number(form.managerId) : null,
    branch: form.branch?.trim() || '',
    userCode: form.userCode?.trim() || '',
    salesEmployee: form.salesEmployee?.trim() || '',
    costCenter: form.costCenter?.trim() || '',
    officePhone: form.officePhone?.trim() || '',
    officeExt: form.officeExt?.trim() || '',
    mobilePhone: form.mobilePhone?.trim() || '',
    pager: form.pager?.trim() || '',
    homePhone: form.homePhone?.trim() || '',
    fax: form.fax?.trim() || '',
    linkedVendor: form.linkedVendor?.trim() || '',
    workAddress: form.workAddress,
    homeAddress: form.homeAddress,
    membership: form.membership,
    administration: form.administration,
    personal: {
      ...(form.personal || {}),
      gender: form.gender || form.personal?.gender || '',
      dateOfBirth: form.dateOfBirth || form.personal?.dateOfBirth || '',
      maritalStatus: form.maritalStatus || form.personal?.maritalStatus || '',
      nationality: form.nationality?.trim() || '',
    },
    gender: form.gender || form.personal?.gender || '',
    dateOfBirth: form.dateOfBirth || form.personal?.dateOfBirth || '',
    maritalStatus: form.maritalStatus || form.personal?.maritalStatus || '',
    nationality: form.nationality?.trim() || '',
    currentAddress: form.currentAddress?.trim() || '',
    addressInUae: form.addressInUae?.trim() || '',
    homeCountryAddress: form.homeCountryAddress?.trim() || '',
    passportNumber: form.passportNumber?.trim() || '',
    passportStartDate: form.passportStartDate || '',
    passportExpiryDate: form.passportExpiryDate || '',
    emiratesIdNumber: form.emiratesIdNumber?.trim() || '',
    emiratesIdStartDate: form.emiratesIdStartDate || '',
    emiratesIdExpiryDate: form.emiratesIdExpiryDate || '',
    previousVisaType: form.previousVisaType || 'N/A',
    experienceLetterName: form.experienceLetterName || '',
    educationalCertificateName: form.educationalCertificateName || '',
    customDocuments: cleanDocuments,
    workExperiences: cleanExperiences,
    workExperience: cleanExperiences[0] || form.workExperience || {},
    educations: cleanEducations,
    education: cleanEducations[0] || form.education || {},
    companyIds: form.companyIds?.length ? form.companyIds : (form.divisionId ? [String(form.divisionId)] : []),
    finance: form.finance,
    remarks: form.remarks?.trim() || '',
    attachmentsNote: form.attachmentsNote?.trim() || '',
    naturalPerson: !!form.naturalPerson,
    dataProtectionStatus: form.dataProtectionStatus || 'none',
    photoRemoved: !!form.photoRemoved || (!form.photoPath && !form.photoPreview && !form.photoFile),
    photoPath: form.photoPath || '',
  };

  const payload = {
    firstName: fallbackFirstName,
    middleName: form.middleName?.trim() || '',
    lastName: form.lastName?.trim() || '',
    fullName,
    email,
    jobTitle: form.jobTitle?.trim() || (form.designationId ? '' : '—'),
    phone,
    departmentId: form.departmentId ? Number(form.departmentId) : null,
    divisionId: form.divisionId ? Number(form.divisionId) : (form.companyIds?.[0] ? Number(form.companyIds[0]) : null),
    designationId: form.designationId ? Number(form.designationId) : null,
    employmentTypeId: form.employmentTypeId ? Number(form.employmentTypeId) : null,
    managerId: form.managerId ? Number(form.managerId) : null,
    joinDate: form.joinDate || null,
    passportNo: form.passportNumber?.trim() || null,
    passportExpiry: form.passportExpiryDate || null,
    status,
    photoRemoved: !!form.photoRemoved || (!form.photoPath && !form.photoPreview && !form.photoFile),
    photoPath: form.photoPath || null,
    masterData,
  };

  if (includePassword) {
    payload.password = form.password?.trim() || form.appPassword?.trim() || 'demo123';
  }

  return payload;
}
