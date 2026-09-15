@echo off
REM MCE web bridge launcher - auto restart on exit
cd /d "%~dp0.."
set "NODE_EXE=node"
if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
:loop
"%NODE_EXE%" "%~dp0server.js"
timeout /t 5 /nobreak >nul
goto loop
