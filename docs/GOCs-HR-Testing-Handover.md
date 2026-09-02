# GOCs HR System — Testing Handover

**Client / project:** GOCs Global HR  
**Prepared for:** Testing & UAT  

---

## Live URLs

| Surface | URL |
|---------|-----|
| **HR Admin Portal (primary)** | https://hrdemo.digitaldive-stage.digital |
| Portal backup (Vercel) | https://gocs-hr-portal.vercel.app |
| Backend API | https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment |
| Help & manuals (in portal) | Portal → **Help & Manuals** |

---

## Demo logins

| Role | Email | Password | Where to use |
|------|--------|----------|--------------|
| **Admin (HR)** | `admin@digitaldive.demo` | `demo123` | **Portal only** |
| **Team Lead** | `ahmed@digitaldive.demo` | `demo123` | **Mobile app** (leave approvals) |
| **Employee** | `fatima@digitaldive.demo` | `demo123` | **Mobile app** (ESS) |

> Admin accounts sign in on the **web portal**. Employees / team leads use the **Android app**.

---

## What the system includes

### Portal (Admin)
- Dashboard, notifications (badges + top toast), approvals  
- Employees (SAP-style master data + profile photo)  
- Divisions, HR masters, documents (passport / Emirates ID / visa)  
- Leave, certificates, attendance, payroll, recruitment, training, assets, travel, reports  
- Bulk employee Excel upload  

### Mobile app (Employee / Team Lead)
- Login, dashboard tiles  
- Leave apply + team approvals (team lead)  
- Attendance, certificates, payslips, documents, directory, notifications  
- Sidebar badges + top toast for new leave / certificate / attendance alerts  

---

## Suggested test flows

1. **Leave**  
   - App (Fatima or Ahmed): apply leave  
   - Portal: **Approvals** + **Leave** badges / toast (~5 sec)  
   - App (Ahmed team lead): approve  
   - Portal (admin): final approve  

2. **Certificate**  
   - App: request certificate  
   - Portal: **Certificates** badge + toast → approve / issue  

3. **Documents**  
   - Portal: upload passport / visa for an employee  

4. **Employees**  
   - Portal: add/edit employee master + profile photo  

5. **Notifications**  
   - Portal: messages show **employee name** (not “Your…”)  
   - Mark all read  

6. **Attendance / Payroll**  
   - Portal attendance list auto-refreshes; payroll exports as configured  

---

## Notes for testers

- Portal: after updates use **Ctrl + Shift + R** (hard refresh).  
- Mobile: install latest **release APK** for toast / keyboard / badge fixes.  
- Sample data is demo — production GOCs branding / SMTP / real employees can be plugged in later.  

---

## Stack (reference)

Next.js portal · Flutter Android app · .NET API · PostgreSQL (Neon)
