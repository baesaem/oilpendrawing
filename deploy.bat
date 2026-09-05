@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 리천 오일펜 드로잉 도우미 - 배포

where git >nul 2>&1
if errorlevel 1 (
  echo   [오류] git 이 설치되어 있지 않습니다.
  pause
  exit /b 1
)

echo.
echo   바뀐 파일
echo   ------------------------------------------------
git status --short
echo   ------------------------------------------------
echo.

git status --porcelain | findstr /r "." >nul
if errorlevel 1 (
  echo   바뀐 내용이 없습니다. 원격에 새 내용이 있으면 받아만 옵니다.
  git pull --rebase --autostash
  echo.
  pause
  exit /b 0
)

set "msg="
set /p msg=  무엇을 바꿨나요 (그냥 엔터 치면 자동으로 적습니다): 
if "%msg%"=="" set "msg=로컬 작업 반영"

git add -A
git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo   [오류] 커밋에 실패했습니다.
  pause
  exit /b 1
)

echo.
echo   원격에 다른 변경이 있으면 먼저 받아서 합칩니다...
git pull --rebase --autostash
if errorlevel 1 (
  echo.
  echo   [충돌] 원격의 변경과 같은 곳을 고쳐서 자동으로 합치지 못했습니다.
  echo   해결 방법: 이 폴더에서 claude 를 실행해 "충돌 해결해 줘" 라고 하거나,
  echo   git status 로 충돌 파일을 확인해 고친 뒤  git rebase --continue  를 실행하세요.
  echo   되돌리려면  git rebase --abort
  pause
  exit /b 1
)

echo.
echo   GitHub 으로 보냅니다...
git push
if errorlevel 1 (
  echo.
  echo   [오류] 전송에 실패했습니다. 인터넷 연결이나 GitHub 로그인을 확인하세요.
  pause
  exit /b 1
)

echo.
echo   보냈습니다. 1~2분 뒤 배포가 끝납니다.
echo   진행 상황: https://github.com/baesaem/oilpendrawing/actions
echo   배포 주소: https://baesaem.github.io/oilpendrawing/
echo.
pause
