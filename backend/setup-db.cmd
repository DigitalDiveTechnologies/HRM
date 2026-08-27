@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === Digital Dive HR API - set Neon DB ===
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-db.ps1"
exit /b %ERRORLEVEL%
