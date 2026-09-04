@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 오일펜 드로잉 - 업데이트

echo.
echo   최신 버전을 받아옵니다...
echo.
git pull
if errorlevel 1 (
  echo.
  echo   [오류] 업데이트에 실패했습니다.
  pause
  exit /b 1
)

call npm install
echo.
echo   업데이트가 끝났습니다. start.bat 으로 실행하세요.
pause
