# GOCs HR — Handover Checklist

Use this list when moving from demo to client production.

## Completed in demo (Digital Dive build)

- [x] Multi-division structure (Alkidma, Alqat, Overseas, Royal Oceans)
- [x] HR Masters (designations, employment types)
- [x] Employee CRUD + bulk Excel import
- [x] Mobile ESS app (Android APK)
- [x] Biometric attendance punch (device-dependent)
- [x] Two-tier leave: Employee → Team Lead (app) → HR (portal)
- [x] Certificate requests (Bank, Salary, NOC Travel) + HR issue
- [x] Division-wise payroll (WPS vs bank transfer CSV)
- [x] SMTP email hooks (disabled until client credentials)
- [x] User manuals (this folder)

## Client to provide (Phase 1B)

- [ ] GOCs logo and brand colours (replace placeholder in `frontend/lib/brand.js`, `mobile/lib/brand.dart`)
- [ ] Production SMTP (Office 365) — configure `Smtp` section in API `appsettings.Production.json`
- [ ] Official certificate Word/PDF letterhead templates
- [ ] Real employee Excel for bulk import
- [ ] `@gocsglobal.com` email domain (if different from demo)
- [ ] Training session recording (10.6)

## Explicitly out of scope

- **Loan module** — not required per client
- **SAP integration** — custom stack used instead

## Recommended go-live steps

1. Apply client branding (logo, colours).
2. Import real employees via bulk template.
3. Configure SMTP and send test email.
4. Run one payroll cycle in UAT; download WPS + Bank CSVs.
5. Walk through leave + certificate flows with one employee and one team lead.
6. Distribute APK to employees; HR uses portal only.

## Support contacts

| Role | Contact |
|------|---------|
| System built by | Digital Dive Technologies |
| HR super-user | Client HR department |
