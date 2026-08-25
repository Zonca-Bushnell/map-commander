@echo off
setlocal
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

where pnpm >nul 2>nul
if %errorlevel%==0 (
  call pnpm dev
) else (
  call npm run dev
)

endlocal
