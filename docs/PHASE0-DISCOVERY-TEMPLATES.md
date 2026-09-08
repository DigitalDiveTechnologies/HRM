# Phase 0 — Discovery Templates (Blueprint v1.1)

**Status:** Draft for business / payroll / bank sign-off  
**Product:** GOCs UAE HRM  
**Rule:** Phase 2 (payroll/SIF) must not claim production-ready until these are approved.

---

## 1. Legal entity & jurisdiction inventory

Fill one row per employing company.

| Field | Entity 1 | Entity 2 | Notes |
|-------|----------|----------|-------|
| Legal name | | | |
| Trade licence no. | | | |
| MOHRE establishment no. | | | |
| WPS employer unique ID | | | |
| Emirate | | | |
| Free zone authority (if any) | | | |
| Jurisdiction profile | mainland / free_zone / DIFC / ADGM | | |
| Payroll agent / bank | | | |
| Default pay cycle | Monthly | | |

**Owner sign-off:** _________________ Date: _______

---

## 2. Bank / exchange-house SIF specification

Attach or paste the **selected bank’s official SIF / WPS file format** (field order, lengths, headers, employer/employee records, control totals).

| Item | Value |
|------|--------|
| Selected bank or exchange house | |
| Spec document version / date | |
| File encoding | |
| Employer record fields required | |
| Employee record fields required | |
| IBAN / routing rules | |
| Rejection file format (if any) | |
| Test employer EID for sandbox | |

**Finance / bank sign-off:** _________________ Date: _______

Until signed, portal/API WPS exports must remain labelled **test / preview**.

---

## 3. Golden payroll & compliance scenarios

Expected results must be signed by a UAE payroll specialist before Phase 2 acceptance.

| # | Scenario | Inputs (summary) | Expected net / gratuity / SIF outcome | Signed? |
|---|----------|------------------|----------------------------------------|---------|
| 1 | New joiner mid-month | | | |
| 2 | Full month active | | | |
| 3 | Unpaid leave days | | | |
| 4 | Overtime hours | | | |
| 5 | Salary revision mid-period | | | |
| 6 | Arrears / recovery | | | |
| 7 | Loan deduction | | | |
| 8 | Rejected WPS record then fix | | | |
| 9 | Expat EOSB (≤5 years) | | | |
| 10 | Expat EOSB (>5 years) | | | |
| 11 | Emirati / GPSSA contribution | | | |
| 12 | DIFC DEWS path (if in scope) | | | |
| 13 | Jurisdiction difference (mainland vs FZ) | | | |

**Payroll specialist sign-off:** _________________ Date: _______  
**Product owner acceptance:** _________________ Date: _______

---

## 4. Field mapping (current system → Phase 1 org)

| Current | Target |
|---------|--------|
| `divisions` (payroll BU) | Cost centre / payroll split under legal entity |
| `departments` | Department under entity/branch |
| `designations` | Designation (+ grade / family) |
| `employees.manager_id` | Position `reports_to_position_id` + incumbent |
| `employees` | Primary `position_assignments` |
| Employee master_data IBAN / MOL | Payroll identity (Phase 2) |

**HR data owner sign-off:** _________________ Date: _______

---

## Exit criteria (Phase 0 complete)

- [ ] Entity inventory filled  
- [ ] Bank SIF spec attached and signed  
- [ ] Golden scenarios expected results signed  
- [ ] Field mapping reviewed  

Only then start **Phase 2** engineering for real SIF / EOSB production paths.
