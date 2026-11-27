"""Screen grabbing and the full-screen region / window selection overlay."""
from __future__ import annotations

import tkinter as tk

import mss
from PIL import Image, ImageEnhance, ImageTk

import platform_utils


def _mss():
    return mss.MSS() if hasattr(mss, "MSS") else mss.mss()


def grab_virtual_screen():
    """Capture every monitor. Returns (image, (left, top)) of the virtual desktop."""
    img, origin, _ = grab_virtual_screen_info()
    return img, origin


def grab_virtual_screen_info():
    """Like grab_virtual_screen, plus the desktop size in screen coordinates.

    On a Retina Mac the image is larger than the desktop in points (usually 2x);
    on Windows (DPI-aware) and Linux both sizes are the same.
    """
    with _mss() as sct:
        mon = sct.monitors[0]
        shot = sct.grab(mon)
        img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
        return img, (mon["left"], mon["top"]), (mon["width"], mon["height"])


def grab_box(left, top, width, height):
    with _mss() as sct:
        shot = sct.grab({"left": left, "top": top, "width": width, "height": height})
        return Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")


class RegionSelector:
    """Frozen-screen overlay: drag a region, click a window, or Enter for all.

    on_done(box) receives (x0, y0, x1, y1) in *screenshot* pixel coords, or
    None if cancelled. `windows` are rects in desktop coords for hover-snap.
    """

    LOUPE = 15      # source pixels shown in the magnifier
    LOUPE_ZOOM = 8

    def __init__(self, root, screenshot, origin, on_done, windows=(), title="Drag to select an area"):
        self.root = root
        self.img = screenshot
        self.ox, self.oy = origin
        self.on_done = on_done
        self.windows = [(l - self.ox, t - self.oy, r - self.ox, b - self.oy) for l, t, r, b, *_ in windows]
        self.start = None
        self.box = None
        self.hover = None
        self._pending = False
        self._last_xy = (0, 0)

        w, h = screenshot.size
        self.win = tk.Toplevel(root)
        self.win.overrideredirect(True)
        self.win.geometry(f"{w}x{h}{self.ox:+d}{self.oy:+d}")
        self.win.attributes("-topmost", True)
        self.win.configure(cursor="crosshair", bg="black")

        self.dim = ImageEnhance.Brightness(screenshot).enhance(0.45)
        self.tk_dim = ImageTk.PhotoImage(self.dim)
        self.tk_bright = None
        self.tk_loupe = None

        c = self.canvas = tk.Canvas(self.win, width=w, height=h, highlightthickness=0, bd=0, bg="black")
        c.pack(fill="both", expand=True)
        c.create_image(0, 0, image=self.tk_dim, anchor="nw")
        self.bright_id = c.create_image(0, 0, anchor="nw")
        self.border_id = c.create_rectangle(0, 0, 0, 0, outline="#29b6f6", width=2, state="hidden")
        self.vline = c.create_line(0, 0, 0, h, fill="#29b6f6", dash=(4, 4))
        self.hline = c.create_line(0, 0, w, 0, fill="#29b6f6", dash=(4, 4))
        self.size_bg = c.create_rectangle(0, 0, 0, 0, fill="#202020", outline="", state="hidden")
        self.size_txt = c.create_text(0, 0, text="", fill="white", font=("Segoe UI", 10, "bold"),
                                      anchor="nw", state="hidden")
        self.loupe_id = c.create_image(0, 0, anchor="nw")
        self.loupe_border = c.create_rectangle(0, 0, 0, 0, outline="white", width=2)
        self.loupe_txt = c.create_text(0, 0, text="", fill="white", font=("Consolas", 9), anchor="nw")

        hint = f"{title}  ·  click a window to grab it  ·  Enter = full screen  ·  Esc = cancel"
        self._hint(hint)

        c.bind("<Motion>", self._motion)
        c.bind("<ButtonPress-1>", self._press)
        c.bind("<B1-Motion>", self._drag)
        c.bind("<ButtonRelease-1>", self._release)
        c.bind("<Button-3>", lambda e: self._finish(None))
        if platform_utils.IS_MAC:
            c.bind("<Button-2>", lambda e: self._finish(None))  # right-click on macOS
        self.win.bind("<Escape>", lambda e: self._finish(None))
        self.win.bind("<Return>", lambda e: self._finish((0, 0, w, h)))
        self.win.after(10, self._grab_focus)

    def _hint(self, text):
        c = self.canvas
        # put the hint on the monitor at the desktop origin (primary on most setups)
        x = -self.ox + 20 if self.ox < 0 else 20
        y = -self.oy + 20 if self.oy < 0 else 20
        t = c.create_text(x + 12, y + 8, text=text, fill="white", font=("Segoe UI", 11), anchor="nw")
        x0, y0, x1, y1 = c.bbox(t)
        bg = c.create_rectangle(x0 - 12, y0 - 8, x1 + 12, y1 + 8, fill="#202020", outline="#29b6f6")
        c.tag_lower(bg, t)
        self.hint_items = (bg, t)

    def _grab_focus(self):
        self.win.lift()
        self.win.focus_force()
        try:
            self.win.grab_set()
        except tk.TclError:
            pass

    # ---- events --------------------------------------------------------
    def _motion(self, e):
        self._last_xy = (e.x, e.y)
        if self.start is None:
            self.hover = self._window_at(e.x, e.y)
            self.box = self.hover
        self._schedule()

    def _press(self, e):
        self.start = (e.x, e.y)
        self._last_xy = (e.x, e.y)

    def _drag(self, e):
        self._last_xy = (e.x, e.y)
        if self.start:
            x0, y0 = self.start
            if abs(e.x - x0) > 3 or abs(e.y - y0) > 3:
                self.box = (min(x0, e.x), min(y0, e.y), max(x0, e.x) + 1, max(y0, e.y) + 1)
                self.hover = None
        self._schedule()

    def _release(self, e):
        if self.start is None:
            return
        x0, y0 = self.start
        self.start = None
        if abs(e.x - x0) <= 3 and abs(e.y - y0) <= 3:
            target = self._window_at(e.x, e.y)
            if target:
                self._finish(target)
            return  # plain click on empty desktop: keep waiting
        box = (min(x0, e.x), min(y0, e.y), max(x0, e.x) + 1, max(y0, e.y) + 1)
        self._finish(box)

    def _window_at(self, x, y):
        W, H = self.img.size
        for l, t, r, b in self.windows:
            if l <= x < r and t <= y < b:
                return (max(0, l), max(0, t), min(W, r), min(H, b))
        return None

    def _finish(self, box):
        try:
            self.win.grab_release()
        except tk.TclError:
            pass
        self.win.destroy()
        if box and (box[2] - box[0] < 2 or box[3] - box[1] < 2):
            box = None
        self.on_done(box)

    # ---- drawing -------------------------------------------------------
    def _schedule(self):
        if not self._pending:
            self._pending = True
            self.win.after_idle(self._redraw)

    def _redraw(self):
        self._pending = False
        if not self.win.winfo_exists():
            return
        c = self.canvas
        x, y = self._last_xy
        W, H = self.img.size
        c.coords(self.vline, x, 0, x, H)
        c.coords(self.hline, 0, y, W, y)

        if self.box:
            x0, y0, x1, y1 = self.box
            self.tk_bright = ImageTk.PhotoImage(self.img.crop(self.box))
            c.itemconfigure(self.bright_id, image=self.tk_bright, state="normal")
            c.coords(self.bright_id, x0, y0)
            c.coords(self.border_id, x0, y0, x1, y1)
            c.itemconfigure(self.border_id, state="normal")
            label = f" {x1 - x0} × {y1 - y0} "
            ty = y0 - 24 if y0 > 26 else y0 + 4
            c.coords(self.size_txt, x0 + 4, ty + 2)
            c.itemconfigure(self.size_txt, text=label, state="normal")
            bx0, by0, bx1, by1 = c.bbox(self.size_txt)
            c.coords(self.size_bg, bx0 - 2, by0 - 1, bx1 + 2, by1 + 1)
            c.itemconfigure(self.size_bg, state="normal")
        else:
            c.itemconfigure(self.bright_id, state="hidden")
            c.itemconfigure(self.border_id, state="hidden")
            c.itemconfigure(self.size_txt, state="hidden")
            c.itemconfigure(self.size_bg, state="hidden")

        # magnifier
        n = self.LOUPE
        half = n // 2
        crop = Image.new("RGB", (n, n), "black")
        crop.paste(self.img.crop((x - half, y - half, x + half + 1, y + half + 1)), (0, 0))
        z = self.LOUPE_ZOOM
        loupe = crop.resize((n * z, n * z), Image.NEAREST)
        px = loupe.load()
        mid = half * z
        for i in range(n * z):  # crosshair through the centre pixel
            for off in (mid - 1, mid + z):
                if 0 <= off < n * z:
                    px[i, off] = (41, 182, 246)
                    px[off, i] = (41, 182, 246)
        self.tk_loupe = ImageTk.PhotoImage(loupe)
        size = n * z
        lx = x + 24 if x + 24 + size < W else x - 24 - size
        ly = y + 24 if y + 24 + size + 20 < H else y - 24 - size - 20
        c.itemconfigure(self.loupe_id, image=self.tk_loupe)
        c.coords(self.loupe_id, lx, ly)
        c.coords(self.loupe_border, lx, ly, lx + size, ly + size)
        r, g, b = self.img.getpixel((min(max(x, 0), W - 1), min(max(y, 0), H - 1)))
        c.coords(self.loupe_txt, lx, ly + size + 4)
        c.itemconfigure(self.loupe_txt, text=f"{x + self.ox}, {y + self.oy}   #{r:02x}{g:02x}{b:02x}")
        for item in (self.loupe_id, self.loupe_border, self.loupe_txt):
            c.tag_raise(item)

        # hide the hint when the cursor is over it
        bg, t = self.hint_items
        hx0, hy0, hx1, hy1 = c.bbox(bg)
        state = "hidden" if hx0 - 40 <= x <= hx1 + 40 and hy0 - 40 <= y <= hy1 + 40 else "normal"
        c.itemconfigure(bg, state=state)
        c.itemconfigure(t, state=state)


def select_region(root, on_done, title="Drag to select an area", snap_windows=True):
    """Freeze the screen and let the user pick an area.

    on_done(image_or_None, desktop_box_or_None)
    """
    windows = platform_utils.visible_windows() if snap_windows else []
    shot, origin, (lw, lh) = grab_virtual_screen_info()
    # The overlay works in screen coordinates; on Retina the shot has more pixels.
    sx, sy = shot.width / max(1, lw), shot.height / max(1, lh)
    scaled = abs(sx - 1) > 0.01 or abs(sy - 1) > 0.01
    view = shot.resize((lw, lh), Image.LANCZOS) if scaled else shot

    def done(box):
        if box is None:
            on_done(None, None)
            return
        x0, y0, x1, y1 = box
        pixel_box = (round(x0 * sx), round(y0 * sy), round(x1 * sx), round(y1 * sy)) if scaled else box
        on_done(shot.crop(pixel_box), (x0 + origin[0], y0 + origin[1], x1 + origin[0], y1 + origin[1]))

    RegionSelector(root, view, origin, done, windows, title)
