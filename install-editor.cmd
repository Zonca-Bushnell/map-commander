@echo off
setlocal
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

where pnpm >nul 2>nul
if %errorlevel%==0 (
  call pnpm install
  call pnpm rebuild esbuild
) else (
  echo pnpm was not found. Falling back to npm.
  call npm install
)

endlocal
