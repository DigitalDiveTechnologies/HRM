@echo off
cd /d "%~dp0"
echo.
echo Stopping anything on port 5088 (if running)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :5088 ^| findstr LISTENING') do (
  echo Killing PID %%P
  taskkill /F /PID %%P >nul 2>&1
)
echo.
echo Starting Digital Dive HR API...
echo Swagger will be at: http://localhost:5088/swagger
echo Keep this window open. Press Ctrl+C to stop.
echo.
dotnet run --urls http://localhost:5088
