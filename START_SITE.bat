@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8765/"
  py -m http.server 8765 --bind 127.0.0.1
  exit /b
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8765/"
  python -m http.server 8765 --bind 127.0.0.1
  exit /b
)
echo Python was not found. Opening the static site directly.
start "" "%~dp0index.html"
pause
