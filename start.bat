@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 오일펜 드로잉

echo.
echo   오일펜 드로잉을 시작합니다.
echo   이 창을 닫으면 앱도 꺼집니다.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   [오류] Node.js 가 설치되어 있지 않습니다.
  echo   https://nodejs.org 에서 LTS 를 설치한 뒤 이 파일을 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo   처음 실행이라 필요한 파일을 내려받습니다. 몇 분 걸립니다...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   [오류] 설치에 실패했습니다. 인터넷 연결을 확인하세요.
    pause
    exit /b 1
  )
)

echo   브라우저가 자동으로 열립니다. 열리지 않으면 http://localhost:5173/ 을 직접 여세요.
echo.
call npm run dev

echo.
echo   앱이 종료되었습니다.
pause
