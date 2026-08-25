@echo off
setlocal
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo.
echo Map Commander LAN mode
echo ----------------------------------------
echo This exposes the editor to your local network.
echo Use only on a trusted LAN, because this editor can save/export local files.
echo.
echo Local:
echo   http://127.0.0.1:5177/
echo.
echo LAN addresses on this machine:
ipconfig | findstr /R /C:"IPv4"
echo.
echo Other machines should open:
echo   http://YOUR_IPV4_ADDRESS:5177/
echo.

where pnpm >nul 2>nul
if %errorlevel%==0 (
  call pnpm exec vite --host 0.0.0.0 --port 5177
) else (
  call npx vite --host 0.0.0.0 --port 5177
)

endlocal
