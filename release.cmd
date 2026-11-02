@echo off
cd /d "%~dp0"
node scripts/release.mjs --interactive
if errorlevel 1 echo Release stopped. See the error above.
pause
