@echo off
setlocal enabledelayedexpansion
echo ==========================================
echo KONFIGURACJA GITHUB (NAPRAWA V2)
echo ==========================================
echo.

:: 1. Konfiguracja tożsamości
git config user.email "user@example.com"
git config user.name "Chivalry Admin"

:: 2. Dodanie plików
git add .
git commit -m "Poprawka deployu" 2>nul

:: 3. Pobieranie linku (z petla)
:ask_url
echo.
echo Wklej link do swojego repozytorium GitHub 
echo (np. https://github.com/KonradButtermilk/chivalry-tierlist.git)
echo i nacisnij ENTER:
set /p repo_url=

if "!repo_url!"=="" (
    echo BLAD: Nie podano linku! Sprobuj ponownie.
    goto ask_url
)

echo.
echo Wybrano: !repo_url!
echo Konfigurowanie...

:: 4. Podlaczenie i wyslanie
git remote remove origin 2>nul
git remote add origin !repo_url!
git branch -M main
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo WYSTAPIL BLAD PRZY WYSYLANIU!
    echo Sprawdz czy link jest poprawny i czy masz dostep do internetu.
) else (
    echo.
    echo ==========================================
    echo SUKCES! PLIKI WYSLANE NA GITHUB.
    echo.
    echo Teraz wroc na Netlify i dokoncz konfiguracje.
    echo ==========================================
)
pause
