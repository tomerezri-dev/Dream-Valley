@echo off
rem Run ShotMark from source (needs Python 3.9+ from python.org)
cd /d "%~dp0"
python -m pip install --quiet -r requirements.txt
start "" pythonw main.py
