"""OS integration: DPI awareness, window rectangles, clipboard, global hotkeys.

Windows gets native implementations through ctypes; other platforms get
best-effort fallbacks so the app can still be developed and tested there.
"""
from __future__ import annotations

import io
import shutil
import subprocess
import sys
import threading

IS_WIN = sys.platform == "win32"

if IS_WIN:
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    try:
        dwmapi = ctypes.windll.dwmapi
    except OSError:
        dwmapi = None


def enable_dpi_awareness():
    """Make screen coordinates real pixels so captures match what Tk reports."""
    if not IS_WIN:
        return
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)  # per-monitor aware
    except Exception:
        try:
            user32.SetProcessDPIAware()
        except Exception:
            pass


# ---- window enumeration -------------------------------------------------
def visible_windows():
    """Top-level window rects (left, top, right, bottom, title), front to back."""
    if not IS_WIN:
        return []
    result = []
    DWMWA_EXTENDED_FRAME_BOUNDS = 9
    DWMWA_CLOAKED = 14
    GWL_EXSTYLE = -20
    WS_EX_TOOLWINDOW = 0x00000080

    EnumProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.GetWindowLongW.restype = ctypes.c_long

    def cb(hwnd, _):
        if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd):
            return True
        if user32.GetWindowLongW(hwnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW:
            return True
        if dwmapi:
            cloaked = ctypes.c_int(0)
            dwmapi.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, ctypes.byref(cloaked), ctypes.sizeof(cloaked))
            if cloaked.value:
                return True
        rect = wintypes.RECT()
        ok = False
        if dwmapi:
            ok = dwmapi.DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS,
                                              ctypes.byref(rect), ctypes.sizeof(rect)) == 0
        if not ok:
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
        if rect.right - rect.left < 40 or rect.bottom - rect.top < 30:
            return True
        n = user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, buf, n + 1)
        if not buf.value:
            return True
        result.append((rect.left, rect.top, rect.right, rect.bottom, buf.value))
        return True

    user32.EnumWindows(EnumProc(cb), 0)
    return result


# ---- clipboard ----------------------------------------------------------
def copy_image_to_clipboard(img) -> bool:
    if IS_WIN:
        return _win_copy(img)
    for cmd in (["wl-copy", "--type", "image/png"], ["xclip", "-selection", "clipboard", "-t", "image/png"]):
        if shutil.which(cmd[0]):
            buf = io.BytesIO()
            img.save(buf, "PNG")
            try:
                subprocess.run(cmd, input=buf.getvalue(), check=True, timeout=5)
                return True
            except Exception:
                pass
    return False


def _win_copy(img) -> bool:
    CF_DIB = 8
    GMEM_MOVEABLE = 0x0002
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "BMP")
    data = buf.getvalue()[14:]  # strip BITMAPFILEHEADER

    kernel32.GlobalAlloc.restype = ctypes.c_void_p
    kernel32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    user32.SetClipboardData.argtypes = [wintypes.UINT, ctypes.c_void_p]
    user32.SetClipboardData.restype = ctypes.c_void_p

    if not user32.OpenClipboard(None):
        return False
    try:
        user32.EmptyClipboard()
        h = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(data))
        if not h:
            return False
        p = kernel32.GlobalLock(h)
        ctypes.memmove(p, data, len(data))
        kernel32.GlobalUnlock(h)
        return bool(user32.SetClipboardData(CF_DIB, h))
    finally:
        user32.CloseClipboard()


# ---- global hotkeys -----------------------------------------------------
_VK = {"printscreen": 0x2C, "prtsc": 0x2C, "print": 0x2C, "space": 0x20, "insert": 0x2D,
       "delete": 0x2E, "home": 0x24, "end": 0x23, "pause": 0x13, "scrolllock": 0x91}
_VK.update({f"f{i}": 0x6F + i for i in range(1, 25)})
_MOD = {"alt": 0x1, "ctrl": 0x2, "control": 0x2, "shift": 0x4, "win": 0x8}


def parse_hotkey(text):
    """'Ctrl+Shift+S' -> (modifiers, vk). Raises ValueError if invalid."""
    mods, vk = 0, None
    for part in [p.strip().lower() for p in text.split("+") if p.strip()]:
        if part in _MOD:
            mods |= _MOD[part]
        elif part in _VK:
            vk = _VK[part]
        elif len(part) == 1 and part.isalnum():
            vk = ord(part.upper())
        else:
            raise ValueError(f"Unknown key: {part}")
    if vk is None:
        raise ValueError("Hotkey needs a non-modifier key")
    return mods, vk


def _pynput_combo(text):
    names = {"ctrl": "<ctrl>", "control": "<ctrl>", "shift": "<shift>", "alt": "<alt>", "win": "<cmd>",
             "printscreen": "<print_screen>", "prtsc": "<print_screen>", "print": "<print_screen>"}
    out = []
    for part in [p.strip().lower() for p in text.split("+") if p.strip()]:
        if part in names:
            out.append(names[part])
        elif part.startswith("f") and part[1:].isdigit():
            out.append(f"<{part}>")
        else:
            out.append(part)
    return "+".join(out)


class HotkeyManager:
    """Registers global hotkeys; callbacks run on a background thread."""

    def __init__(self):
        self.errors = []
        self._thread = None
        self._listener = None
        self._thread_id = None

    def start(self, bindings):
        """bindings: {hotkey_text: callback}"""
        if IS_WIN:
            self._thread = threading.Thread(target=self._win_loop, args=(bindings,), daemon=True)
            self._thread.start()
        else:
            try:
                from pynput import keyboard
                combos = {}
                for text, fn in bindings.items():
                    try:
                        combos[_pynput_combo(text)] = fn
                    except Exception as e:  # noqa: BLE001
                        self.errors.append(f"{text}: {e}")
                self._listener = keyboard.GlobalHotKeys(combos)
                self._listener.daemon = True
                self._listener.start()
            except Exception as e:  # noqa: BLE001
                self.errors.append(f"Global hotkeys unavailable ({e})")

    def stop(self):
        if IS_WIN and self._thread_id:
            user32.PostThreadMessageW(self._thread_id, 0x0012, 0, 0)  # WM_QUIT
        if self._listener:
            self._listener.stop()

    def _win_loop(self, bindings):
        MOD_NOREPEAT = 0x4000
        WM_HOTKEY = 0x0312
        self._thread_id = kernel32.GetCurrentThreadId()
        ids = {}
        for i, (text, fn) in enumerate(bindings.items(), start=1):
            try:
                mods, vk = parse_hotkey(text)
            except ValueError as e:
                self.errors.append(f"{text}: {e}")
                continue
            if user32.RegisterHotKey(None, i, mods | MOD_NOREPEAT, vk):
                ids[i] = fn
            else:
                self.errors.append(f"{text} is already used by another program")
        msg = wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            if msg.message == WM_HOTKEY and msg.wParam in ids:
                try:
                    ids[msg.wParam]()
                except Exception:  # noqa: BLE001
                    pass
        for i in ids:
            user32.UnregisterHotKey(None, i)
