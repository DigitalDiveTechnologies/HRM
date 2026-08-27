# Digital Dive HR — Employee App (Flutter)

Light / dark theme (same Digital Dive colors as portal).

## Features
- Login (JWT → .NET API)
- Attendance punch + history
- Leave apply + list
- Payslips
- Notifications (mark read)
- Employee directory

## Run

1. Backend must be up: `http://localhost:5088`
2. Then:

```bat
cd "C:\Users\Star Laptop\Desktop\DigitalDive-HR\mobile"
flutter pub get
flutter run -d windows
```

Or Chrome: `flutter run -d chrome`

### Android emulator
```bat
flutter run -d emulator-5554 --dart-define=API_BASE=http://10.0.2.2:5088
```

### Demo login (employee)
`fatima@digitaldive.demo` / `demo123`

Theme toggle is in the app bar (sun/moon).
