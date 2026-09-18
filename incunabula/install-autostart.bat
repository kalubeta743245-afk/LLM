@echo off
setlocal

set TASK_NAME=IncunabulaBridge
set SCRIPT_PATH=%~dp0start-bridge.ps1

echo Creating scheduled task "%TASK_NAME%"...

schtasks /create /tn "%TASK_NAME%" /tr "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%SCRIPT_PATH%\"" /sc onlogon /rl highest /f

if %errorlevel% equ 0 (
    echo Task "%TASK_NAME%" created successfully.
) else (
    echo Failed to create task. Error code: %errorlevel%
)

endlocal
