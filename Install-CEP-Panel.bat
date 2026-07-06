@echo off
setlocal

cd /d "%~dp0"

echo Installing AIO Exporter CEP panel...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-CEP-Panel.ps1"

if errorlevel 1 (
    echo.
    echo Install failed.
    pause
    exit /b 1
)

echo.
echo Install complete. Restart Adobe Illustrator, then open Window ^> Extensions ^> AIO Exporter.
pause
