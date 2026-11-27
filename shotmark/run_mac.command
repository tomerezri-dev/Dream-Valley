#!/bin/bash
# Run ShotMark from source on macOS (double-click in Finder, or run in Terminal).
# Needs Python 3.9+ from python.org (it includes Tk).
cd "$(dirname "$0")"
python3 -m pip install --quiet -r requirements.txt
python3 main.py
