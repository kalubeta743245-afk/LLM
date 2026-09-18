@echo off
setlocal

set TASK_NAME=IncunabulaBridge

echo Removing scheduled task "%TASK_NAME%"...

schtasks /delete /tn "%TASK_NAME%" /f

if %errorlevel% equ 0 (
    echo Task "%TASK_NAME%" removed successfully.
) else (
    echo Failed to remove task. Error code: %errorlevel%
)

endlocal
