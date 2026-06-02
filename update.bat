@echo off
cd /d "%~dp0"
echo Lade Aenderungen zu GitHub hoch...
git add -A
git commit -m "Update %date% %time%"
git push
echo.
echo Fertig! Vercel deployt in ~30 Sekunden automatisch.
pause
