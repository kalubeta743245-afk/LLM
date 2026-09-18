@echo off
setlocal

set TASK_NAME=IncunabulaBridge
set SCRIPT_PATH=%~dp0start-bridge.ps1

schtasks /create /tn "%TASK_NAME%" /tr "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f

if %errorlevel% equ 0 (
    echo Task created successfully. Bridge will start hidden on login.
) else (
    echo Failed. Run as administrator.
)

endlocal
