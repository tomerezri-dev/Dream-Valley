"""ShotMark main window: capture buttons, tools, recent captures, tray, hotkeys."""
from __future__ import annotations

import os
import queue
import subprocess
import sys
import threading
import time
import tkinter as tk
from tkinter import colorchooser, filedialog, messagebox, ttk

from PIL import Image, ImageGrab, ImageTk

import capture
import effects
import platform_utils
import recorder
from editor import TOOLS, Editor
from settings import APP_NAME, Settings

IS_MAC = platform_utils.IS_MAC
MOD = "Command" if IS_MAC else "Control"   # Tk event modifier for shortcuts
MODL = "⌘" if IS_MAC else "Ctrl+"          # how shortcuts are shown in menus

SWATCHES = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#000000", "#ffffff"]
WIDTHS = [2, 4, 6, 10]
FONT_SIZES = [16, 20, 28, 36, 48, 64]


class App:
    def __init__(self):
        self.settings = Settings()
        self.root = tk.Tk()
        self.root.title(APP_NAME)
        self.root.geometry("1180x760")
        self.root.minsize(760, 480)
        self._set_icon()
        self._style()

        self.events = queue.Queue()
        self.busy = False
        self.tray = None
        self.hotkeys = platform_utils.HotkeyManager()
        self._thumbs = []

        self._build_menu()
        self._build_toolbar()
        self._build_body()
        self._bind_keys()

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self._start_hotkeys()
        self._start_tray()
        self.root.after(100, self._poll_events)
        self.root.after(1500, self._report_hotkey_errors)
        self.refresh_recent()

    # ================================================================ UI
    def _style(self):
        s = ttk.Style(self.root)
        if "vista" in s.theme_names():
            s.theme_use("vista")
        elif "clam" in s.theme_names():
            s.theme_use("clam")
        s.configure("Tool.TButton", font=("Segoe UI Symbol", 14), padding=(6, 4), width=3)
        s.configure("ToolOn.TButton", font=("Segoe UI Symbol", 14), padding=(6, 4), width=3,
                    background="#29b6f6")
        s.map("ToolOn.TButton", background=[("!disabled", "#29b6f6")])
        s.configure("Capture.TButton", font=("Segoe UI", 10, "bold"), padding=(12, 6), width=0)
        s.configure("Bar.TButton", padding=(8, 4), width=0)

    def _set_icon(self):
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        from PIL import ImageDraw
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((2, 2, 62, 62), 14, fill="#1e88e5")
        d.rectangle((14, 14, 50, 50), outline="white", width=4)
        d.polygon([(30, 34), (54, 46), (44, 49), (50, 60), (45, 62), (39, 51), (31, 57)], fill="#e53935",
                  outline="white")
        self.icon_image = img
        self._tk_icon = ImageTk.PhotoImage(img)
        self.root.iconphoto(True, self._tk_icon)

    def _build_menu(self):
        m = tk.Menu(self.root)
        f = tk.Menu(m, tearoff=False)
        f.add_command(label="Capture region / window", accelerator=MODL + "N", command=self.capture_region)
        f.add_command(label="Capture full screen", command=self.capture_fullscreen)
        f.add_command(label="Delayed capture", command=self.capture_delayed)
        f.add_command(label="Record GIF", command=self.record_gif)
        f.add_separator()
        f.add_command(label="Open…", accelerator=MODL + "O", command=self.open_file)
        f.add_command(label="Paste image", accelerator=MODL + "V", command=self.paste)
        f.add_command(label="Save", accelerator=MODL + "S", command=self.save)
        f.add_command(label="Save as…", accelerator=MODL + "Shift+S", command=self.save_as)
        f.add_command(label="Copy to clipboard", accelerator=MODL + "C", command=self.copy)
        f.add_separator()
        f.add_command(label="Open captures folder", command=self.open_folder)
        f.add_command(label="Settings…", command=self.open_settings)
        f.add_separator()
        f.add_command(label="Exit", command=self.quit)
        m.add_cascade(label="File", menu=f)

        e = tk.Menu(m, tearoff=False)
        e.add_command(label="Undo", accelerator=MODL + "Z", command=lambda: self.editor.undo())
        e.add_command(label="Redo", accelerator=MODL + "Y", command=lambda: self.editor.redo())
        e.add_command(label="Delete selected", accelerator="Del", command=lambda: self.editor.delete_selected())
        m.add_cascade(label="Edit", menu=e)

        im = tk.Menu(m, tearoff=False)
        im.add_command(label="Add border", command=lambda: self._effect(effects.border))
        im.add_command(label="Drop shadow", command=lambda: self._effect(effects.drop_shadow))
        im.add_command(label="Rounded corners", command=lambda: self._effect(effects.rounded))
        im.add_command(label="Torn edge", command=lambda: self._effect(effects.torn_edge))
        im.add_separator()
        im.add_command(label="Rotate right", command=lambda: self._effect(lambda i: i.rotate(-90, expand=True)))
        im.add_command(label="Rotate left", command=lambda: self._effect(lambda i: i.rotate(90, expand=True)))
        im.add_command(label="Resize 50%", command=lambda: self._effect(
            lambda i: i.resize((max(1, i.width // 2), max(1, i.height // 2)), Image.LANCZOS)))
        m.add_cascade(label="Image", menu=im)

        v = tk.Menu(m, tearoff=False)
        v.add_command(label="Zoom in", accelerator=MODL + "+", command=lambda: self.editor.zoom_by(1.25))
        v.add_command(label="Zoom out", accelerator=MODL + "-", command=lambda: self.editor.zoom_by(0.8))
        v.add_command(label="Actual size", accelerator=MODL + "0", command=lambda: self.editor.set_zoom(1.0))
        v.add_command(label="Fit to window", accelerator=MODL + "9", command=lambda: self.editor.set_zoom(None))
        m.add_cascade(label="View", menu=v)

        hl = tk.Menu(m, tearoff=False)
        hl.add_command(label="Keyboard shortcuts", command=self.show_help)
        hl.add_command(label=f"About {APP_NAME}", command=lambda: messagebox.showinfo(
            APP_NAME, f"{APP_NAME}\nScreen capture and annotation for Windows."))
        m.add_cascade(label="Help", menu=hl)
        self.root.config(menu=m)

    def _build_toolbar(self):
        bar = ttk.Frame(self.root, padding=(8, 6))
        bar.pack(side="top", fill="x")
        hk = self.settings["hotkey_region"]
        ttk.Button(bar, text=f"📷  Capture  ({hk})", style="Capture.TButton",
                   command=self.capture_region).pack(side="left")
        ttk.Button(bar, text="🖥 Full screen", style="Bar.TButton", command=self.capture_fullscreen).pack(side="left", padx=(6, 0))
        self.delay_btn = ttk.Button(bar, text=f"⏱ Delay {self.settings['delay_seconds']}s", style="Bar.TButton",
                                    command=self.capture_delayed)
        self.delay_btn.pack(side="left", padx=(6, 0))
        ttk.Button(bar, text="⏺ Record GIF", style="Bar.TButton", command=self.record_gif).pack(side="left", padx=(6, 0))

        ttk.Separator(bar, orient="vertical").pack(side="left", fill="y", padx=10)
        for text, cmd in (("💾 Save", self.save), ("📋 Copy", self.copy), ("↶", lambda: self.editor.undo()),
                          ("↷", lambda: self.editor.redo())):
            ttk.Button(bar, text=text, style="Bar.TButton", command=cmd).pack(side="left", padx=2)

        # style controls on a second row
        right = ttk.Frame(self.root, padding=(8, 0, 8, 6))
        right.pack(side="top", fill="x")
        ttk.Label(right, text="Color").pack(side="left", padx=(0, 4))
        self.swatch_frame = tk.Frame(right)
        self.swatch_frame.pack(side="left")
        self.swatches = {}
        for col in SWATCHES:
            b = tk.Label(self.swatch_frame, bg=col, width=2, height=1, relief="flat", bd=0,
                         highlightthickness=2, highlightbackground="#cccccc", cursor="hand2")
            b.pack(side="left", padx=2)
            b.bind("<Button-1>", lambda e, c=col: self.set_color(c))
            self.swatches[col] = b
        ttk.Button(right, text="More…", style="Bar.TButton", command=self.pick_color).pack(side="left", padx=(4, 16))
        ttk.Label(right, text="Text size").pack(side="left", padx=(0, 4))
        self.font_var = tk.StringVar(value="28")
        fs = ttk.Combobox(right, textvariable=self.font_var, values=FONT_SIZES, width=4, state="readonly")
        fs.pack(side="left", padx=(0, 10))
        fs.bind("<<ComboboxSelected>>", lambda e: self.editor.set_style(font_size=int(self.font_var.get())))
        ttk.Label(right, text="Line width").pack(side="left", padx=(0, 4))
        self.width_var = tk.StringVar(value="4")
        ws = ttk.Combobox(right, textvariable=self.width_var, values=WIDTHS, width=3, state="readonly")
        ws.pack(side="left", padx=(0, 10))
        ws.bind("<<ComboboxSelected>>", lambda e: self.editor.set_style(width=int(self.width_var.get())))

    def _build_body(self):
        body = ttk.Frame(self.root)
        body.pack(side="top", fill="both", expand=True)

        tools = ttk.Frame(body, padding=(6, 4))
        tools.pack(side="left", fill="y")
        self.tool_buttons = {}
        for tid, icon, key, tip in TOOLS:
            b = ttk.Button(tools, text=icon, style="Tool.TButton", command=lambda t=tid: self.set_tool(t))
            b.pack(side="top", pady=2)
            _Tooltip(b, tip)
            self.tool_buttons[tid] = b

        self.editor = Editor(body, on_change=self._on_doc_change, on_status=self.set_status)
        self.editor.pack(side="left", fill="both", expand=True)

        bottom = ttk.Frame(self.root)
        bottom.pack(side="bottom", fill="x")
        self.status = ttk.Label(bottom, text="Ready", padding=(8, 3), anchor="w")
        self.status.pack(side="bottom", fill="x")

        recent_wrap = ttk.Frame(self.root, padding=(6, 2))
        recent_wrap.pack(side="bottom", fill="x")
        hdr = ttk.Frame(recent_wrap)
        hdr.pack(fill="x")
        ttk.Label(hdr, text="Recent captures", font=("Segoe UI", 9, "bold")).pack(side="left")
        ttk.Button(hdr, text="Open folder", command=self.open_folder).pack(side="right")
        self.recent = tk.Canvas(recent_wrap, height=86, bg="#f0f0f0", highlightthickness=0)
        rs = ttk.Scrollbar(recent_wrap, orient="horizontal", command=self.recent.xview)
        self.recent.configure(xscrollcommand=rs.set)
        self.recent.pack(fill="x")
        rs.pack(fill="x")

        self.set_tool("arrow")
        self.set_color(SWATCHES[0])

    def _bind_keys(self):
        r = self.root
        ed = lambda: self.editor  # noqa: E731

        def guard(fn):
            def h(e):
                if self.editor.editing_text() or isinstance(e.widget, (tk.Entry, ttk.Entry, ttk.Combobox)):
                    return
                fn()
                return "break"
            return h

        r.bind(f"<{MOD}-n>", lambda e: self.capture_region())
        r.bind(f"<{MOD}-o>", lambda e: self.open_file())
        r.bind(f"<{MOD}-s>", lambda e: self.save())
        r.bind(f"<{MOD}-S>", lambda e: self.save_as())
        r.bind(f"<{MOD}-Shift-s>", lambda e: self.save_as())
        r.bind(f"<{MOD}-c>", guard(self.copy))
        r.bind(f"<{MOD}-v>", guard(self.paste))
        r.bind(f"<{MOD}-z>", guard(lambda: ed().undo()))
        r.bind(f"<{MOD}-y>", guard(lambda: ed().redo()))
        r.bind(f"<{MOD}-Z>", guard(lambda: ed().redo()))
        r.bind(f"<{MOD}-plus>", lambda e: ed().zoom_by(1.25))
        r.bind(f"<{MOD}-equal>", lambda e: ed().zoom_by(1.25))
        r.bind(f"<{MOD}-minus>", lambda e: ed().zoom_by(0.8))
        r.bind(f"<{MOD}-Key-0>", lambda e: ed().set_zoom(1.0))
        r.bind(f"<{MOD}-Key-9>", lambda e: ed().set_zoom(None))
        r.bind("<Delete>", guard(lambda: ed().delete_selected()))
        r.bind("<BackSpace>", guard(lambda: ed().delete_selected()))
        for keysym, (dx, dy) in {"Left": (-1, 0), "Right": (1, 0), "Up": (0, -1), "Down": (0, 1)}.items():
            r.bind(f"<{keysym}>", guard(lambda dx=dx, dy=dy: ed().nudge(dx, dy)))
            r.bind(f"<Shift-{keysym}>", guard(lambda dx=dx, dy=dy: ed().nudge(dx * 10, dy * 10)))
        for tid, _, key, _ in TOOLS:
            r.bind(f"<KeyPress-{key.lower()}>", guard(lambda t=tid: self.set_tool(t)))
        r.bind("<Escape>", guard(lambda: self.set_tool("select")))

    # ============================================================ state
    def set_status(self, text):
        self.status.configure(text=text)

    def set_tool(self, tool):
        self.editor.set_tool(tool)
        for tid, b in self.tool_buttons.items():
            b.configure(style="ToolOn.TButton" if tid == tool else "Tool.TButton")
        tip = next(t[3] for t in TOOLS if t[0] == tool)
        extra = {"line": " · Shift snaps to 45°", "arrow": " · Shift snaps to 45°",
                 "rect": " · Shift for a square", "ellipse": " · Shift for a circle",
                 "select": " · drag to move, Del to delete, double-click text to edit, arrows to nudge"}
        self.set_status(f"{tip}{extra.get(tool, '')}")

    def set_color(self, color):
        self.editor.set_style(color=color)
        for col, b in self.swatches.items():
            b.configure(highlightbackground="#29b6f6" if col == color else "#cccccc")

    def pick_color(self):
        c = colorchooser.askcolor(color=self.editor.color, parent=self.root)[1]
        if c:
            self.set_color(c)

    def _on_doc_change(self):
        name = os.path.basename(self.editor.path) if self.editor.path else "Untitled"
        star = "• " if self.editor.dirty else ""
        self.root.title(f"{star}{name} — {APP_NAME}")

    def _effect(self, fn):
        if not self.editor.has_image():
            return
        self.editor.replace_base(fn(self.editor.flattened()))

    # ========================================================== capture
    def _hide_for_capture(self):
        self.was_visible = self.root.state() != "withdrawn"
        self.root.withdraw()
        self.root.update()

    def _show_after_capture(self):
        self.root.deiconify()
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after(200, lambda: self.root.attributes("-topmost", False))
        self.root.focus_force()

    def _confirm_discard(self):
        """Ask before replacing an edited image. Returns False to abort."""
        if not self.editor.dirty or not self.editor.has_image():
            return True
        ans = messagebox.askyesnocancel(APP_NAME, "Save changes to the current image first?", parent=self.root)
        if ans is None:
            return False
        if ans:
            return self.save()
        return True

    def capture_region(self, title="Drag to select an area"):
        if self.busy:
            return
        self.busy = True
        self.editor._commit_text()
        self._hide_for_capture()

        def done(img, box):
            self.busy = False
            if img is not None:
                self.new_capture(img)
            elif self.was_visible:
                self._show_after_capture()

        self.root.after(220, lambda: self._safe(lambda: capture.select_region(self.root, done, title)))

    def capture_fullscreen(self):
        if self.busy:
            return
        self.busy = True
        self._hide_for_capture()

        def go():
            img, _ = capture.grab_virtual_screen()
            self.busy = False
            self.new_capture(img)
        self.root.after(250, lambda: self._safe(go))

    def capture_delayed(self):
        if self.busy:
            return
        secs = int(self.settings["delay_seconds"])
        self.busy = True
        self._hide_for_capture()
        toast = tk.Toplevel(self.root)
        toast.overrideredirect(True)
        toast.attributes("-topmost", True)
        toast.configure(bg="#202020")
        lbl = tk.Label(toast, fg="white", bg="#202020", font=("Segoe UI", 28, "bold"), padx=24, pady=10)
        lbl.pack()
        sw = toast.winfo_screenwidth()
        toast.geometry(f"+{sw - 160}+40")

        def tick(n):
            if n <= 0:
                toast.destroy()
                self.root.update()
                self.busy = False
                self.root.after(120, lambda: self.capture_region("Delayed capture — select an area"))
                return
            lbl.configure(text=str(n))
            self.root.after(1000, lambda: tick(n - 1))
        tick(secs)

    def record_gif(self):
        if self.busy:
            return
        self.busy = True
        self._hide_for_capture()

        def selected(img, box):
            if img is None:
                self.busy = False
                self._show_after_capture()
                return
            recorder.GifRecorder(self.root, box, self.settings["gif_fps"],
                                 self.settings["gif_max_seconds"], finished)

        def finished(frames, durations):
            self.busy = False
            self._show_after_capture()
            if not frames:
                self.set_status("Recording cancelled")
                return
            os.makedirs(self.settings["save_dir"], exist_ok=True)
            path = os.path.join(self.settings["save_dir"], time.strftime("Recording_%Y-%m-%d_%H-%M-%S.gif"))
            self.set_status(f"Saving GIF ({len(frames)} frames)…")
            self.root.update()

            def work():
                ok = recorder.save_gif(frames, durations, path)
                self.events.put(("gif_saved", path if ok else None))
            threading.Thread(target=work, daemon=True).start()

        self.root.after(220, lambda: self._safe(lambda: capture.select_region(
            self.root, selected, "Select the area to record")))

    def _safe(self, fn):
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            self.busy = False
            self._show_after_capture()
            messagebox.showerror(APP_NAME, f"Capture failed:\n{e}", parent=self.root)

    def new_capture(self, img):
        self._show_after_capture()
        if not self._confirm_discard():
            return
        path = None
        if self.settings["auto_save"]:
            path = self._auto_path()
            try:
                self._write(img, path)
            except OSError as e:
                messagebox.showerror(APP_NAME, f"Could not save capture:\n{e}", parent=self.root)
                path = None
        self.editor.load(img, path)
        msg = f"Captured {img.width} × {img.height}"
        if path:
            msg += f" → {path}"
        if self.settings["copy_to_clipboard"]:
            if platform_utils.copy_image_to_clipboard(img):
                msg += "  ·  copied to clipboard"
        self.set_status(msg)
        self.refresh_recent()

    def _auto_path(self):
        ext = "jpg" if self.settings["image_format"] == "jpg" else "png"
        os.makedirs(self.settings["save_dir"], exist_ok=True)
        base = time.strftime("Capture_%Y-%m-%d_%H-%M-%S")
        path = os.path.join(self.settings["save_dir"], f"{base}.{ext}")
        i = 2
        while os.path.exists(path):
            path = os.path.join(self.settings["save_dir"], f"{base}_{i}.{ext}")
            i += 1
        return path

    @staticmethod
    def _write(img, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in (".jpg", ".jpeg"):
            img.convert("RGB").save(path, quality=92)
        elif ext == ".bmp":
            img.convert("RGB").save(path)
        elif ext == ".webp":
            img.save(path, quality=92)
        else:
            img.save(path, optimize=True)

    # ============================================================= file
    def open_file(self, path=None):
        if not self._confirm_discard():
            return
        if path is None:
            path = filedialog.askopenfilename(
                parent=self.root, initialdir=self.settings["save_dir"],
                filetypes=[("Images", "*.png *.jpg *.jpeg *.bmp *.gif *.webp"), ("All files", "*.*")])
        if not path:
            return
        try:
            with Image.open(path) as im:
                img = im.convert("RGB")
        except Exception as e:  # noqa: BLE001
            messagebox.showerror(APP_NAME, f"Could not open image:\n{e}", parent=self.root)
            return
        self.editor.load(img, path)
        self.set_status(f"Opened {path}")

    def paste(self):
        try:
            data = ImageGrab.grabclipboard()
        except Exception:  # noqa: BLE001
            data = None
        if isinstance(data, list) and data:
            self.open_file(data[0])
            return
        if not isinstance(data, Image.Image):
            self.set_status("Clipboard has no image")
            return
        if self._confirm_discard():
            self.editor.load(data.convert("RGB"))
            self.set_status("Pasted image from clipboard")

    def save(self):
        if not self.editor.has_image():
            return False
        if not self.editor.path:
            return self.save_as()
        try:
            self._write(self.editor.flattened(), self.editor.path)
        except OSError as e:
            messagebox.showerror(APP_NAME, f"Could not save:\n{e}", parent=self.root)
            return False
        self.editor.dirty = False
        self._on_doc_change()
        self.set_status(f"Saved {self.editor.path}")
        self.refresh_recent()
        return True

    def save_as(self):
        if not self.editor.has_image():
            return False
        initial = os.path.basename(self.editor.path) if self.editor.path else time.strftime("Capture_%Y-%m-%d_%H-%M-%S.png")
        path = filedialog.asksaveasfilename(
            parent=self.root, initialdir=self.settings["save_dir"], initialfile=initial, defaultextension=".png",
            filetypes=[("PNG", "*.png"), ("JPEG", "*.jpg"), ("BMP", "*.bmp"), ("WebP", "*.webp")])
        if not path:
            return False
        self.editor.path = path
        return self.save()

    def copy(self):
        img = self.editor.flattened()
        if img is None:
            return
        ok = platform_utils.copy_image_to_clipboard(img)
        self.set_status("Copied image to clipboard" if ok else "Copy failed: no clipboard tool available")

    def open_folder(self):
        folder = self.settings["save_dir"]
        os.makedirs(folder, exist_ok=True)
        if sys.platform == "win32":
            os.startfile(folder)  # noqa: S606
        elif sys.platform == "darwin":
            subprocess.Popen(["open", folder])
        else:
            subprocess.Popen(["xdg-open", folder])

    # =========================================================== recent
    def refresh_recent(self):
        c = self.recent
        c.delete("all")
        self._thumbs = []
        folder = self.settings["save_dir"]
        try:
            files = [os.path.join(folder, f) for f in os.listdir(folder)
                     if f.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"))]
        except OSError:
            files = []
        files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
        x = 4
        for path in files[:30]:
            try:
                with Image.open(path) as im:
                    im.thumbnail((120, 70))
                    thumb = ImageTk.PhotoImage(im.convert("RGB"))
            except Exception:  # noqa: BLE001
                continue
            self._thumbs.append(thumb)
            tag = f"t{len(self._thumbs)}"
            c.create_rectangle(x, 4, x + 124, 78, fill="white", outline="#cccccc", tags=tag)
            c.create_image(x + 62, 41, image=thumb, tags=tag)
            if path.lower().endswith(".gif"):
                c.create_text(x + 118, 72, text="GIF", anchor="se", fill="#e53935",
                              font=("Segoe UI", 8, "bold"), tags=tag)
            c.tag_bind(tag, "<Button-1>", lambda e, p=path: self._open_recent(p))
            c.tag_bind(tag, "<Enter>", lambda e, p=path: (c.configure(cursor="hand2"), self.set_status(p)))
            c.tag_bind(tag, "<Leave>", lambda e: c.configure(cursor=""))
            x += 130
        if not self._thumbs:
            c.create_text(10, 40, anchor="w", fill="#888888", text=f"Captures are saved to {folder}")
        c.configure(scrollregion=(0, 0, max(x, 10), 82))

    def _open_recent(self, path):
        if path.lower().endswith(".gif"):
            if sys.platform == "win32":
                os.startfile(path)  # noqa: S606
            else:
                subprocess.Popen(["open" if IS_MAC else "xdg-open", path])
            return
        self.open_file(path)

    # ========================================================= settings
    def open_settings(self):
        SettingsDialog(self)

    def show_help(self):
        s = self.settings
        messagebox.showinfo(f"{APP_NAME} shortcuts", "\n".join([
            f"{s['hotkey_region']}  — capture region / window (global)",
            f"{s['hotkey_fullscreen']}  — capture full screen (global)",
            f"{s['hotkey_record']}  — record GIF (global)",
            "",
            "In the capture overlay: drag for an area, click a window, Enter = all screens, Esc = cancel",
            "",
            "V select · A arrow · L line · R rectangle · E ellipse · P pen",
            "H highlighter · T text · N step number · B blur · C crop",
            "Shift while drawing: snap angle / keep square",
            f"{MODL}Z undo · {MODL}Y redo · Del delete · arrows nudge",
            f"{MODL}S save · {MODL}⇧S save as · {MODL}C copy · {MODL}V paste",
            f"{MODL}wheel zoom · {MODL}0 actual size · {MODL}9 fit",
        ]), parent=self.root)

    # ==================================================== tray / hotkeys
    def _start_hotkeys(self):
        s = self.settings
        self.hotkeys.start({
            s["hotkey_region"]: lambda: self.events.put(("region",)),
            s["hotkey_fullscreen"]: lambda: self.events.put(("fullscreen",)),
            s["hotkey_record"]: lambda: self.events.put(("record",)),
        })

    def _report_hotkey_errors(self):
        if self.hotkeys.errors:
            msg = "Hotkey problem: " + "; ".join(self.hotkeys.errors)
            if any("PrintScreen" in e for e in self.hotkeys.errors) and platform_utils.IS_WIN:
                msg += " — turn off 'Use the Print screen key to open screen capture' in Windows Settings › Accessibility › Keyboard, or pick another key in Settings."
            if IS_MAC:
                msg += " — allow ShotMark in System Settings › Privacy & Security › Accessibility and Input Monitoring, then restart it."
            self.set_status(msg)

    def _start_tray(self):
        if IS_MAC:
            # pystray needs the macOS main thread, which Tk owns, so use the Dock instead:
            # clicking the Dock icon reopens the window and Cmd+Q quits.
            self.root.createcommand("::tk::mac::ReopenApplication", lambda *a: self._show_after_capture())
            self.root.createcommand("::tk::mac::Quit", lambda *a: self.quit())
            self.root.createcommand("::tk::mac::ShowPreferences", lambda *a: self.open_settings())
            return
        try:
            import pystray
        except Exception:  # noqa: BLE001 - missing package or no tray backend
            return
        menu = pystray.Menu(
            pystray.MenuItem("Open ShotMark", lambda: self.events.put(("show",)), default=True),
            pystray.MenuItem("Capture region", lambda: self.events.put(("region",))),
            pystray.MenuItem("Capture full screen", lambda: self.events.put(("fullscreen",))),
            pystray.MenuItem("Delayed capture", lambda: self.events.put(("delay",))),
            pystray.MenuItem("Record GIF", lambda: self.events.put(("record",))),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", lambda: self.events.put(("quit",))),
        )
        try:
            self.tray = pystray.Icon(APP_NAME, self.icon_image, APP_NAME, menu)
            self.tray.run_detached()
        except Exception:  # noqa: BLE001
            self.tray = None

    def _poll_events(self):
        try:
            while True:
                ev = self.events.get_nowait()
                kind = ev[0]
                if kind == "region":
                    self.capture_region()
                elif kind == "fullscreen":
                    self.capture_fullscreen()
                elif kind == "delay":
                    self.capture_delayed()
                elif kind == "record":
                    self.record_gif()
                elif kind == "show":
                    self._show_after_capture()
                elif kind == "quit":
                    self.quit()
                    return
                elif kind == "gif_saved":
                    path = ev[1]
                    if path:
                        self.set_status(f"Saved recording → {path}")
                        self.refresh_recent()
                    else:
                        self.set_status("Recording was empty")
        except queue.Empty:
            pass
        self.root.after(80, self._poll_events)

    def on_close(self):
        if IS_MAC and self.settings["minimize_to_tray"]:
            self.root.withdraw()  # stays in the Dock; hotkeys keep working
            return
        if self.tray and self.settings["minimize_to_tray"]:
            self.root.withdraw()
            if not getattr(self, "_tray_hint_shown", False):
                self._tray_hint_shown = True
                try:
                    self.tray.notify(f"{APP_NAME} is still running. Press {self.settings['hotkey_region']} to capture.",
                                     APP_NAME)
                except Exception:  # noqa: BLE001
                    pass
            return
        self.quit()

    def quit(self):
        self.root.deiconify()
        if not self._confirm_discard():
            return
        self.hotkeys.stop()
        if self.tray:
            try:
                self.tray.stop()
            except Exception:  # noqa: BLE001
                pass
        self.root.destroy()

    def run(self):
        self.root.mainloop()


class SettingsDialog:
    def __init__(self, app: App):
        self.app = app
        s = app.settings
        w = self.win = tk.Toplevel(app.root)
        w.title("Settings")
        w.transient(app.root)
        w.resizable(False, False)
        f = ttk.Frame(w, padding=16)
        f.pack(fill="both", expand=True)

        self.vars = {}
        row = 0

        def add_entry(key, label, width=32, browse=False):
            nonlocal row
            ttk.Label(f, text=label).grid(row=row, column=0, sticky="w", pady=4)
            v = tk.StringVar(value=str(s[key]))
            ttk.Entry(f, textvariable=v, width=width).grid(row=row, column=1, sticky="we", pady=4)
            if browse:
                ttk.Button(f, text="…", width=3, command=lambda: v.set(
                    filedialog.askdirectory(parent=w, initialdir=v.get()) or v.get())).grid(row=row, column=2, padx=4)
            self.vars[key] = v
            row += 1

        def add_check(key, label):
            nonlocal row
            v = tk.BooleanVar(value=bool(s[key]))
            ttk.Checkbutton(f, text=label, variable=v).grid(row=row, column=0, columnspan=3, sticky="w", pady=2)
            self.vars[key] = v
            row += 1

        add_entry("save_dir", "Save captures to", browse=True)
        ttk.Label(f, text="File format").grid(row=row, column=0, sticky="w", pady=4)
        fmt = tk.StringVar(value=s["image_format"])
        ttk.Combobox(f, textvariable=fmt, values=["png", "jpg"], state="readonly", width=6).grid(
            row=row, column=1, sticky="w")
        self.vars["image_format"] = fmt
        row += 1
        add_check("auto_save", "Save every capture automatically")
        add_check("copy_to_clipboard", "Copy every capture to the clipboard")
        add_check("minimize_to_tray", "Closing the window keeps ShotMark running in the "
                  + ("Dock" if IS_MAC else "tray"))
        ttk.Separator(f).grid(row=row, column=0, columnspan=3, sticky="we", pady=8)
        row += 1
        add_entry("hotkey_region", "Region hotkey", 20)
        add_entry("hotkey_fullscreen", "Full-screen hotkey", 20)
        add_entry("hotkey_record", "Record GIF hotkey", 20)
        ttk.Label(f, text=("e.g. Cmd+Shift+2, Ctrl+Option+S, F9" if IS_MAC else "e.g. PrintScreen, Ctrl+Shift+S, Alt+F9")
                  + " — takes effect after restart",
                  foreground="#777").grid(row=row, column=0, columnspan=3, sticky="w")
        row += 1
        ttk.Separator(f).grid(row=row, column=0, columnspan=3, sticky="we", pady=8)
        row += 1
        add_entry("delay_seconds", "Delay (seconds)", 6)
        add_entry("gif_fps", "GIF frames per second", 6)
        add_entry("gif_max_seconds", "GIF max length (seconds)", 6)

        btns = ttk.Frame(f)
        btns.grid(row=row, column=0, columnspan=3, sticky="e", pady=(12, 0))
        ttk.Button(btns, text="Cancel", command=w.destroy).pack(side="right")
        ttk.Button(btns, text="Save", command=self.save).pack(side="right", padx=6)
        w.grab_set()

    def save(self):
        s = self.app.settings
        new = {}
        for k, v in self.vars.items():
            val = v.get()
            if isinstance(s[k], bool):
                new[k] = bool(val)
            elif isinstance(s[k], int):
                try:
                    new[k] = max(1, int(val))
                except ValueError:
                    messagebox.showerror("Settings", f"{k} must be a number", parent=self.win)
                    return
            else:
                new[k] = val.strip()
        for k in ("hotkey_region", "hotkey_fullscreen", "hotkey_record"):
            try:
                (platform_utils.parse_mac_hotkey if IS_MAC else platform_utils.parse_hotkey)(new[k])
            except ValueError as e:
                messagebox.showerror("Settings", f"Hotkey '{new[k]}': {e}", parent=self.win)
                return
        s.update(new)
        try:
            s.save()
        except OSError as e:
            messagebox.showerror("Settings", f"Could not save settings:\n{e}", parent=self.win)
            return
        self.app.delay_btn.configure(text=f"⏱ Delay {s['delay_seconds']}s")
        self.app.refresh_recent()
        self.win.destroy()


class _Tooltip:
    def __init__(self, widget, text):
        self.widget, self.text, self.tip = widget, text, None
        widget.bind("<Enter>", self.show)
        widget.bind("<Leave>", self.hide)

    def show(self, _):
        x = self.widget.winfo_rootx() + self.widget.winfo_width() + 6
        y = self.widget.winfo_rooty() + 6
        self.tip = tk.Toplevel(self.widget)
        self.tip.overrideredirect(True)
        self.tip.geometry(f"+{x}+{y}")
        tk.Label(self.tip, text=self.text, bg="#ffffe0", relief="solid", bd=1, padx=6, pady=2).pack()

    def hide(self, _):
        if self.tip:
            self.tip.destroy()
            self.tip = None


def main():
    platform_utils.enable_dpi_awareness()
    App().run()
