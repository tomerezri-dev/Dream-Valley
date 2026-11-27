# ShotMark

A screen capture and annotation tool for Windows, in the spirit of Snagit.
Press **Print Screen**, drag over what you want (or click a window), mark it up, and it's already saved and on your clipboard.

## Features

**Capture**
- **Region or window**: the screen freezes and dims. Drag to select an area, or hover a window and click to grab exactly that window. A magnifier shows pixel coordinates and the colour under the cursor. Enter grabs everything, Esc cancels.
- **Full screen**: all monitors at once.
- **Delayed capture**: a countdown (3 s by default) gives you time to open menus or tooltips first.
- **GIF recording**: select an area, record it with a red frame and a Stop button, and get an animated GIF.
- **Global hotkeys** that work from any app: `PrintScreen` (region), `Ctrl+PrintScreen` (full screen), `Shift+PrintScreen` (record). You can change them in Settings.
- Every capture is saved to `Pictures\ShotMark` and copied to the clipboard. You can turn either off.
- Lives in the system tray. Closing the window keeps it running.

**Edit**
| Tool | Key | |
|---|---|---|
| Select / move | V | drag to move, Del to delete, arrow keys to nudge, double-click text to edit |
| Arrow | A | Shift snaps to 45° |
| Line | L | Shift snaps to 45° |
| Rectangle | R | Shift for a square |
| Ellipse | E | Shift for a circle |
| Pen | P | freehand |
| Highlighter | H | see-through marker |
| Text | T | outlined, so it reads on any background |
| Step number | N | numbered badges ①②③ that count up automatically |
| Blur | B | pixelates passwords, emails, faces |
| Crop | C | |

- Choose colours, line width and text size. Changing a style while a shape is selected restyles that shape.
- Unlimited undo/redo (Ctrl+Z / Ctrl+Y). Annotations stay editable until you save.
- Image effects: border, drop shadow, rounded corners, torn edge, rotate, resize 50%.
- Zoom with Ctrl+mouse wheel. Ctrl+0 shows actual size, Ctrl+9 fits the window.
- Save as PNG, JPG, BMP or WebP. You can also copy, paste an image from the clipboard (Ctrl+V), or open an existing file.
- A strip of recent captures sits at the bottom. Click one to reopen it.

## Install

### Option 1: download the .exe
Every push that touches `shotmark/` runs the **Build ShotMark for Windows** GitHub Action.
Open the run on the repository's *Actions* tab and download the `ShotMark-windows` artifact. It contains a single `ShotMark.exe` with nothing else to install.
Windows SmartScreen may warn the first time because the exe isn't code-signed. Choose *More info → Run anyway*.

### Option 2: run from source
1. Install [Python 3.9+](https://www.python.org/downloads/) and tick "Add to PATH".
2. Double-click `run.bat`, or run:
   ```
   pip install -r requirements.txt
   python main.py
   ```
3. To build your own exe, double-click `build_exe.bat`. The result goes to `dist\ShotMark.exe`.

To start ShotMark with Windows, press Win+R, type `shell:startup`, and put a shortcut to `ShotMark.exe` there.

## Print Screen opens the Snipping Tool instead?
Windows 11 reserves the key by default. Turn off **Settings → Accessibility → Keyboard → "Use the Print screen key to open screen capture"** and restart ShotMark. Alternatively, choose another hotkey in **File → Settings**, e.g. `Ctrl+Shift+S`.

## How it's built
Plain Python with Tkinter, [Pillow](https://python-pillow.org/), [mss](https://github.com/BoboTiG/python-mss) for fast multi-monitor capture, and [pystray](https://github.com/moses-palmer/pystray) for the tray icon. Windows features (DPI awareness, window snapping, clipboard, global hotkeys via `RegisterHotKey`) use `ctypes`, so there are no compiled extensions.

| File | |
|---|---|
| `main.py` | entry point |
| `app.py` | main window, menus, capture flow, tray, hotkeys, settings dialog |
| `capture.py` | screen grab and the region/window selection overlay |
| `editor.py` | canvas, tools, selection, undo/redo, zoom |
| `annotations.py` | shapes and the anti-aliased renderer (the same code draws the preview and the saved file) |
| `recorder.py` | GIF recording |
| `effects.py` | border, shadow, rounded corners, torn edge |
| `platform_utils.py` | Windows integration through ctypes |
| `settings.py` | settings in `%APPDATA%\ShotMark\settings.json` |

It also runs on Linux for development. Window snapping and the click-through recording frame are Windows-only.
