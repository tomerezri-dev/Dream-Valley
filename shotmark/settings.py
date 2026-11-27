"""User settings stored as JSON in the per-user app data folder."""
import json
import os
import sys

APP_NAME = "ShotMark"


def _config_dir():
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
    elif sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")
    return os.path.join(base, APP_NAME)


def _default_save_dir():
    pictures = os.path.join(os.path.expanduser("~"), "Pictures")
    return os.path.join(pictures if os.path.isdir(pictures) else os.path.expanduser("~"), APP_NAME)


DEFAULTS = {
    "save_dir": _default_save_dir(),
    "auto_save": True,
    "copy_to_clipboard": True,
    "image_format": "png",          # png or jpg
    # Macs have no Print Screen key, and Cmd+Shift+3/4/5 belong to macOS.
    "hotkey_region": "Cmd+Shift+2" if sys.platform == "darwin" else "PrintScreen",
    "hotkey_fullscreen": "Cmd+Shift+1" if sys.platform == "darwin" else "Ctrl+PrintScreen",
    "hotkey_record": "Cmd+Shift+8" if sys.platform == "darwin" else "Shift+PrintScreen",
    "delay_seconds": 3,
    "gif_fps": 10,
    "gif_max_seconds": 60,
    "minimize_to_tray": True,
}


class Settings(dict):
    path = os.path.join(_config_dir(), "settings.json")

    def __init__(self):
        super().__init__(DEFAULTS)
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            self.update({k: v for k, v in data.items() if k in DEFAULTS})
        except (OSError, ValueError):
            pass

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(dict(self), f, indent=2)
