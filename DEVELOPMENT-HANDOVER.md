# GOCs HRM System — Developer Handover & Safe Implementation Guide

**Project:** GOCs UAE HRM Enterprise System  
**Codebase Working Directory:** `c:\Users\itsei\Documents\Projects\HRM`  
**Purpose:** Handover document for the dedicated development chat session.  
**Strict Directive:** **ZERO REGRESSION POLICY**. New features must be built incrementally without modifying, breaking, or altering any existing working features.

---

## 1. Non-Negotiable Guardrails (Regression Prevention Rules)

To ensure none of the existing features break:

1. **Additive Database Migrations Only:**
   * Never drop or rename existing tables or columns.
   * Always use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
   * Keep all existing column data types and foreign key references intact.
2. **Backwards-Compatible API Endpoints:**
   * Do not alter the response schema of existing endpoints (especially `/api/employees`, `/api/leave`, `/api/payroll`, `/api/ess`, `/api/mss`, `/api/onboarding`, `/api/exit`).
   * When adding fields, make them optional (`nullable`) or provide defaults.
3. **Preserve Existing Client Applications:**
   * Ensure changes do not break the HR Admin Portal (`frontend/`), Employee Portal (`employee-portal/`), or the Flutter Mobile App (`mobile/`).
   * Keep existing `localStorage` keys and state hydration logic stable.
4. **Independent Service Injection:**
   * Inject new services cleanly in `backend/Program.cs` without replacing or overriding existing core services (`HrQueryService`, `EmailService`, `OpsScaleService`, `RbacService`, `Db`).

---

## 2. Stage 1 Execution Plan (Immediate Development Scope)

### Task 1.1: Automated Welcome Email Dispatch
* **Objective:** Immediately email login credentials, portal URL, and mobile app download instructions to the newly created employee.
* **Files to Modify:**
  * `backend/Services/EmailService.cs`: Add `SendWelcomeEmailAsync(string toEmail, string fullName, string tempPassword, string employeeCode, string? portalUrl, CancellationToken ct)`.
  * `backend/Controllers/EmployeesController.cs`: In `Create` method (line ~175), trigger `_email.SendWelcomeEmailAsync` in a non-blocking background task.
* **Verification:**
  * Creating an employee via Admin Portal or `POST /api/employees` returns success, and logs confirm email dispatched or queued.

### Task 1.2: Persistent Company Announcements & Read Receipts
* **Objective:** Replace client-side mock (`localStorage`) with a real PostgreSQL database table, REST API, admin editor, and compliance read receipts.
* **Files to Create / Modify:**
  * `backend/db/schema-announcements.sql`:
    * `company_announcements` (`id`, `title`, `body_html`, `priority`, `audience_type`, `division_id`, `department_id`, `requires_ack`, `is_pinned`, `author_email`, `published_at`, `expires_at`, `created_at`).
    * `announcement_acks` (`announcement_id`, `employee_id`, `acknowledged_at`, `ip_address`).
  * `backend/Controllers/AnnouncementsController.cs`:
    * `GET /api/announcements` (filtered by employee division/department, includes `has_acknowledged` flag).
    * `POST /api/announcements` (role: `admin`).
    * `POST /api/announcements/{id}/acknowledge` (role: `employee`).
    * `GET /api/announcements/{id}/compliance` (role: `admin` read metrics).
  * `employee-portal/app/page.js`: Replace `localStorage` with `GET /api/announcements` and connect the **"Acknowledge & Confirm"** button.
  * `frontend/app/announcements/page.js`: Create admin interface to publish, target, and view read receipt metrics.
* **Verification:**
  * Admin publishes notice $\rightarrow$ Employee sees notice in Portal $\rightarrow$ Clicking Acknowledge records receipt and clears warning.

### Task 1.3: Corporate Quick Links Directory
* **Objective:** Centralized corporate bookmark repository on employee portal and mobile.
* **Files to Create / Modify:**
  * `backend/db/schema-company-links.sql`: `company_links` (`id`, `title`, `url`, `icon_key`, `category`, `sort_order`, `is_active`).
  * `backend/Controllers/CompanyLinksController.cs`: `GET /api/company-links` and `POST /api/company-links`.
  * `employee-portal/app/page.js`: Quick links 4-column card.

### Task 1.4: Performance Goal & Review File Attachments
* **Objective:** Add supporting document attachment capability to goals and appraisals.
* **Files to Modify:**
  * `backend/db/patch-performance-files.sql`:
    * `ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS file_ref TEXT;`
    * `ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS file_ref TEXT;`
  * `backend/Controllers/PerformanceController.cs`: Accept optional `fileRef` in create and update DTOs.
  * `frontend/app/performance/page.js`: Add file upload input in Goal and Review modal forms.

---

## 3. How to Start the New Development Session

1. In the Antigravity IDE UI, click **`+ New Chat`** (or press `Ctrl+N` / Start New Thread).
2. Copy and paste the following prompt into the new chat:

```text
I am starting a dedicated development session for the GOCs HRM project.
Please read DEVELOPMENT-HANDOVER.md in the project root.
Follow the Non-Negotiable Guardrails (Zero Regression Policy) and start executing Task 1.1 (Automated Welcome Email Dispatch) and Task 1.2 (Persistent Company Announcements & Read Receipts).
Make sure none of the existing features are broken.
```
