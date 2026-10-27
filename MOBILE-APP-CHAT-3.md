# MOBILE CHAT 3: Expenses & Claims, Team Leave Calendar & 360 Performance Appraisals

**Target Workspace:** `c:\Users\itsei\Documents\Projects\HRM\mobile`  
**Assigned Development Chat:** Mobile Chat Session #3  
**Scope:** Mobile Expense Claims & Receipts, Interactive Team Absence Calendar, 360 Peer Reviews & OKR Sub-Goals.  
**Strict Policy:** **ZERO REGRESSION & MOBILE-ONLY**. Do NOT touch backend APIs, database schemas, or Web Portals (`frontend/` or `employee-portal/`). All code changes must strictly reside inside `mobile/`.

---

## 1. Non-Negotiable Guardrails for Mobile Chat 3

1. **Target Only `mobile/`:** All new files, widgets, and screen modifications must be inside `mobile/lib/`.
2. **Reuse Existing Backend APIs:** The backend endpoints `/api/expenses`, `/api/leave/calendar`, and `/api/performance/reviews` are already live, tested, and returning production data. Do NOT edit any `.cs` or `.sql` files.
3. **Additive Navigation:** Add new routes cleanly in `mobile/lib/nav/app_nav.dart` and `mobile/lib/screens/app_shell.dart`.
4. **Offline & Error Resilience:** Use `ApiClient` and wrap screen states with `RefreshIndicator`, `ScreenLoader`, and `EmptyHint` following the `mobile/lib/widgets/ui_kit.dart` design system.

---

## 2. Feature Roadmap & Technical Specifications

```
                     MOBILE CHAT 3 EXECUTION SEQUENCE
                     
  [Task 3.1: Expense Claims & Receipt Attachment (`expenses_screen.dart`)]
          │
          ▼
  [Task 3.2: Interactive Team Time-Off Calendar (`team_calendar_view.dart`)]
          │
          ▼
  [Task 3.3: 360-Degree Peer Feedback & OKR Sub-Goals (`performance_screen.dart`)]
          │
          ▼
  [Task 3.4: Navigation Wireup & ESS Quick Actions Integration]
```

---

### Task 3.1: Expense Claims & Reimbursements (`expenses_screen.dart`)
* **Objective:** Enable mobile staff to submit out-of-pocket expenses (Travel, Client Meals, Supplies, Medical), view approval status (Pending, Approved, Reimbursed), and attach invoice receipts.
* **Backend APIs (Already Active):**
  * `GET /api/expenses`: Returns user's claims list with status, category, date, amount, and receipt URL.
  * `POST /api/expenses`: Submits new expense claim:
    ```json
    {
      "claimType": "Travel",
      "amount": 250.00,
      "currency": "AED",
      "expenseDate": "2026-10-27",
      "description": "Taxi fare to client meeting in DIFC",
      "receiptUrl": "data:image/jpeg;base64,..."
    }
    ```
* **Flutter Implementation (`mobile/lib/screens/expenses_screen.dart`):**
  * **Header & Stats:** KPI tiles for `Pending Approval`, `Approved (This Month)`, and `Total Reimbursed`.
  * **Claim List:** Cards showing Claim Type badge, formatted AED amount, date, status chip (Yellow `Pending`, Green `Approved`, Blue `Reimbursed`, Red `Rejected`), and notes.
  * **Submit Claim Sheet/Dialog:**
    * Category dropdown: `Travel`, `Client Meals`, `Office Supplies`, `Medical`, `Training`.
    * Amount input (numeric with currency prefix `AED`).
    * Date picker (defaults to today).
    * Description / Business purpose text input.
    * Receipt attachment button (using `file_picker` which is already in `pubspec.yaml`).
    * Submit button with loading state.

---

### Task 3.2: Interactive Team Time-Off Calendar (`team_calendar_view.dart`)
* **Objective:** Allow employees and managers to see who in their department is scheduled off, preventing leave conflicts and departmental absence overlap.
* **Backend APIs (Already Active):**
  * `GET /api/leave/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD`: Returns approved team leaves joined with employee names, departments, and dates.
* **Flutter Implementation:**
  * In `mobile/lib/screens/leave_screen.dart`, add a segmented tab bar:
    * **Tab 1: My Leaves & Apply** (existing functionality).
    * **Tab 2: Team Calendar** (new visual department schedule).
  * Render calendar days with colored indicator dots for colleagues on leave.
  * Tapping a date opens a bottom sheet listing all staff away with:
    * Colleague avatar & name.
    * Department & Leave Type pill.
    * Duration (`Oct 28 – Nov 02`).
  * **Absence Overlap Warning:** If 2 or more colleagues in the same department are away on the same dates, display an amber badge: `⚠️ Team Coverage Alert: 2 colleagues on leave`.

---

### Task 3.3: 360-Degree Peer Feedback & Hierarchical Goals
* **Objective:** Upgrade `mobile/lib/screens/performance_screen.dart` to support 360 peer review nominations and hierarchical OKRs/sub-goals.
* **Backend APIs (Already Active):**
  * `GET /api/performance/goals`: Returns goals with nested child sub-goals and weightages.
  * `GET /api/performance/reviews`: Returns appraisal cycles.
  * `GET /api/performance/reviews/360-pending`: Returns pending peer evaluations requested for this employee.
  * `POST /api/performance/reviews/{id}/peer-feedback`: Submits peer evaluation ratings and comments.
* **Flutter Implementation:**
  * Add a **"360 Peer Feedback"** section in `PerformanceScreen`:
    * Displays review requests where the user was nominated as a peer evaluator.
    * "Submit Feedback" dialog with 1–5 competency rating chips and constructive comments field.
    * Checkbox: `🔒 Anonymous Peer Review`.
  * Expand goals to render nested **Sub-Goals / Key Results** tree with progress percentage bars.

---

### Task 3.4: Navigation Wireup & ESS Home Integration
* **Files to Update:**
  1. `mobile/lib/nav/app_nav.dart`:
     * Add `expenses` to `navForRole`.
     * Update `L10n` labels for `expenses`.
  2. `mobile/lib/screens/app_shell.dart`:
     * Import `expenses_screen.dart` and map `case 'expenses': return const ExpensesScreen();`.
  3. `mobile/lib/screens/ess_screen.dart`:
     * Add an **"Expense Claims"** tile in the `Quick actions` grid on the mobile home screen.

---

## 3. How to Execute This Chat Session

To execute this work in Antigravity:
1. In the Antigravity chat window (or press `Ctrl+N` / new chat), paste the prompt below.
2. The agent will read this file and implement the features exclusively in `mobile/`.

### Copy-Paste Prompt for the Chat:

```text
I am starting Mobile Chat 3 for the GOCs HRM mobile app.
Please read MOBILE-APP-CHAT-3.md in the project root.
Follow the Non-Negotiable Guardrails (Strict Zero Regression: only modify files in mobile/, do not touch backend or web portals).
Execute Task 3.1 (Expenses & Claims screen with receipt upload), Task 3.2 (Team Absence Calendar & Overlap Warnings in leave_screen.dart), Task 3.3 (360 Peer Reviews & Sub-goals in performance_screen.dart), and Task 3.4 (Navigation & ESS Quick Tile).
Run `flutter analyze` or verify Flutter syntax when done.
```
