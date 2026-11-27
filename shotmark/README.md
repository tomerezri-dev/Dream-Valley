# ShotMark

A screen capture and annotation tool for **Windows and Mac**, in the spirit of Snagit.
Press **Print Screen** (on a Mac, **⌘⇧2**), drag over what you want (or click a window), mark it up, and it's already saved and on your clipboard.

## Features

**Capture**
- **Region or window**: the screen freezes and dims. Drag to select an area, or hover a window and click to grab exactly that window. A magnifier shows pixel coordinates and the colour under the cursor. Enter grabs everything, Esc cancels.
- **Full screen**: all monitors at once.
- **Delayed capture**: a countdown (3 s by default) gives you time to open menus or tooltips first.
- **GIF recording**: select an area, record it with a red frame and a Stop button, and get an animated GIF.
- **Global hotkeys** that work from any app. You can change them in Settings.

  | | Windows | Mac |
  |---|---|---|
  | Region / window | `PrintScreen` | `⌘⇧2` |
  | Full screen | `Ctrl+PrintScreen` | `⌘⇧1` |
  | Record GIF | `Shift+PrintScreen` | `⌘⇧8` |
- Every capture is saved to `Pictures\ShotMark` and copied to the clipboard. You can turn either off.
- Keeps running when you close the window: in the system tray on Windows, in the Dock on Mac.

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

### Option 1: download a ready-made build
Every push that touches `shotmark/` runs the **Build ShotMark** GitHub Action. Open the latest run on the repository's *Actions* tab and download:

- **`ShotMark-windows`**: a single `ShotMark.exe` with nothing else to install. Windows SmartScreen may warn the first time because it isn't code-signed. Choose *More info → Run anyway*.
- **`ShotMark-mac`**: `ShotMark.app` for Apple Silicon Macs (M1 and later). Unzip it and drag it to *Applications*. See **First run on a Mac** below. Intel Macs can run ShotMark from source.

### Option 2: run from source
1. Install [Python 3.9+](https://www.python.org/downloads/) and tick "Add to PATH".
2. Double-click `run.bat`, or run:
   ```
   pip install -r requirements.txt
   python main.py
   ```
3. To build your own exe, double-click `build_exe.bat`. The result goes to `dist\ShotMark.exe`.

On a Mac, double-click `run_mac.command` (you may need to right-click it and choose *Open* the first time), or run `python3 main.py`. Use the Python installer from python.org, because it includes Tk. `./build_mac.sh` builds `dist/ShotMark.app`.

To start ShotMark with Windows, press Win+R, type `shell:startup`, and put a shortcut to `ShotMark.exe` there.

## Print Screen opens the Snipping Tool instead?
Windows 11 reserves the key by default. Turn off **Settings → Accessibility → Keyboard → "Use the Print screen key to open screen capture"** and restart ShotMark. Alternatively, choose another hotkey in **File → Settings**, e.g. `Ctrl+Shift+S`.

## First run on a Mac
1. **Opening it:** the app isn't notarized by Apple, so the first double-click is blocked. Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to ShotMark. You only need to do this once. If macOS says the app "is damaged", run `xattr -dr com.apple.quarantine /Applications/ShotMark.app` in Terminal.
2. **Screen Recording:** macOS asks for this permission the first time you capture. Allow ShotMark under **Privacy & Security → Screen & System Audio Recording**, then quit and reopen it. Until you do, captures show only the desktop wallpaper.
3. **Hotkeys:** for ⌘⇧2 to work while other apps are in front, allow ShotMark under **Privacy & Security → Accessibility** and **Input Monitoring**, then reopen it. The capture buttons inside the app work without this.

On a Mac, ShotMark uses ⌘ wherever Windows uses Ctrl, e.g. ⌘Z undo and ⌘S save. Captures from a Retina screen are saved at full Retina resolution.

## How it's built
Plain Python with Tkinter, [Pillow](https://python-pillow.org/), [mss](https://github.com/BoboTiG/python-mss) for fast multi-monitor capture, and [pystray](https://github.com/moses-palmer/pystray) for the tray icon. Windows features (DPI awareness, window snapping, clipboard, global hotkeys via `RegisterHotKey`) use `ctypes`, so there are no compiled extensions. On a Mac, window snapping uses Quartz (`pyobjc`), hotkeys use `pynput`, and the clipboard uses `osascript`.

| File | |
|---|---|
| `main.py` | entry point |
| `app.py` | main window, menus, capture flow, tray, hotkeys, settings dialog |
| `capture.py` | screen grab and the region/window selection overlay |
| `editor.py` | canvas, tools, selection, undo/redo, zoom |
| `annotations.py` | shapes and the anti-aliased renderer (the same code draws the preview and the saved file) |
| `recorder.py` | GIF recording |
| `effects.py` | border, shadow, rounded corners, torn edge |
| `platform_utils.py` | Windows and Mac integration |
| `settings.py` | settings in `%APPDATA%\ShotMark\settings.json` (Mac: `~/Library/Application Support/ShotMark`) |

It also runs on Linux for development. The red frame shown around the area while recording a GIF is Windows-only.
