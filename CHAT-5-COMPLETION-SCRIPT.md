# CHAT 5: Completion of Partial Audit Features (All Except Feature #15)

**Target Workspace:** `c:\Users\itsei\Documents\Projects\HRM`  
**Scope:** Complete implementation of all partial audit features from the master benchmark report (excluding Feature #15 Training Tracking):
1. **Feature #24:** Dynamic Employment Offer Letter Generator & Branded PDF Dispatch
2. **Feature #39:** Direct File Upload Attachments on Appraisals & Performance Goals
3. **Feature #46:** Performance Review Cycle Segmentation by Employee Type (Contractor, Full-Time, Offshore)
4. **Feature #53:** Research-Validated Psychological & Wellbeing Question Sets
5. **Feature #64:** Direct Binary Social Post Attachment Upload (drag-and-drop / file picker)
6. **Feature #16:** Configurable Multi-Tier Approval Rules & Escalation Routing
7. **Custom Metadata:** Dynamic Custom JSONB Attributes Visual Form Designer

**Strict Policy:** **ZERO REGRESSION**. Existing APIs, database schemas, and client states must remain 100% functional and backwards compatible.

---

## 1. Non-Negotiable Guardrails

1. **Additive Migrations Only:** Use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Never drop or alter existing columns.
2. **Backwards Compatibility:** Response shapes of existing recruitment, performance, survey, community, and approval endpoints must remain preserved.
3. **Clean Decoupling:** Training tracking (#15) is explicitly excluded from this sprint. All other features must compile cleanly with `dotnet build backend` (0 warnings, 0 errors).

---

## 2. Technical Specifications & Implementation Sequence

```
                     CHAT 5 EXECUTION SEQUENCE
                     
  [Task 5.1: Dynamic Offer Letter Generator (Feature #24)]
          │
          ▼
  [Task 5.2: Appraisal & Goal Evidence File Uploads (Feature #39)]
          │
          ▼
  [Task 5.3: Review Segmentation by Employee Type (Feature #46)]
          │
          ▼
  [Task 5.4: Research-Validated Survey Question Packs (Feature #53)]
          │
          ▼
  [Task 5.5: Social Post File/Image Upload Pipeline (Feature #64)]
          │
          ▼
  [Task 5.6: Configurable Multi-Tier Approval Rules (Feature #16)]
          │
          ▼
  [Task 5.7: Visual Custom Attributes Schema Designer]
```

---

### Task 5.1: Dynamic Employment Offer Letter Generator (Feature #24)
* **Objective:** Allow HR to generate official, branded PDF/HTML offer letters directly from candidate records in `RecruitmentController.cs`.
* **Database Schema (`backend/db/patch-offer-letters.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS candidate_offers (
      id SERIAL PRIMARY KEY,
      candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      job_id INT REFERENCES job_postings(id) ON DELETE SET NULL,
      designation VARCHAR(150) NOT NULL,
      offered_basic_salary NUMERIC(12,2) NOT NULL,
      offered_housing_allowance NUMERIC(12,2) DEFAULT 0.00,
      offered_transport_allowance NUMERIC(12,2) DEFAULT 0.00,
      joining_date DATE NOT NULL,
      probation_period_months INT DEFAULT 6,
      contract_type VARCHAR(50) DEFAULT 'limited', -- 'limited', 'unlimited'
      status VARCHAR(30) DEFAULT 'draft', -- 'draft', 'issued', 'accepted', 'declined'
      offer_html TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  ```
* **Backend API (`backend/Controllers/RecruitmentController.cs`):**
  * `POST /api/recruitment/candidates/{id}/offer`: Accepts salary components, joining date, and designation; creates offer record and compiles standardized UAE offer letter HTML.
  * `GET /api/recruitment/candidates/{id}/offer`: Returns stored offer details.
  * `GET /api/recruitment/candidates/{id}/offer/pdf`: Generates printable offer letter with corporate logo, compensation breakdown, and standard UAE Labor Law Article 6 terms.
* **Frontend UI (`frontend/app/recruitment/page.js`):**
  * Add **"Generate Offer Letter"** action on candidate cards in the `offered` / `interviewed` stages.
  * Modal with basic salary, housing, transport allowances, probation period, and joining date inputs.
  * Instant Offer Letter Preview & Print/Export PDF modal.

---

### Task 5.2: Direct Appraisal & Goal Evidence File Uploads (Feature #39)
* **Objective:** Enable employees and managers to attach evidence documents (PDFs, project completions, KPIs) directly to performance goals and appraisal reviews.
* **Database Schema (`backend/db/patch-performance-files.sql`):**
  ```sql
  ALTER TABLE performance_goals ADD COLUMN IF NOT EXISTS file_ref TEXT;
  ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS file_ref TEXT;
  ```
* **Backend API (`backend/Controllers/PerformanceController.cs`):**
  * Update `CreateGoal` and `UpdateGoal` to accept optional `fileRef` (URL or storage reference).
  * Update `CreateReview` and `SubmitReview` to accept optional `fileRef`.
  * Add `POST /api/performance/upload-attachment`: Handles multipart/base64 upload and returns sanitized file reference.
* **Frontend UI (`frontend/app/performance/page.js`):**
  * In the **New Goal** and **Edit Goal** modals, add an attachment upload field with document icon and filename preview.
  * In the **Appraisal Review** modal, add "Attach Supporting Evidence" file picker with clickable view/download links.

---

### Task 5.3: Review Segmentation by Employee Type (Feature #46)
* **Objective:** Allow HR to segment appraisal cycles and performance templates specifically by employment type (e.g. Offshore Crew vs. Onshore Corporate vs. Contractors).
* **Database Schema (`backend/db/patch-review-segmentation.sql`):**
  ```sql
  ALTER TABLE performance_templates ADD COLUMN IF NOT EXISTS target_employee_type VARCHAR(50) DEFAULT 'all';
  ALTER TABLE performance_reviews ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50);
  ```
* **Backend API (`backend/Controllers/PerformanceController.cs`):**
  * Update `CreateTemplate` to accept `targetEmployeeType` (`all`, `full_time`, `contractor`, `offshore`, `probationary`).
  * In `Reviews` listing, add optional filter `?employeeType=offshore`.
* **Frontend UI (`frontend/app/performance/page.js`):**
  * Add an **"Employee Type"** dropdown in the Assessment Template and Review Cycle creators.
  * Display employment type filter chips (`All`, `Full-Time`, `Contractor`, `Offshore`) in the appraisal reviews table.

---

### Task 5.4: Research-Validated Survey Question Packs (Feature #53)
* **Objective:** Provide pre-packaged, research-validated question sets for HR admins when drafting pulse surveys.
* **Backend API (`backend/Controllers/SurveysController.cs`):**
  * `GET /api/surveys/template-questions`: Returns standardized research-backed question sets:
    1. **Gallup Q12 Engagement Index:** (Clarity of expectations, materials/equipment, recognition, development).
    2. **UAE National Wellbeing Framework:** (Work-life balance, mental health, leadership trust, physical safety).
    3. **Burnout & Workload Sentiment:** (Cognitive load, deadline pressure, recovery time).
* **Frontend UI (`frontend/app/surveys/page.js`):**
  * In the **Create Wellbeing Survey** modal, add a button: **"✨ Insert Research-Validated Pack"**.
  * Dropdown allows selecting a pack to instantly populate recommended Likert-scale questions with one click.

---

### Task 5.5: Direct Social Post Binary Image Upload (Feature #64)
* **Objective:** Replace manual image URL typing in community feed composers with direct drag-and-drop / file attachment.
* **Backend API (`backend/Controllers/CommunityController.cs`):**
  * Add `POST /api/community/upload`: Accepts `IFormFile` (or base64 payload), verifies image MIME type (`image/png`, `image/jpeg`, `image/webp`), saves to `uploads/community/`, and returns the local URL.
* **Frontend UI (`frontend/app/community/page.js` & `employee-portal/app/community/page.js`):**
  * Add a photo icon / **"Attach Photo"** file input in the social post composer.
  * Shows a thumbnail preview of the selected image with a remove button before publishing.

---

### Task 5.6: Configurable Multi-Tier Approval Rules & Routing (Feature #16)
* **Objective:** Replace hardcoded approval levels with configurable routing rules per request type and department threshold.
* **Database Schema (`backend/db/schema-approval-rules.sql`):**
  ```sql
  CREATE TABLE IF NOT EXISTS approval_routing_rules (
      id SERIAL PRIMARY KEY,
      request_type VARCHAR(50) NOT NULL, -- 'leave', 'expense', 'travel', 'exit'
      department_id INT REFERENCES departments(id) ON DELETE CASCADE,
      min_threshold NUMERIC(12,2) DEFAULT 0, -- e.g. expenses > AED 2,000
      max_threshold NUMERIC(12,2),
      levels_count INT NOT NULL DEFAULT 1, -- 1-tier, 2-tier (Manager -> Director)
      approver_role VARCHAR(50) NOT NULL DEFAULT 'manager',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  ```
* **Backend API (`backend/Controllers/ApprovalsController.cs`):**
  * `GET /api/approvals/rules`: Returns active approval workflow rules.
  * `POST /api/approvals/rules`: Creates or updates routing thresholds and required approval tiers.
* **Frontend UI (`frontend/app/approvals/page.js`):**
  * Add a **"Routing Rules"** settings modal allowing admins to configure approval tiers (e.g. Expenses over AED 5,000 require Department Head + Finance Director).

---

### Task 5.7: Visual Dynamic Attributes Schema Designer
* **Objective:** Allow HR admins to visually add, edit, and reorder custom JSONB profile fields without modifying code.
* **Backend API (`backend/Controllers/CustomFieldsController.cs`):**
  * `GET /api/custom-fields/schema`: Returns active custom employee fields.
  * `POST /api/custom-fields/schema`: Persists field definitions (`fieldKey`, `label`, `dataType`, `required`, `category`).
* **Frontend UI (`frontend/app/settings/page.js` or `frontend/app/company-links/page.js`):**
  * Visual manager to add fields (e.g., "Offshore Rig Pass Number", "Uniform Size", "Maritime License Expiry") with field types (text, number, date, select).

---

## 3. Step-by-Step Test & Build Verification

1. **Database Schema Patches:** Execute all `patch-*.sql` files against PostgreSQL.
2. **Backend Compilation:** Run `dotnet build backend`. Must compile with **0 Warning(s), 0 Error(s)**.
3. **Frontend Compilation:** Run `node -c` on all updated frontend pages.
4. **End-to-End Functional Test:**
   - Generate candidate offer letter $\rightarrow$ verify PDF render.
   - Upload file to goal & appraisal review $\rightarrow$ verify link appears.
   - Insert validated survey question pack $\rightarrow$ launch pulse survey.
   - Upload image directly in community feed $\rightarrow$ post renders with image.

---

## 4. Copy-Paste Initial Prompt to Start Chat 5

```text
I am starting Chat 5 to complete all partial audit features (except Feature #15).
Please read CHAT-5-COMPLETION-SCRIPT.md in the project root.
Follow the Non-Negotiable Guardrails (Strict Zero Regression: additive database migrations, preserve existing API schemas).
Execute Task 5.1 (Offer Letter Generator), Task 5.2 (Appraisal Evidence Uploads), Task 5.3 (Review Segmentation by Employee Type), Task 5.4 (Research-Validated Question Sets), Task 5.5 (Direct Social Image Upload), Task 5.6 (Configurable Approval Routing Rules), and Task 5.7 (Visual Custom Attributes Schema Designer).
Verify `dotnet build backend` succeeds with 0 errors upon completion.
```
