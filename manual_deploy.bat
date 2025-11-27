@echo off
setlocal enabledelayedexpansion
echo ==========================================
echo DIAGNOSTYKA I NAPRAWA DEPLOYU
echo ==========================================
echo.

:: 1. Sprawdzenie Gita
echo [1/5] Sprawdzanie Gita...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo BLAD: Git nie jest zainstalowany lub nie ma go w PATH!
    pause
    exit /b
)
echo Git jest OK.

:: 2. Sprawdzenie statusu
echo.
echo [2/5] Sprawdzanie zmian...
git status

:: 3. Dodanie plikow
echo.
echo [3/5] Dodawanie plikow...
git add .

:: 4. Commit
echo.
echo [4/5] Tworzenie commita...
git commit -m "Wymuszenie deployu (Manual Fix)" 
if %errorlevel% neq 0 (
    echo (Brak nowych zmian do zatwierdzenia, ale probujemy wyslac dalej)
)

:: 5. Wysylanie
echo.
echo [5/5] Wysylanie na GitHub...
echo Upewnij sie, ze masz internet!
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    echo BLAD WYSYLANIA!
    echo.
    echo Mozliwe przyczyny:
    echo 1. Nie masz uprawnien (zaloguj sie w oknie ktore wyskoczylo).
    echo 2. Zly link do repozytorium.
    echo 3. Konflikt wersji (ktos inny cos zmienil).
    echo.
    echo Sprobujmy naprawic "remote" (link do repo)...
    echo.
    set /p repo_url="Wklej link do repozytorium GitHub (np. https://github.com/...): "
    git remote remove origin
    git remote add origin !repo_url!
    echo.
    echo Probujemy wyslac jeszcze raz...
    git push -u origin main --force
)

echo.
echo ==========================================
echo KONIEC.
echo Jesli widzisz powyzej bledy, zrob zdjecie i wyslij mi.
echo Jesli jest OK, sprawdz Netlify.
echo ==========================================
pause
