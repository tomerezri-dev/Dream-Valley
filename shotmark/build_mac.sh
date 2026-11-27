#!/bin/bash
# Build dist/ShotMark.app on macOS.
set -e
cd "$(dirname "$0")"
python3 -m pip install --quiet -r requirements.txt pyinstaller
pyinstaller --noconfirm --windowed --name ShotMark --icon icon.icns --osx-bundle-identifier com.shotmark.app main.py
echo "Done: $(pwd)/dist/ShotMark.app"
