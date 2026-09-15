@echo off
REM Remove the MCE web bridge autostart entry (does not stop a running server).
set "VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\mce-web-bridge.vbs"
if exist "%VBS%" (
  del "%VBS%"
  echo Removed autostart: %VBS%
) else (
  echo No autostart entry found.
)
pause
