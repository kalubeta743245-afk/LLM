@echo off
setlocal

set CONFIG_DIR=%USERPROFILE%\.config\opencode
set CONFIG_FILE=%CONFIG_DIR%\config.json
set SOURCE=%~dp0opencode-config.json
set BACKUP=%CONFIG_FILE%.bak

if not exist "%SOURCE%" (
    echo ERROR: opencode-config.json not found in %~dp0
    exit /b 1
)

if not exist "%CONFIG_DIR%" (
    echo Creating config directory: %CONFIG_DIR%
    mkdir "%CONFIG_DIR%"
)

if exist "%CONFIG_FILE%" (
    echo Backing up existing config to %BACKUP%
    copy /Y "%CONFIG_FILE%" "%BACKUP%" >nul
)

if exist "%CONFIG_FILE%" (
    echo Merging provider into existing config...
    powershell -Command "$existing = Get-Content '%CONFIG_FILE%' -Raw | ConvertFrom-Json; $new = Get-Content '%SOURCE%' -Raw | ConvertFrom-Json; foreach ($prop in $new.providers.PSObject.Properties) { $existing.providers | Add-Member -NotePropertyName $prop.Name -NotePropertyValue $prop.Value -Force }; $existing | ConvertTo-Json -Depth 10 | Set-Content '%CONFIG_FILE%'"
) else (
    echo Creating new config...
    copy /Y "%SOURCE%" "%CONFIG_FILE%" >nul
)

if %errorlevel% equ 0 (
    echo Done. OpenCode Local Tunnel provider installed.
    echo Config: %CONFIG_FILE%
) else (
    echo ERROR: Failed to install config.
    exit /b 1
)

endlocal
