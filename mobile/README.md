# Digital Dive HR — Employee App (Flutter)

Light / dark theme aligned with the portal.

## Features

- Login (JWT → .NET API)
- Role-based home (ESS vs manager/admin modules)
- Attendance punch + history
- Leave apply + balances + list
- Payslips, notifications, directory
- Documents, recruitment, exit, compliance, performance, training, MSS, assets, travel & expense (by role)

## Run

1. API must be up: `http://localhost:5088`
2. Then:

```bat
cd mobile
flutter pub get
flutter run -d chrome
```

Windows: `flutter run -d windows`

### Android emulator

```bat
flutter run -d emulator-5554 --dart-define=API_BASE=http://10.0.2.2:5088
```

### Seed login (employee)

`fatima@digitaldive.demo` / `demo123`

Theme toggle is in the app bar (sun/moon).
