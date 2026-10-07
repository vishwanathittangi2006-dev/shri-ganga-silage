@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
start "Shri Ganga Silage Server" cmd /k "npm start"
timeout /t 2 >nul
start "" http://localhost:3000
