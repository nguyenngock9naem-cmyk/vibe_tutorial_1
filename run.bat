@echo off
chcp 65001 > nul
title Website Tra Cuu Diem Thi Theo MSHV
echo ========================================================
echo   DANG MO WEBSITE TRA CUU DIEM THI THEO MSHV...
echo ========================================================

:: Check if agy-node or node is available
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    node server.js
    goto end
)

:: Check if agy-node exists in AppData
if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    "%APPDATA%\Antigravity\bin\agy-node.cmd" server.js
    goto end
)

:: If node not found, directly open index.html in browser
echo Dang mo truc tiep file index.html tren trinh duyet...
start index.html

:end
pause
