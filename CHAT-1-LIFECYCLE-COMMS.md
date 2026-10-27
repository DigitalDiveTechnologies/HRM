# CHAT 1: Employee Lifecycle, Communications & Digital Governance

**Target Workspace:** `c:\Users\itsei\Documents\Projects\HRM`  
**Assigned Development Chat:** Chat Session #1  
**Scope:** Communications, Employee Self-Service (ESS), Onboarding, E-Signatures, and Announcements.  
**Strict Policy:** **ZERO REGRESSION**. Do not alter existing working APIs, tables, or client states.

---

## 1. Non-Negotiable Guardrails for Chat 1

1. **Additive Migrations Only:** Only create new tables or add nullable columns (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Never drop or rename columns.
2. **Backwards Compatibility:** Do not modify the existing response shapes of `/api/employees`, `/api/auth`, or `/api/ess`.
3. **Decoupled Development:** This chat handles **Communications & Lifecycle**. Do NOT touch Leave calculations, Payroll SIF files, or the Reports controller (assigned to Chat 2).

---

## 2. Feature Roadmap & Technical Specifications

```
                     CHAT 1 EXECUTION SEQUENCE
                     
  [Task 1.1: Automated Welcome Email]
          │
          ▼
  [Task 1.2: Persistent Announcements & Compliance Read Receipts]
          │
          ▼
  [Task 1.3: Corporate Quick Links Directory]
          │
          ▼
  [Task 1.4: HTML5 Digital Signature Pad (E-Sign)]
          │
          ▼
  [Task 1.5: Unified New Hire Onboarding Packet Wizard]
```

---

### Task 1.1: Automated Welcome Email Dispatch
* **Objective:** Automatically email login credentials, portal URL, and mobile app download instructions to newly registered employees.
* **Code Changes:**
  1. In `backend/Services/EmailService.cs`, implement:
     ```csharp
     public async Task SendWelcomeEmailAsync(
         string toEmail, string fullName, string tempPassword, 
         string employeeCode, string? portalUrl, CancellationToken ct)
     ```
     Use Office 365 SMTP settings from `SmtpOptions`. Generate a branded HTML welcome email with credentials and next steps.
  2. In `backend/Controllers/EmployeesController.cs:175`, inside `Create`, trigger `SendWelcomeEmailAsync` in a detached background task so the API response remains under 150ms.
* **Test Verification:** Create an employee via Admin Portal or `POST /api/employees`. Confirm API returns 200/201 and SMTP logs show email dispatched.

---

### Task 1.2: Persistent Company Announcements & Read Receipts
* **Objective:** Replace the `localStorage` mock in `employee-portal/app/page.js` with a real database table, REST API, admin publisher, and mandatory compliance read receipts.
* **Database Migration (`backend/db/schema-announcements.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS company_announcements (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      body_html TEXT NOT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'normal', 'urgent', 'mandatory'
      audience_type VARCHAR(20) NOT NULL DEFAULT 'all', -- 'all', 'division', 'department'
      division_id INT REFERENCES divisions(id) ON DELETE SET NULL,
      department_id INT REFERENCES departments(id) ON DELETE SET NULL,
      requires_ack BOOLEAN NOT NULL DEFAULT FALSE,
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      author_email VARCHAR(120) NOT NULL,
      published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS announcement_acks (
      announcement_id INT NOT NULL REFERENCES company_announcements(id) ON DELETE CASCADE,
      employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(50),
      PRIMARY KEY (announcement_id, employee_id)
  );

  CREATE INDEX IF NOT EXISTS idx_announcements_audience ON company_announcements(audience_type, division_id, department_id);
  CREATE INDEX IF NOT EXISTS idx_announcement_acks_emp ON announcement_acks(employee_id);
  ```
* **API Controller (`backend/Controllers/AnnouncementsController.cs`):**
  * `GET /api/announcements`: Returns announcements targeted to the caller's division/department, with a `has_acknowledged` flag for the current employee.
  * `POST /api/announcements`: Admin endpoint to publish announcements.
  * `POST /api/announcements/{id}/acknowledge`: Employee endpoint to log read receipt (stores timestamp and client IP).
  * `GET /api/announcements/{id}/compliance`: Admin endpoint returning read percentages and pending employee names.
* **UI Updates:**
  * In `employee-portal/app/page.js`: Replace `localStorage.getItem('gocs_announcements')` with live fetch from `/api/announcements`. If `requires_ack == true` and `has_acknowledged == false`, display an action banner with an **"Acknowledge & Confirm"** button.
  * In `frontend/app/announcements/page.js`: Create an admin management screen to draft, target, and monitor compliance.

---

### Task 1.3: Corporate Quick Links Directory
* **Objective:** Centralized company bookmarks repository for internal tools and health portals.
* **Database Migration (`backend/db/schema-company-links.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS company_links (
      id SERIAL PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      url VARCHAR(500) NOT NULL,
      icon_key VARCHAR(50) NOT NULL DEFAULT 'external-link',
      category VARCHAR(50) NOT NULL DEFAULT 'General',
      sort_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```
* **Controller:** `backend/Controllers/CompanyLinksController.cs` (`GET`, `POST`, `DELETE`).
* **UI:** Render a 4-column quick links card on `employee-portal/app/page.js` and in the Flutter mobile home screen.

---

### Task 1.4: HTML5 Digital Signature Pad (E-Sign)
* **Objective:** Legally binding, reusable electronic signature capture for onboarding documents and asset handovers.
* **Database Schema:**
  ```sql
  CREATE TABLE IF NOT EXISTS digital_signatures (
      id SERIAL PRIMARY KEY,
      document_type VARCHAR(50) NOT NULL, -- 'nda', 'handbook', 'asset_receipt', 'exit_clearance'
      document_id INT NOT NULL,
      employee_id INT NOT NULL REFERENCES employees(id),
      signer_email VARCHAR(120) NOT NULL,
      signature_base64 TEXT NOT NULL,
      document_sha256 VARCHAR(64) NOT NULL,
      ip_address VARCHAR(50) NOT NULL,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```
* **Component:** Create `frontend/components/SignaturePad.js` (using an HTML5 canvas) with Clear, Undo, and Save functions. Output vector/base64 PNG.
* **API:** Add `POST /api/documents/sign` in `DocumentsController.cs`.

---

### Task 1.5: Unified New Hire Onboarding Packet Wizard
* **Objective:** A sequential first-login wizard on the employee portal:
  1. Welcome & Instructions.
  2. Document Verification (Passport, Visa, Emirates ID uploads).
  3. Company Policy Acknowledgement & E-Sign (using Task 1.4 signature pad).
* **UI:** Build `employee-portal/app/onboarding/wizard/page.js`.

---

## 3. Initial Prompt to Start Chat 1

Copy and paste this exact prompt into your **Chat 1** window:

```text
I am starting Chat 1: Employee Lifecycle, Communications & Digital Governance.
Please read CHAT-1-LIFECYCLE-COMMS.md in the project root.
Follow the Non-Negotiable Guardrails (Zero Regression Policy).
Begin immediately with Task 1.1 (Automated Welcome Email) and Task 1.2 (Company Announcements & Read Receipts).
Ensure all existing endpoints and features remain 100% operational.
```
