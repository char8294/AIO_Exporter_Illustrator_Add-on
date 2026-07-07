@echo off
setlocal

cd /d "%~dp0"

echo Uninstalling AIO Exporter CEP panel...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-CEP-Panel.ps1"

if errorlevel 1 (
    echo.
    echo Uninstall failed.
    pause
    exit /b 1
)

echo.
echo Uninstall complete. Restart Adobe Illustrator if it is currently open.
pause
