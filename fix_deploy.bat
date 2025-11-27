@echo off
echo ==========================================
echo NAPRAWA DEPLOYU (WYMUSZENIE)
echo ==========================================
echo.

git add .
git commit -m "Force Netlify build"
git push -u origin main

echo.
echo ==========================================
echo Zmiany wyslane!
echo Teraz sprawdz na Netlify, czy nowy deploy trwa dluzej niz 12s.
echo ==========================================
pause
