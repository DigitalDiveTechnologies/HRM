from fpdf import FPDF

OUT = r"C:\Users\Star Laptop\Desktop\DigitalDive-HR\docs\GOCs-HR-Complete-Testing-Guide.pdf"


class PDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(0, 102, 128)
        self.cell(0, 8, "GOCs HR - Complete Testing Guide", align="L", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(0, 160, 180)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")

    def h1(self, t):
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(0, 80, 100)
        self.multi_cell(0, 8, t)
        self.ln(2)

    def h2(self, t):
        self.ln(3)
        if self.get_y() > 250:
            self.add_page()
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(0, 102, 128)
        self.multi_cell(0, 7, t)
        self.ln(1)

    def h3(self, t):
        self.ln(2)
        if self.get_y() > 255:
            self.add_page()
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6, t)
        self.ln(1)

    def body(self, t):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5, t)
        self.ln(1)

    def bullet(self, t):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5, f"- {t}")

    def check(self, t):
        if self.get_y() > 270:
            self.add_page()
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5, f"[ ]  {t}")
        self.ln(0.5)


def main():
    pdf = PDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.h1("GOCs HR - Complete Testing Guide")
    pdf.body("Purpose: End-to-end UAT for every sidebar item on Admin Portal and Employee App.")
    pdf.body("Date: September 2026")

    pdf.h2("1. Access and Logins")
    pdf.h3("URLs")
    pdf.bullet("Admin Portal (primary): https://hrdemo.digitaldive-stage.digital")
    pdf.bullet("Portal backup: https://gocs-hr-portal.vercel.app")
    pdf.bullet("API: https://digitaldivetech-001-site4.gtempurl.com/HRMDevelopment")

    pdf.h3("Demo accounts (password for all: demo123)")
    pdf.bullet("HR Admin (Sara): admin@digitaldive.demo  -> Portal only")
    pdf.bullet("Team Lead (Ahmed): ahmed@digitaldive.demo  -> Mobile app")
    pdf.bullet("Employee (Fatima): fatima@digitaldive.demo  -> Mobile app")

    pdf.h3("Notes")
    pdf.bullet("Admin = web portal. Employees / team leads = Android app.")
    pdf.bullet("Portal: after deploy use Ctrl + Shift + R.")
    pdf.bullet("App: install latest release APK.")

    pdf.h2("2. Critical Cross-Flows (test first)")

    pdf.h3("A. Leave (full chain)")
    for t in [
        "1. Fatima/Ahmed | App > My Leaves | Apply leave",
        "2. Admin | Portal | Leave and/or Approvals show number + top toast (~5s)",
        "3. Ahmed | App > Team approvals | Approve as team lead",
        "4. Admin | Portal > Approvals / Leave | Final approve",
        "5. Employee | App > Notifications | Sees approval update",
        "6. Admin | Portal > Notifications | Message shows employee NAME (not Your...)",
    ]:
        pdf.check(t)

    pdf.h3("B. Certificate")
    for t in [
        "1. Employee | App > Certificates | Request certificate",
        "2. Admin | Portal | Certificates badge + toast",
        "3. Admin | Portal > Certificates | Approve / issue",
        "4. Employee | App | Sees issued / downloadable result",
    ]:
        pdf.check(t)

    pdf.h3("C. Documents and employee master")
    for t in [
        "1. Admin | Portal > Documents | Upload passport / Emirates ID / visa",
        "2. Admin | Portal > Employees | Add employee (master form + photo)",
        "3. Admin | Portal > Employees | Edit existing + save master tabs",
    ]:
        pdf.check(t)

    pdf.add_page()
    pdf.h2("3. Portal - Full Sidebar Checklist")
    pdf.body("Login: admin@digitaldive.demo / demo123")
    pdf.body("URL: https://hrdemo.digitaldive-stage.digital")

    pdf.h3("OVERVIEW")
    for t in [
        "1. Dashboard - Opens; headcount / pending leave / docs / recent attendance show",
        "2. Manager Self-Service - Team roster / leave / attendance / approvals view loads",
        "3. Reports & Analytics - Reports / widgets load without error",
        "4. Notifications - List loads; employee NAME in message; Mark all read; Run alert generator",
        "5. Approvals - Pending show Approve/Reject; badge when pending; list refreshes",
        "6. Help & Manuals - Manuals / help page opens",
    ]:
        pdf.check(t)

    pdf.h3("CORE HR")
    for t in [
        "7. Employees - List + org chart + bulk upload; Employee Master Data add/edit; photo upload; tabs save",
        "8. HR Masters - Designations / employment types add or list",
        "9. Divisions - List divisions; add/edit if available",
        "10. Onboarding - Checklist / onboarding rows load",
        "11. Recruitment & ATS - Jobs / candidates screens load; create if UI allows",
        "12. Employee Exit - Exit requests list / create",
        "13. Compliance - Compliance items load",
        "14. Performance - Reviews / goals load",
        "15. Training - Training list / assign",
        "16. Assets - Assets list / assign",
        "17. Travel & Expense - Travel / expense requests load",
        "18. Attendance - List loads; save attendance; auto-refresh (~5s)",
        "19. Leave - Leave requests list; pending badge when new leave applied",
        "20. Certificates - Pending / issued list; badge when new request",
        "21. Payroll - Run / view payroll; division-aware export if shown",
    ]:
        pdf.check(t)

    pdf.h3("SELF SERVICE (admin view)")
    for t in [
        "22. ESS Portal - ESS overview loads",
        "23. Documents - Upload + table (passport, Emirates ID, visa, contract)",
    ]:
        pdf.check(t)

    pdf.h3("Portal alerts (overall)")
    for t in [
        "New leave -> badge on Leave and/or Approvals + toast",
        "New certificate -> badge on Certificates + toast",
        "Unread / generated alerts -> Notifications badge",
        "Expiring docs -> Documents badge (if due soon)",
        "Toast text names the type (leave / certificate / attendance / approval)",
        "Badge stays until count is 0 (not cleared only by opening tab)",
    ]:
        pdf.check(t)

    pdf.add_page()
    pdf.h2("4. Mobile App - Full Sidebar Checklist")
    pdf.body("Install latest APK.")
    pdf.body("Logins: fatima@digitaldive.demo or ahmed@digitaldive.demo / demo123")

    pdf.h3("Login and chrome")
    for t in [
        "1. Login - Email/password; keyboard does NOT keep flickering open",
        "2. Theme toggle - Light/dark works; fields stay usable",
        "3. Menu badge - Number of sections with alerts",
        "4. Top toast - New leave / certificate / attendance shows popup; tap opens that tab",
    ]:
        pdf.check(t)

    pdf.h3("SELF SERVICE menu")
    for t in [
        "5. ESS / Home - Tiles / shortcuts open correct screens",
        "6. Team approvals (Ahmed only) - Pending leave for team; approve/reject",
        "7. My Leaves - Balance / history; apply leave; status updates",
        "8. Certificates - Request certificate; see status",
        "9. My Attendance - Own attendance rows load",
        "10. My Payslips - Payslips list / open",
        "11. Notifications - List; mark read; badges clear when handled",
        "12. My Documents - Own docs list",
        "13. Directory - Colleague directory (no salary fields)",
        "14. Profile - Own profile info",
    ]:
        pdf.check(t)

    pdf.h3("App <-> Portal connection")
    for t in [
        "Leave applied in app appears on portal Approvals/Leave",
        "Certificate requested in app appears on portal Certificates",
        "Portal HR approve leave -> employee sees update in app",
        "Portal issue certificate -> employee sees in app",
    ]:
        pdf.check(t)

    pdf.h2("5. Suggested Test Order (1-2 hours)")
    steps = [
        "Portal login (admin) - Dashboard + Help",
        "Portal Employees - open one profile + photo",
        "Portal Documents - one upload",
        "App login (Fatima) - ESS + apply leave",
        "Portal - confirm Approvals/Leave badge + toast",
        "App (Ahmed) - Team approvals",
        "Portal - final leave approve + Notifications name check",
        "App (Fatima) - certificate request",
        "Portal - Certificates approve/issue",
        "Portal - Attendance + Payroll smoke",
        "Portal - remaining Core HR tabs open (no crash)",
        "App - remaining menu tabs open (no crash)",
    ]
    for i, t in enumerate(steps, 1):
        pdf.bullet(f"{i}. {t}")

    pdf.h2("6. Sign-off")
    pdf.body("Tester Name: ________________________")
    pdf.body("Date: ________________________")
    pdf.body("Result:  Pass  /  Fail  /  Partial")
    pdf.body("Notes: _______________________________________________")
    pdf.body("_____________________________________________________")

    pdf.h2("7. Quick Reference")
    pdf.bullet("Portal: Next.js")
    pdf.bullet("App: Flutter (Android)")
    pdf.bullet("API: .NET")
    pdf.bullet("DB: PostgreSQL (Neon)")
    pdf.body("Leave flow: Employee (app) -> Team lead (app) -> HR (portal)")
    pdf.body("Support tip: If portal looks old, hard refresh. If app missing toast/keyboard fix, reinstall latest APK.")

    pdf.output(OUT)
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
