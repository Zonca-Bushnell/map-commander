@echo off
setlocal
set "PROJECT_DIR=%~dp0"
if "%MAP_COMMANDER_DATA_DIR%"=="" (
  set "DATA_DIR=%PROJECT_DIR%data"
) else (
  set "DATA_DIR=%MAP_COMMANDER_DATA_DIR%"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$data = [IO.Path]::GetFullPath('%DATA_DIR%');" ^
  "$viewer = Join-Path $data 'viewer';" ^
  "$share = Join-Path $data 'share';" ^
  "$html = Join-Path $viewer 'dispatch_city_viewer.html';" ^
  "if (!(Test-Path $html)) { Write-Host 'Viewer HTML was not found. Export Viewer from the editor first.'; exit 1 }" ^
  "$stamp = Get-Date -Format 'yyyyMMdd_HHmmss';" ^
  "$packageDir = Join-Path $share ('dispatch_city_viewer_' + $stamp);" ^
  "$zipPath = $packageDir + '.zip';" ^
  "New-Item -ItemType Directory -Force -Path $packageDir | Out-Null;" ^
  "$names = @('dispatch_city_viewer.html','dispatch_city_viewer.scene.json','viewer-data.js','viewer.js','viewer.css','dispatch_city_viewer.gltf','dispatch_city_viewer.glb');" ^
  "foreach ($name in $names) { $src = Join-Path $viewer $name; if (Test-Path $src) { Copy-Item $src $packageDir -Force } }" ^
  "$vendor = Join-Path $viewer 'vendor'; if (Test-Path $vendor) { Copy-Item $vendor (Join-Path $packageDir 'vendor') -Recurse -Force }" ^
  "Compress-Archive -Path (Join-Path $packageDir '*') -DestinationPath $zipPath -Force;" ^
  "Write-Host ''; Write-Host 'Viewer package created:'; Write-Host ('  ' + $zipPath); Write-Host ''; Write-Host 'Single-file viewer:'; Write-Host ('  ' + (Join-Path $packageDir 'dispatch_city_viewer.html'));"

endlocal
