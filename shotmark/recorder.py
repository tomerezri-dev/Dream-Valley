"""Record a screen region to an animated GIF."""
from __future__ import annotations

import threading
import time
import tkinter as tk

import mss
from PIL import Image

import platform_utils


def _mss():
    return mss.MSS() if hasattr(mss, "MSS") else mss.mss()

MAX_GIF_WIDTH = 1280


class GifRecorder:
    """Shows a red frame around the region and a floating Stop bar while recording.

    on_finish(frames, durations_ms) runs on the Tk thread after Stop.
    """

    def __init__(self, root, box, fps, max_seconds, on_finish):
        self.root = root
        self.box = box
        self.fps = max(1, min(30, int(fps)))
        self.max_seconds = max_seconds
        self.on_finish = on_finish
        self.frames = []
        self.times = []
        self._stop = threading.Event()
        self._start_time = time.time()
        self._make_frame_window()
        self._make_controls()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        self._tick()

    # ---- UI ------------------------------------------------------------
    def _make_frame_window(self):
        x0, y0, x1, y1 = self.box
        b = 3
        self.frame_win = None
        if not platform_utils.IS_WIN:
            return  # transparent click-through frame needs Windows' -transparentcolor
        w = tk.Toplevel(self.root)
        w.overrideredirect(True)
        w.attributes("-topmost", True)
        key = "#ff00fe"
        w.configure(bg=key)
        w.attributes("-transparentcolor", key)
        w.geometry(f"{x1 - x0 + 2 * b}x{y1 - y0 + 2 * b}{x0 - b:+d}{y0 - b:+d}")
        c = tk.Canvas(w, bg=key, highlightthickness=0)
        c.pack(fill="both", expand=True)
        c.create_rectangle(1, 1, x1 - x0 + 2 * b - 1, y1 - y0 + 2 * b - 1, outline="#e53935", width=b)
        self.frame_win = w

    def _make_controls(self):
        x0, y0, x1, y1 = self.box
        w = self.ctrl = tk.Toplevel(self.root)
        w.overrideredirect(True)
        w.attributes("-topmost", True)
        w.configure(bg="#202020")
        self.dot = tk.Label(w, text="●", fg="#e53935", bg="#202020", font=("Segoe UI", 12))
        self.dot.pack(side="left", padx=(10, 4), pady=6)
        self.clock = tk.Label(w, text="0:00", fg="white", bg="#202020", font=("Consolas", 11))
        self.clock.pack(side="left", padx=4)
        tk.Button(w, text="■ Stop", command=self.stop, bg="#e53935", fg="white", relief="flat",
                  activebackground="#c62828", padx=10).pack(side="left", padx=6, pady=6)
        tk.Button(w, text="✕", command=self.cancel, bg="#404040", fg="white", relief="flat",
                  padx=6).pack(side="left", padx=(0, 8), pady=6)
        w.update_idletasks()
        cw, ch = w.winfo_reqwidth(), w.winfo_reqheight()
        # place the bar just below the region, or above it, or inside top-right
        sh = w.winfo_screenheight()
        if y1 + 10 + ch < sh:
            px, py = x1 - cw, y1 + 10
        elif y0 - 10 - ch > 0:
            px, py = x1 - cw, y0 - 10 - ch
        else:
            px, py = x1 - cw - 10, y0 + 10
        w.geometry(f"+{max(0, px)}+{max(0, py)}")
        self.cancelled = False

    def _tick(self):
        if self._stop.is_set():
            return
        el = int(time.time() - self._start_time)
        self.clock.configure(text=f"{el // 60}:{el % 60:02d}")
        self.dot.configure(fg="#e53935" if el % 2 == 0 else "#202020")
        if el >= self.max_seconds:
            self.stop()
            return
        self.root.after(250, self._tick)

    # ---- capture loop --------------------------------------------------
    def _run(self):
        x0, y0, x1, y1 = self.box
        region = {"left": x0, "top": y0, "width": x1 - x0, "height": y1 - y0}
        interval = 1.0 / self.fps
        scale = min(1.0, MAX_GIF_WIDTH / max(1, x1 - x0))
        with _mss() as sct:
            nxt = time.time()
            while not self._stop.is_set():
                shot = sct.grab(region)
                img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
                if scale < 1:
                    img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
                self.frames.append(img)
                self.times.append(time.time())
                nxt += interval
                time.sleep(max(0, nxt - time.time()))

    def _close(self):
        self._stop.set()
        self._thread.join(timeout=2)
        for w in (self.ctrl, self.frame_win):
            if w is not None:
                w.destroy()

    def stop(self):
        if self._stop.is_set():
            return
        self._close()
        durations = []
        for i in range(len(self.times)):
            nxt = self.times[i + 1] if i + 1 < len(self.times) else self.times[i] + 1 / self.fps
            durations.append(max(20, int((nxt - self.times[i]) * 1000)))
        self.on_finish(self.frames, durations)

    def cancel(self):
        if not self._stop.is_set():
            self._close()
            self.on_finish([], [])


def save_gif(frames, durations, path):
    if not frames:
        return False
    pal = [f.convert("P", palette=Image.ADAPTIVE, colors=255) for f in frames]
    pal[0].save(path, save_all=True, append_images=pal[1:], duration=durations, loop=0,
                optimize=False, disposal=1)
    return True
