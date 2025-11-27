@echo off
echo ==========================================
echo NAPRAWA POLACZENIA Z NETLIFY
echo ==========================================
echo.
echo Wykrylem problem: Twoj Netlify czeka na zmiany w "chivalry-tierlist",
echo a Ty wyslales je do "projekt-chvialarystats".
echo.
echo Naprawiam to teraz...

git remote remove origin
git remote add origin https://github.com/KonradButtermilk/chivalry-tierlist.git
git push -u origin main --force

echo.
echo ==========================================
echo TERAZ powinno byc dobrze!
echo Sprawdz Netlify -> Deploys.
echo ==========================================
pause
