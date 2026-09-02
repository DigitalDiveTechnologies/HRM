'use client';

import { useRef, useState } from 'react';
import { getApiBase } from '../lib/auth';
import { v } from '../lib/format';
import { MASTER_TABS } from '../lib/employeeMaster';

function Field({ label, children, className = '' }) {
  return (
    <label className={`field emp-master-field ${className}`}>
      <span className="emp-master-label">{label}</span>
      {children}
    </label>
  );
}

function AddressBlock({ title, value, onChange }) {
  const set = (key, val) => onChange({ ...value, [key]: val });
  return (
    <div className="emp-master-address-block">
      <h4>{title}</h4>
      <div className="emp-master-grid emp-master-grid-2">
        <Field label="Street">
          <input value={value.street} onChange={(e) => set('street', e.target.value)} />
        </Field>
        <Field label="Street No.">
          <input value={value.streetNo} onChange={(e) => set('streetNo', e.target.value)} />
        </Field>
        <Field label="Block">
          <input value={value.block} onChange={(e) => set('block', e.target.value)} />
        </Field>
        <Field label="Building / Floor / Room">
          <input value={value.buildingFloorRoom} onChange={(e) => set('buildingFloorRoom', e.target.value)} />
        </Field>
        <Field label="Zip Code">
          <input value={value.zip} onChange={(e) => set('zip', e.target.value)} />
        </Field>
        <Field label="City">
          <input value={value.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="County">
          <input value={value.county} onChange={(e) => set('county', e.target.value)} />
        </Field>
        <Field label="State">
          <input value={value.state} onChange={(e) => set('state', e.target.value)} />
        </Field>
        <Field label="Country / Region">
          <input value={value.country} onChange={(e) => set('country', e.target.value)} />
        </Field>
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
  const [tab, setTab] = useState('Address');
  const isEdit = mode === 'edit';
  const photoInputRef = useRef(null);

  const set = (key, val) => setForm({ ...form, [key]: val });
  const setNested = (key, val) => setForm({ ...form, [key]: val });

  function photoSrc() {
    if (form.photoPreview) return form.photoPreview;
    if (form.photoPath) {
      const path = String(form.photoPath).replace(/^\//, '');
      return `${getApiBase()}/${path}`;
    }
    return '';
  }

  function onPhotoPick(e) {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      return;
    }
    if (form.photoPreview) {
      try {
        URL.revokeObjectURL(form.photoPreview);
      } catch {
        /* ignore */
      }
    }
    const preview = URL.createObjectURL(file);
    setForm({ ...form, photoFile: file, photoPreview: preview });
  }

  function clearPhoto(e) {
    e.preventDefault();
    e.stopPropagation();
    if (form.photoPreview) {
      try {
        URL.revokeObjectURL(form.photoPreview);
      } catch {
        /* ignore */
      }
    }
    setForm({ ...form, photoFile: null, photoPreview: '', photoPath: isEdit ? form.photoPath : '' });
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  return (
    <form className="emp-master" onSubmit={onSubmit}>
      <div className="emp-master-header">
        <div>
          <h3 className="emp-master-title">Employee Master Data</h3>
          <p className="muted emp-master-sub">
            {isEdit ? 'Update employee profile and extended master fields.' : 'Create HR record + mobile app login.'}
          </p>
        </div>
        {isEdit && form.empCode ? (
          <div className="emp-master-code-pill">
            <span className="muted">Employee Code</span>
            <strong>{form.empCode}</strong>
          </div>
        ) : null}
      </div>

      <section className="emp-master-section emp-master-top">
        <div className="emp-master-fields-with-photo">
          <div className="emp-master-grid emp-master-grid-2 emp-master-main-fields">
            <Field label="First Name">
              <input required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </Field>
            <Field label="Middle Name">
              <input value={form.middleName} onChange={(e) => set('middleName', e.target.value)} />
            </Field>
            <Field label="Last Name">
              <input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </Field>
            <Field label="Job Title">
              <input value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} />
            </Field>
            <Field label="Position">
              <input value={form.position} onChange={(e) => set('position', e.target.value)} />
            </Field>
            <Field label="Department">
              <select value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                <option value="">— Select —</option>
                {departments.map((d) => (
                  <option key={v(d, 'id')} value={v(d, 'id')}>
                    {v(d, 'name')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Branch">
              <input value={form.branch} onChange={(e) => set('branch', e.target.value)} />
            </Field>
            <Field label="Manager">
              <select value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
                <option value="">— None —</option>
                {managers.map((e) => (
                  <option key={v(e, 'id')} value={v(e, 'id')}>
                    {v(e, 'fullName', 'full_name')} ({v(e, 'empCode', 'emp_code')})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="User Code">
              <input value={form.userCode} onChange={(e) => set('userCode', e.target.value)} />
            </Field>
            <Field label="Sales Employee">
              <input value={form.salesEmployee} onChange={(e) => set('salesEmployee', e.target.value)} />
            </Field>
            <Field label="Cost Center">
              <input value={form.costCenter} onChange={(e) => set('costCenter', e.target.value)} />
            </Field>
            <Field label="Employee Code">
              <input value={form.empCode || 'Auto on save'} readOnly tabIndex={-1} />
            </Field>
            <Field label="Ext. Employee No.">
              <input value={form.extEmployeeNo} onChange={(e) => set('extEmployeeNo', e.target.value)} />
            </Field>
            <label className="emp-master-check emp-master-active-check">
              <input
                type="checkbox"
                checked={!!form.activeEmployee}
                onChange={(e) => {
                  const active = e.target.checked;
                  setForm({
                    ...form,
                    activeEmployee: active,
                    status: active ? (form.status === 'exited' ? 'active' : form.status) : 'exited',
                  });
                }}
              />
              <span>Active Employee</span>
            </label>
            <Field label="Office Phone">
              <input value={form.officePhone} onChange={(e) => set('officePhone', e.target.value)} />
            </Field>
            <Field label="Ext.">
              <input value={form.officeExt} onChange={(e) => set('officeExt', e.target.value)} />
            </Field>
            <Field label="Mobile Phone">
              <input value={form.mobilePhone} onChange={(e) => set('mobilePhone', e.target.value)} />
            </Field>
            <Field label="Pager">
              <input value={form.pager} onChange={(e) => set('pager', e.target.value)} />
            </Field>
            <Field label="Home Phone">
              <input value={form.homePhone} onChange={(e) => set('homePhone', e.target.value)} />
            </Field>
            <Field label="Fax">
              <input value={form.fax} onChange={(e) => set('fax', e.target.value)} />
            </Field>
            <Field label="E-Mail">
              <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Linked Vendor">
              <input value={form.linkedVendor} onChange={(e) => set('linkedVendor', e.target.value)} />
            </Field>
            <Field label="Division / Company">
              <select value={form.divisionId} onChange={(e) => set('divisionId', e.target.value)}>
                <option value="">— Select —</option>
                {divisions.map((d) => (
                  <option key={v(d, 'id')} value={v(d, 'id')}>
                    {v(d, 'name')} ({v(d, 'code')})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Designation">
              <select value={form.designationId} onChange={(e) => set('designationId', e.target.value)}>
                <option value="">— Select —</option>
                {designations.map((d) => (
                  <option key={v(d, 'id')} value={v(d, 'id')}>
                    {v(d, 'name')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Employment Type">
              <select value={form.employmentTypeId} onChange={(e) => set('employmentTypeId', e.target.value)}>
                <option value="">— Select —</option>
                {employmentTypes.map((d) => (
                  <option key={v(d, 'id')} value={v(d, 'id')}>
                    {v(d, 'name')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Join Date">
              <input type="date" value={form.joinDate} onChange={(e) => set('joinDate', e.target.value)} />
            </Field>
            {!isEdit ? (
              <Field label="App Password">
                <input
                  required
                  type="password"
                  minLength={6}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value,
                      activeEmployee: e.target.value !== 'exited',
                    })
                  }
                >
                  <option value="active">active</option>
                  <option value="onboarding">onboarding</option>
                  <option value="exited">exited</option>
                </select>
              </Field>
            )}
          </div>
          <div className="emp-master-photo">
            <button
              type="button"
              className="emp-master-photo-box"
              onClick={() => photoInputRef.current?.click()}
              title="Upload profile photo"
            >
              {photoSrc() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoSrc()} alt="Employee profile" className="emp-master-photo-img" />
              ) : (
                <>
                  <span>Photo</span>
                  <small className="muted">Click to upload</small>
                </>
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={onPhotoPick}
            />
            <div className="emp-master-photo-actions">
              <button type="button" className="btn secondary" onClick={() => photoInputRef.current?.click()}>
                {photoSrc() ? 'Change' : 'Upload'}
              </button>
              {form.photoPreview ? (
                <button type="button" className="btn secondary" onClick={clearPhoto}>
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="emp-master-tabs" role="tablist">
        {MASTER_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`emp-master-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="emp-master-tab-panel">
        {tab === 'Address' ? (
          <div className="emp-master-address-row">
            <AddressBlock title="Work Address" value={form.workAddress} onChange={(val) => setNested('workAddress', val)} />
            <AddressBlock title="Home Address" value={form.homeAddress} onChange={(val) => setNested('homeAddress', val)} />
          </div>
        ) : null}

        {tab === 'Membership' ? (
          <div className="emp-master-grid emp-master-grid-2">
            <Field label="Union / Association">
              <input
                value={form.membership.union}
                onChange={(e) => setNested('membership', { ...form.membership, union: e.target.value })}
              />
            </Field>
            <Field label="Membership No.">
              <input
                value={form.membership.membershipNo}
                onChange={(e) => setNested('membership', { ...form.membership, membershipNo: e.target.value })}
              />
            </Field>
            <Field label="Start Date">
              <input
                type="date"
                value={form.membership.startDate}
                onChange={(e) => setNested('membership', { ...form.membership, startDate: e.target.value })}
              />
            </Field>
            <Field label="End Date">
              <input
                type="date"
                value={form.membership.endDate}
                onChange={(e) => setNested('membership', { ...form.membership, endDate: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {tab === 'Administration' ? (
          <div className="emp-master-grid emp-master-grid-2">
            <Field label="User Group">
              <input
                value={form.administration.userGroup}
                onChange={(e) => setNested('administration', { ...form.administration, userGroup: e.target.value })}
              />
            </Field>
            <Field label="License Type">
              <input
                value={form.administration.licenseType}
                onChange={(e) => setNested('administration', { ...form.administration, licenseType: e.target.value })}
              />
            </Field>
            <Field label="Portal Access">
              <input
                value={form.administration.portalAccess}
                onChange={(e) => setNested('administration', { ...form.administration, portalAccess: e.target.value })}
              />
            </Field>
            <Field label="Admin Notes" className="emp-master-span-full">
              <textarea
                rows={3}
                value={form.administration.notes}
                onChange={(e) => setNested('administration', { ...form.administration, notes: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {tab === 'Personal' ? (
          <div className="emp-master-grid emp-master-grid-2">
            <Field label="Date of Birth">
              <input
                type="date"
                value={form.personal.dateOfBirth}
                onChange={(e) => setNested('personal', { ...form.personal, dateOfBirth: e.target.value })}
              />
            </Field>
            <Field label="Gender">
              <select
                value={form.personal.gender}
                onChange={(e) => setNested('personal', { ...form.personal, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Nationality">
              <input
                value={form.personal.nationality}
                onChange={(e) => setNested('personal', { ...form.personal, nationality: e.target.value })}
              />
            </Field>
            <Field label="Marital Status">
              <select
                value={form.personal.maritalStatus}
                onChange={(e) => setNested('personal', { ...form.personal, maritalStatus: e.target.value })}
              >
                <option value="">—</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Blood Group">
              <input
                value={form.personal.bloodGroup}
                onChange={(e) => setNested('personal', { ...form.personal, bloodGroup: e.target.value })}
              />
            </Field>
            <Field label="Religion">
              <input
                value={form.personal.religion}
                onChange={(e) => setNested('personal', { ...form.personal, religion: e.target.value })}
              />
            </Field>
            <Field label="Emergency Contact">
              <input
                value={form.personal.emergencyContact}
                onChange={(e) => setNested('personal', { ...form.personal, emergencyContact: e.target.value })}
              />
            </Field>
            <Field label="Emergency Phone">
              <input
                value={form.personal.emergencyPhone}
                onChange={(e) => setNested('personal', { ...form.personal, emergencyPhone: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {tab === 'Finance' ? (
          <div className="emp-master-grid emp-master-grid-2">
            <Field label="Bank Name">
              <input
                value={form.finance.bankName}
                onChange={(e) => setNested('finance', { ...form.finance, bankName: e.target.value })}
              />
            </Field>
            <Field label="Account No.">
              <input
                value={form.finance.accountNo}
                onChange={(e) => setNested('finance', { ...form.finance, accountNo: e.target.value })}
              />
            </Field>
            <Field label="IBAN">
              <input
                value={form.finance.iban}
                onChange={(e) => setNested('finance', { ...form.finance, iban: e.target.value })}
              />
            </Field>
            <Field label="Payment Method">
              <input
                value={form.finance.paymentMethod}
                onChange={(e) => setNested('finance', { ...form.finance, paymentMethod: e.target.value })}
              />
            </Field>
            <Field label="Tax ID">
              <input
                value={form.finance.taxId}
                onChange={(e) => setNested('finance', { ...form.finance, taxId: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {tab === 'Remarks' ? (
          <Field label="Remarks">
            <textarea rows={6} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} />
          </Field>
        ) : null}

        {tab === 'Attachments' ? (
          <div className="stack">
            <Field label="Attachment Notes">
              <textarea rows={4} value={form.attachmentsNote} onChange={(e) => set('attachmentsNote', e.target.value)} />
            </Field>
            <p className="muted">Use the Documents module to attach passport, visa, and contract files.</p>
          </div>
        ) : null}
      </div>

      <footer className="emp-master-footer">
        <div className="emp-master-footer-title">Personal Data Protection</div>
        <div className="emp-master-footer-row">
          <label className="emp-master-check">
            <input
              type="checkbox"
              checked={!!form.naturalPerson}
              onChange={(e) => set('naturalPerson', e.target.checked)}
            />
            <span>Natural Person</span>
          </label>
          <Field label="Status">
            <select value={form.dataProtectionStatus} onChange={(e) => set('dataProtectionStatus', e.target.value)}>
              <option value="none">None</option>
              <option value="consent_given">Consent given</option>
              <option value="pending">Pending</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </Field>
        </div>
      </footer>

      <div className="emp-master-actions">
        {onCancel ? (
          <button type="button" className="btn secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save employee master' : 'Create employee'}
        </button>
      </div>

      {extraFooter}
    </form>
  );
}
