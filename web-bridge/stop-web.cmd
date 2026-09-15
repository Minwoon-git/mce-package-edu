@echo off
REM Stop the MCE web bridge completely (the auto-restart loop AND the node server),
REM whether it was started hidden or in a visible window.
powershell -NoProfile -Command "$hit=$false; Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'cmd.exe' -and $_.CommandLine -match 'run-web\.cmd') -or ($_.CommandLine -match 'web-bridge\\server\.js') } | ForEach-Object { $hit=$true; taskkill /pid $_.ProcessId /F | Out-Null }; if ($hit) { Write-Host 'web bridge stopped.' } else { Write-Host 'web bridge is not running.' }"
pause
