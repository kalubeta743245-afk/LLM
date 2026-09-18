@echo off
:: Auto-elevate to admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

set TASK_NAME=IncunabulaBridge
set SCRIPT_PATH=%~dp0start-bridge.ps1

schtasks /create /tn "%TASK_NAME%" /tr "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f

if %errorlevel% equ 0 (
    echo Task created. Bridge will auto-start on login (hidden).
) else (
    echo Failed to create task.
)

pause
