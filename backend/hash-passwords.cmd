@echo off
cd /d "%~dp0"
echo Hashing any plaintext passwords in Neon (BCrypt)...
dotnet run --no-build -- --hash-passwords
if errorlevel 1 (
  echo Building first...
  dotnet build
  dotnet run --no-build -- --hash-passwords
)
echo.
echo Done. Passwords that were plain text are now BCrypt hashes.
echo Login still uses the seed password: demo123
pause
