@echo off
rem Build a single ShotMark.exe in the dist folder
cd /d "%~dp0"
python -m pip install --quiet -r requirements.txt pyinstaller
pyinstaller --noconfirm --onefile --windowed --name ShotMark --icon icon.ico main.py
echo.
echo Done: %~dp0dist\ShotMark.exe
pause
