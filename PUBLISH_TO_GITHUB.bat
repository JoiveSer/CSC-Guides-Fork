@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "REPO=https://github.com/JoiveSer/CSC-Guides-Fork.git"
set "SITE=https://joiveser.github.io/CSC-Guides-Fork/"
set "TMP=%TEMP%\csc_guides_publish_%RANDOM%"

echo.
echo ========================================
echo   CSC Guide - publish to GitHub Pages
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed.
  where winget >nul 2>nul
  if errorlevel 1 (
    echo Install Git from https://git-scm.com/download/win and run this file again.
    pause
    exit /b 1
  )
  echo Installing Git...
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
  set "PATH=%PATH%;C:\Program Files\Git\cmd"
  where git >nul 2>nul
  if errorlevel 1 (
    echo Git was installed. Close this window and run the BAT file again.
    pause
    exit /b 1
  )
)

if not exist "index.html" (
  echo ERROR: index.html was not found next to this BAT file.
  pause
  exit /b 1
)
if not exist "assets\app\app.css" (
  echo ERROR: site files are incomplete.
  pause
  exit /b 1
)
if not exist "data\duo-data.js" (
  echo ERROR: DUO data was not found.
  pause
  exit /b 1
)

if exist "%TMP%" rmdir /s /q "%TMP%"
mkdir "%TMP%"
mkdir "%TMP%\assets"
mkdir "%TMP%\data"
copy /y "index.html" "%TMP%\index.html" >nul
copy /y ".nojekyll" "%TMP%\.nojekyll" >nul 2>nul
xcopy /e /i /y "assets" "%TMP%\assets" >nul
xcopy /e /i /y "data" "%TMP%\data" >nul
if exist "README.md" copy /y "README.md" "%TMP%\README.md" >nul

git -C "%TMP%" init -q
git -C "%TMP%" config user.name "JoiveSer"
git -C "%TMP%" config user.email "JoiveSer@users.noreply.github.com"
git -C "%TMP%" add .
git -C "%TMP%" commit -q -m "Minimal responsive CSC Guide update"
git -C "%TMP%" branch -M main
git -C "%TMP%" remote add origin "%REPO%"

echo Uploading the clean site build...
git -C "%TMP%" push -u origin main --force
if errorlevel 1 (
  echo.
  echo Upload failed. Complete GitHub authorization in the browser and try again.
  rmdir /s /q "%TMP%" >nul 2>nul
  pause
  exit /b 1
)

rmdir /s /q "%TMP%" >nul 2>nul
echo.
echo DONE. GitHub Pages usually updates in 1-3 minutes.
echo %SITE%
timeout /t 3 >nul
start "" "%SITE%"
endlocal
