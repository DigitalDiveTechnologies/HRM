import { todayISO, v } from './format';

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
    password: '',
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
    finance: {
      bankName: '',
      accountNo: '',
      iban: '',
      paymentMethod: '',
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

export function masterFormFromEmployee(employee) {
  const base = emptyMasterForm();
  if (!employee) return base;

  const md = pickMaster(v(employee, 'masterData', 'master_data'));
  const names = splitFullName(v(employee, 'fullName', 'full_name'));
  const status = v(employee, 'status') || 'active';

  return {
    ...base,
    ...md,
    firstName: md.firstName ?? names.firstName,
    middleName: md.middleName ?? names.middleName,
    lastName: md.lastName ?? names.lastName,
    empCode: v(employee, 'empCode', 'emp_code') || '',
    email: v(employee, 'email') || md.email || '',
    mobilePhone: md.mobilePhone || v(employee, 'phone') || '',
    jobTitle: md.jobTitle || v(employee, 'jobTitle', 'job_title') || '',
    departmentId: String(v(employee, 'departmentId', 'department_id') || ''),
    divisionId: String(v(employee, 'divisionId', 'division_id') || ''),
    branch: md.branch || v(employee, 'divisionName', 'division_name') || '',
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
    finance: { ...base.finance, ...(md.finance || {}) },
    remarks: md.remarks || '',
    attachmentsNote: md.attachmentsNote || '',
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
  const fullName = buildFullName(form);
  const status = form.activeEmployee ? form.status || 'active' : 'exited';
  const phone = form.mobilePhone?.trim() || form.officePhone?.trim() || null;

  const masterData = {
    firstName: form.firstName?.trim() || '',
    middleName: form.middleName?.trim() || '',
    lastName: form.lastName?.trim() || '',
    extEmployeeNo: form.extEmployeeNo?.trim() || '',
    activeEmployee: !!form.activeEmployee,
    position: form.position?.trim() || '',
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
    personal: form.personal,
    finance: form.finance,
    remarks: form.remarks?.trim() || '',
    attachmentsNote: form.attachmentsNote?.trim() || '',
    naturalPerson: !!form.naturalPerson,
    dataProtectionStatus: form.dataProtectionStatus || 'none',
  };

  const payload = {
    firstName: form.firstName?.trim() || '',
    middleName: form.middleName?.trim() || '',
    lastName: form.lastName?.trim() || '',
    fullName,
    email: form.email?.trim() || '',
    jobTitle: form.jobTitle?.trim() || '',
    phone,
    departmentId: form.departmentId ? Number(form.departmentId) : null,
    divisionId: form.divisionId ? Number(form.divisionId) : null,
    designationId: form.designationId ? Number(form.designationId) : null,
    employmentTypeId: form.employmentTypeId ? Number(form.employmentTypeId) : null,
    managerId: form.managerId ? Number(form.managerId) : null,
    joinDate: form.joinDate || null,
    status,
    masterData,
  };

  if (includePassword) {
    payload.password = form.password?.trim() || '';
  }

  return payload;
}
