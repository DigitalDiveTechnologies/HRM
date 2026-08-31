# GOCs HR Portal — Administrator User Manual

**Product:** GOCs HR Portal  
**Audience:** HR Administrators  
**Version:** 1.0 (Demo / Handover)  
**Built by:** Digital Dive Technologies  

---

## 1. Introduction

The **GOCs HR Portal** is the web-based administrator console for GOCs Global. HR staff use it to manage employees, divisions, leave final approval, certificates, payroll, and reports.

**Employees do not use the portal** — they use the **GOCs HR mobile app** for self-service (leave apply, attendance, payslips, certificates).

### 1.1 Access

| Item | Value |
|------|-------|
| Portal URL | https://digitaldivetech-001-site4.gtempurl.com |
| Demo login | `admin@digitaldive.demo` |
| Demo password | `demo123` |

### 1.2 Browser tips

- Use Chrome or Edge (latest).
- After updates, press **Ctrl+F5** (hard refresh) if menus look outdated.
- Session lasts up to 7 days; log out from the sidebar when finished on shared PCs.

---

## 2. Portal navigation

Main menu groups:

| Group | Pages |
|-------|-------|
| **Overview** | Dashboard, Manager Self-Service, Reports, Notifications, Approvals |
| **Core HR** | Employees, HR Masters, Divisions, Onboarding, Leave, **Payroll**, **Certificates**, Attendance, … |
| **Self Service** | ESS Portal (admin view), Documents |

This manual focuses on the **GOCs PDF-required** workflows.

---

## 3. Adding a single employee

**Path:** Core HR → **Employees**

### 3.1 Create employee

1. Sign in as HR admin.
2. Open **Employees**.
3. In the **Add employee** form, fill in:
   - Full name, email (used for app login)
   - Designation (from HR Masters dropdown)
   - Employment type
   - **Division** (Alkidma, Alqat, Overseas, Royal Oceans, etc.)
   - Department, phone, join date
   - Manager (optional)
   - **App password** (minimum 6 characters — creates mobile login)
   - Status (usually `active`)
4. Click **Create employee**.

The system assigns an employee code automatically (e.g. `DD-1005`).

### 3.2 Edit employee

1. Click an employee row to open details.
2. Update allowed fields (designation, division, salary, manager, etc.).
3. **Employee code and legal name** should not change after creation (business rule).
4. Save changes.

### 3.3 Reset app password

From the employee detail panel, use **Reset app password** and enter a new password for the mobile app.

---

## 4. Bulk employee import (Excel)

**Path:** Core HR → **Employees** → Bulk upload section

### 4.1 Download template

1. Click **Download Excel template**.
2. Open the file `employee-bulk-template.xlsx`.

### 4.2 Template columns

| Column | Required | Notes |
|--------|----------|-------|
| Full Name | Yes | |
| Email | Yes | Must be unique; becomes app login |
| Designation | Yes | Must exist in HR Masters (or create first) |
| Employment Type | Yes | e.g. Full-time |
| Division Code | Yes | e.g. `ALKIDMA`, `ALQAT`, `OVERSEAS`, `ROYAL_OCEANS` |
| Department | Optional | |
| Phone | Optional | |
| Join Date | Optional | `YYYY-MM-DD` |
| Manager Email | Optional | Must match an existing employee email |
| App Password | Yes for app access | e.g. `demo123` |
| Status | Optional | `active` (default) |

### 4.3 Upload

1. Choose the completed `.xlsx` file.
2. Click **Upload bulk import**.
3. Review the result message (created count / row errors).
4. Refresh the employee list.

**Tip:** Create new designations and employment types under **HR Masters** before bulk import if they are not in the dropdown lists.

---

## 5. Managing multi-divisions

**Path:** Core HR → **Divisions**

GOCs operates four divisions in the demo:

| Code | Name | Payroll method |
|------|------|----------------|
| ALKIDMA | Alkidma | WPS (UAE) |
| ALQAT | Alqat | WPS (UAE) |
| ROYAL_OCEANS | Royal Oceans | WPS (UAE) |
| OVERSEAS | Overseas | Bank transfer |

### 5.1 Add a division

1. Open **Divisions**.
2. Enter **Code** (unique, uppercase recommended), **Name**, and **Payroll type**:
   - **WPS (UAE)** — salaries paid via UAE WPS file.
   - **Bank transfer** — overseas bank CSV export.
3. Click **Add division**.

### 5.2 Deactivate (soft delete)

- Click **Deactivate** on a division — it will not appear for new employee assignments but historical data remains.
- Use **Reactivate** to restore.

### 5.3 Assign employees to divisions

- When creating/editing an employee, select the **Division** dropdown.
- Bulk import uses **Division Code** column.

---

## 6. HR Masters (reference)

**Path:** Core HR → **HR Masters**

- **Designations** — job titles used on employee records and certificates.
- **Employment types** — Full-time, Part-time, Contract, etc.

Add masters before employees reference them. Deactivate unused entries instead of deleting.

---

## 7. Two-tier leave approval

**Flow:** Employee (mobile app) → **Team Lead** (mobile app) → **HR** (portal)

### 7.1 Step 1 — Employee applies (app)

Employee opens **My Leaves**, submits leave type, dates, days, reason.  
Status: **Pending manager approval**.

### 7.2 Step 2 — Team lead approves (app)

Team lead signs in on the **mobile app** (not portal).  
**Path:** Menu → **Team approvals**  
Approve or reject with optional note.  
Status after approve: **Pending HR final approval**.

Demo team lead: `ahmed@digitaldive.demo` / `demo123`

### 7.3 Step 3 — HR final approval (portal)

**Path:** Core HR → **Leave** or Overview → **Approvals**

1. Filter pending items with **Pending HR** / level 2.
2. Open the leave request.
3. Click **Approve** or **Reject**.

Employee receives an in-app notification (and email when SMTP is configured).

### 7.4 Duplicate prevention

The system blocks duplicate pending leave with the same type and dates.

---

## 8. Certificate requests & issuance

**Flow:** Employee requests on app → HR reviews on portal → HR generates certificate

### 8.1 Certificate types

| Type | When used |
|------|-----------|
| **Salary Certificate** | General salary confirmation |
| **Bank Certificate** | Bank account opening — requires bank name |
| **NOC (Travel)** | Travel permission — requires destination |

### 8.2 HR queue

**Path:** Core HR → **Certificates**

1. Review **Pending queue** (employee, type, salary snapshot, purpose).
2. Optional: enter HR note.
3. **Approve & issue** — generates demo HTML certificate (client Word templates replace later).
4. **Reject** — employee notified.
5. **Download** — issued certificates.

Demo: Fatima may have a sample pending request.

---

## 9. Monthly payroll & exports

**Path:** Core HR → **Payroll**

Payroll follows each employee’s **division payroll type**.

### 9.1 Run payroll

1. Set **Period** (`YYYY-MM`, e.g. `2026-08`).
2. Click **Generate payslips**.
3. Review summary: WPS count vs bank transfer count.
4. View **Division summary** table (slips and total net per division).

Payslips include basic salary, overtime (from attendance), allowances, deductions, net pay.

### 9.2 Export WPS CSV (UAE divisions)

1. Same period selected.
2. Click **Download WPS CSV**.
3. File contains WPS employees only (Alkidma, Alqat, Royal Oceans).
4. Import into your bank/WPS processor per UAE SIF requirements.

> **Note:** Demo CSV is a simplified export. Final SIF column mapping may be adjusted when client bank details are provided.

### 9.3 Export Bank Transfer CSV (Overseas)

1. Click **Download Bank CSV**.
2. File contains **Overseas** division employees only.
3. Use for international bank payment runs.

### 9.4 Payment reference

Each payslip has a reference prefix:

- `WPS-…` for WPS employees  
- `BT-…` for bank transfer employees  

---

## 10. Attendance & reports (quick reference)

| Task | Path |
|------|------|
| View/edit attendance | Core HR → Attendance |
| Headcount & analytics | Overview → Reports |
| Expiring documents | Overview → Notifications (auto alerts) |

---

## 11. Email notifications (SMTP)

When client provides Office 365 SMTP credentials, HR enables email in API settings (`Smtp.Enabled = true`).

Automatic emails (when configured):

- Leave applied / approved / rejected  
- Certificate requested / issued  

Until then, notifications appear in the **mobile app Alerts** screen only.

---

## 12. Troubleshooting

| Issue | Action |
|-------|--------|
| Blank page after login | Ctrl+F5; confirm admin role |
| API error / 401 | Log out and log in again |
| Bulk import row failed | Check division code, designation, duplicate email |
| No WPS rows in CSV | Confirm employees are in WPS divisions and payroll was run for that period |
| Certificate download empty | Ensure status is **Issued** |

---

## 13. Support

For technical issues with the platform, contact **Digital Dive Technologies**.  
For HR policy (leave rules, certificate wording), follow **GOCs Global** internal HR policy.

*End of HR Administrator Manual*
