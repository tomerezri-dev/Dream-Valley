"""The image editor canvas: tools, selection, undo/redo, zoom."""
from __future__ import annotations

import sys
import tkinter as tk
from tkinter import ttk

from PIL import Image, ImageTk

from annotations import Shape, render, step_radius

TOOLS = [
    # id, label, shortcut, tooltip
    ("select", "⬚", "V", "Select / move (V)"),
    ("arrow", "➜", "A", "Arrow (A)"),
    ("line", "╱", "L", "Line (L)"),
    ("rect", "▭", "R", "Rectangle (R)"),
    ("ellipse", "◯", "E", "Ellipse (E)"),
    ("pen", "✎", "P", "Pen (P)"),
    ("highlight", "▬", "H", "Highlighter (H)"),
    ("text", "T", "T", "Text (T)"),
    ("step", "①", "N", "Step number (N)"),
    ("blur", "▦", "B", "Blur / pixelate (B)"),
    ("crop", "⌗", "C", "Crop (C)"),
]


class Editor(ttk.Frame):
    def __init__(self, master, on_change=None, on_status=None):
        super().__init__(master)
        self.on_change = on_change or (lambda: None)
        self.on_status = on_status or (lambda text: None)

        self.base: Image.Image | None = None
        self.shapes: list[Shape] = []
        self.path = None
        self.dirty = False
        self.undo_stack, self.redo_stack = [], []
        self.zoom = 1.0
        self.fit_mode = True
        self.tool = "arrow"
        self.color = "#e53935"
        self.width = 4
        self.font_size = 28
        self.selected: Shape | None = None

        self._composite = None
        self._tk_img = None
        self._drag = None
        self._preview = None
        self._text_entry = None
        self._render_pending = False
        self._offset = (0, 0)

        self.canvas = tk.Canvas(self, bg="#2b2b2b", highlightthickness=0, bd=0)
        hs = ttk.Scrollbar(self, orient="horizontal", command=self.canvas.xview)
        vs = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(xscrollcommand=hs.set, yscrollcommand=vs.set)
        self.canvas.grid(row=0, column=0, sticky="nsew")
        vs.grid(row=0, column=1, sticky="ns")
        hs.grid(row=1, column=0, sticky="ew")
        self.rowconfigure(0, weight=1)
        self.columnconfigure(0, weight=1)

        c = self.canvas
        c.bind("<Configure>", lambda e: self._layout())
        c.bind("<ButtonPress-1>", self._press)
        c.bind("<B1-Motion>", self._motion)
        c.bind("<ButtonRelease-1>", self._release)
        c.bind("<Double-Button-1>", self._double)
        c.bind("<Control-MouseWheel>", self._wheel_zoom)
        c.bind("<Command-MouseWheel>" if sys.platform == "darwin" else "<Alt-MouseWheel>", self._wheel_zoom)
        c.bind("<MouseWheel>", lambda e: c.yview_scroll(-1 if e.delta > 0 else 1, "units"))
        c.bind("<Shift-MouseWheel>", lambda e: c.xview_scroll(-1 if e.delta > 0 else 1, "units"))
        c.bind("<Control-Button-4>", lambda e: self.zoom_by(1.25))
        c.bind("<Control-Button-5>", lambda e: self.zoom_by(0.8))
        c.bind("<Button-4>", lambda e: c.yview_scroll(-1, "units"))
        c.bind("<Button-5>", lambda e: c.yview_scroll(1, "units"))
        self._draw_empty()

    # ---- document ------------------------------------------------------
    def load(self, image: Image.Image, path=None):
        self._cancel_text()
        self.base = image.convert("RGB")
        self.shapes = []
        self.path = path
        self.dirty = False
        self.selected = None
        self.undo_stack.clear()
        self.redo_stack.clear()
        self.fit_mode = True
        self._layout()
        self.on_change()

    def has_image(self):
        return self.base is not None

    def flattened(self) -> Image.Image | None:
        self._commit_text()
        if self.base is None:
            return None
        return render(self.base, self.shapes)

    def _snapshot(self):
        self.undo_stack.append((self.base, list(self.shapes)))
        if len(self.undo_stack) > 100:
            self.undo_stack.pop(0)
        self.redo_stack.clear()

    def _changed(self, full_layout=False):
        self.dirty = True
        if full_layout:
            self._layout()
        else:
            self.request_render()
        self.on_change()

    def undo(self):
        self._commit_text()
        if not self.undo_stack:
            return
        self.redo_stack.append((self.base, list(self.shapes)))
        old_size = self.base.size
        self.base, self.shapes = self.undo_stack.pop()
        self.selected = None
        self._changed(full_layout=self.base.size != old_size)

    def redo(self):
        if not self.redo_stack:
            return
        self.undo_stack.append((self.base, list(self.shapes)))
        old_size = self.base.size
        self.base, self.shapes = self.redo_stack.pop()
        self.selected = None
        self._changed(full_layout=self.base.size != old_size)

    def replace_base(self, new_base, keep_shapes=False):
        """Apply an image-level operation (effects, rotate, resize) undoably."""
        if self.base is None:
            return
        self._commit_text()
        self._snapshot()
        self.base = new_base.convert("RGB")
        if not keep_shapes:
            self.shapes = []
        self.selected = None
        self._changed(full_layout=True)

    def delete_selected(self):
        if self.selected in self.shapes:
            self._snapshot()
            self.shapes.remove(self.selected)
            self.selected = None
            self._changed()

    def nudge(self, dx, dy):
        if self.selected in self.shapes:
            self._snapshot()
            self._replace_selected(self.selected.moved(dx, dy))
            self._changed()

    def _replace_selected(self, new):
        i = self.shapes.index(self.selected)
        self.shapes[i] = new
        self.selected = new

    def set_style(self, color=None, width=None, font_size=None):
        if color:
            self.color = color
        if width:
            self.width = width
        if font_size:
            self.font_size = font_size
        if self.selected in self.shapes:
            import copy
            s = copy.deepcopy(self.selected)
            if color:
                s.color = color
            if width and s.kind not in ("text", "step", "blur"):
                s.width = width
            if font_size and s.kind in ("text", "step"):
                s.font_size = font_size
            self._snapshot()
            self._replace_selected(s)
            self._changed()

    def set_tool(self, tool):
        self._commit_text()
        self.tool = tool
        if tool != "select":
            self.selected = None
            self.request_render()
        self.canvas.configure(cursor="arrow" if tool == "select" else "tcross")

    # ---- zoom / layout -------------------------------------------------
    def zoom_by(self, factor):
        if self.base is None:
            return
        self.fit_mode = False
        self.zoom = max(0.05, min(8.0, self.zoom * factor))
        self._layout()

    def set_zoom(self, z=None):
        """z=None means fit to window."""
        self.fit_mode = z is None
        if z:
            self.zoom = z
        self._layout()

    def _wheel_zoom(self, e):
        self.zoom_by(1.25 if e.delta > 0 else 0.8)

    def _layout(self):
        if self.base is None:
            self._draw_empty()
            return
        cw = max(50, self.canvas.winfo_width())
        ch = max(50, self.canvas.winfo_height())
        iw, ih = self.base.size
        if self.fit_mode:
            self.zoom = min(1.0, (cw - 40) / iw, (ch - 40) / ih)
            self.zoom = max(self.zoom, 0.05)
        dw, dh = int(iw * self.zoom), int(ih * self.zoom)
        ox = max(20, (cw - dw) // 2)
        oy = max(20, (ch - dh) // 2)
        self._offset = (ox, oy)
        self.canvas.configure(scrollregion=(0, 0, max(cw, dw + 2 * ox), max(ch, dh + 2 * oy)))
        self.request_render(now=True)
        self.on_status(f"{iw} × {ih} px   ·   {int(self.zoom * 100)}%")

    def _draw_empty(self):
        c = self.canvas
        c.delete("all")
        w, h = max(c.winfo_width(), 600), max(c.winfo_height(), 400)
        c.configure(scrollregion=(0, 0, w, h))
        c.create_text(w / 2, h / 2 - 30, text="No capture yet", fill="#bbbbbb", font=("Segoe UI", 20, "bold"))
        c.create_text(w / 2, h / 2 + 14, fill="#888888", font=("Segoe UI", 11), justify="center",
                      text="Press Print Screen (or click Capture) to grab part of your screen.\n"
                           "Ctrl+V pastes an image · Ctrl+O opens a file")

    def request_render(self, now=False):
        if now:
            self._render()
        elif not self._render_pending:
            self._render_pending = True
            self.after_idle(self._render)

    def _render(self, composite=None):
        self._render_pending = False
        if self.base is None:
            return
        if composite is None:
            composite = render(self.base, self.shapes)
        self._composite = composite
        iw, ih = composite.size
        dw, dh = max(1, int(iw * self.zoom)), max(1, int(ih * self.zoom))
        shown = composite if (dw, dh) == (iw, ih) else composite.resize(
            (dw, dh), Image.LANCZOS if self.zoom < 1 else Image.NEAREST)
        self._tk_img = ImageTk.PhotoImage(shown)
        c = self.canvas
        c.delete("doc")
        ox, oy = self._offset
        if not c.find_withtag("img"):
            c.delete("all")
            c.create_rectangle(ox + 4, oy + 4, ox + dw + 4, oy + dh + 4, fill="#1a1a1a", outline="", tags="shadow")
            c.create_image(ox, oy, image=self._tk_img, anchor="nw", tags="img")
        else:
            c.coords("shadow", ox + 4, oy + 4, ox + dw + 4, oy + dh + 4)
            c.coords("img", ox, oy)
            c.itemconfigure("img", image=self._tk_img)
        if self.selected in self.shapes:
            x0, y0, x1, y1 = self.selected.bbox()
            a, b = self.to_canvas(x0, y0), self.to_canvas(x1, y1)
            c.create_rectangle(a[0] - 3, a[1] - 3, b[0] + 3, b[1] + 3, outline="#29b6f6", dash=(4, 3),
                               width=1, tags="doc")
        if self._preview is not None:
            for item in self._preview if isinstance(self._preview, list) else [self._preview]:
                c.tag_raise(item)

    # ---- coordinates ---------------------------------------------------
    def to_image(self, e):
        x = (self.canvas.canvasx(e.x) - self._offset[0]) / self.zoom
        y = (self.canvas.canvasy(e.y) - self._offset[1]) / self.zoom
        return x, y

    def to_canvas(self, x, y):
        return x * self.zoom + self._offset[0], y * self.zoom + self._offset[1]

    def _clamp(self, p):
        w, h = self.base.size
        return (min(max(p[0], 0), w), min(max(p[1], 0), h))

    # ---- mouse ---------------------------------------------------------
    def _press(self, e):
        if self.base is None:
            return
        self.canvas.focus_set()
        if self._text_entry is not None:
            self._commit_text()
            return
        p = self.to_image(e)
        t = self.tool
        if t == "select":
            hit = next((s for s in reversed(self.shapes) if s.hit(*p, tol=6 / self.zoom)), None)
            self.selected = hit
            if hit:
                under = render(self.base, self.shapes, skip=hit)
                self._drag = {"start": p, "orig": hit, "under": under, "moved": False}
            self.request_render()
            return
        if t == "step":
            n = max([s.number for s in self.shapes if s.kind == "step"], default=0) + 1
            self._snapshot()
            self.shapes.append(Shape("step", [p], self.color, self.width, number=n, font_size=self.font_size))
            self._changed()
            return
        if t == "text":
            self._start_text(p)
            return
        self._drag = {"start": p, "points": [p]}
        self._make_preview()

    def _motion(self, e):
        if not self._drag or self.base is None:
            return
        p = self.to_image(e)
        if self.tool == "select":
            d = self._drag
            dx, dy = p[0] - d["start"][0], p[1] - d["start"][1]
            moved = d["orig"].moved(dx, dy)
            if not d["moved"]:
                self._snapshot()
                d["moved"] = True
            self._replace_selected(moved)
            if not self._render_pending:
                self._render_pending = True

                def draw():
                    comp = render(d["under"], [self.selected])
                    self._render(comp)
                self.after_idle(draw)
            return
        if e.state & 0x0001 and self.tool in ("line", "arrow"):  # Shift: snap to 45°
            p = _snap45(self._drag["start"], p)
        elif e.state & 0x0001 and self.tool in ("rect", "ellipse", "blur", "crop"):  # Shift: square
            p = _square(self._drag["start"], p)
        if self.tool in ("pen", "highlight"):
            self._drag["points"].append(p)
        else:
            self._drag["points"] = [self._drag["start"], p]
        self._update_preview()

    def _release(self, e):
        d, self._drag = self._drag, None
        if not d or self.base is None:
            return
        if self.tool == "select":
            if d.get("moved"):
                self._changed()
            return
        self._clear_preview()
        pts = d["points"]
        if len(pts) < 2:
            if self.tool in ("pen", "highlight"):
                pts = [pts[0], (pts[0][0] + 0.1, pts[0][1])]
            else:
                return
        a, b = pts[0], pts[-1]
        tiny = abs(a[0] - b[0]) < 3 and abs(a[1] - b[1]) < 3
        if tiny and self.tool not in ("pen", "highlight"):
            return
        if self.tool == "crop":
            x0, y0 = self._clamp((min(a[0], b[0]), min(a[1], b[1])))
            x1, y1 = self._clamp((max(a[0], b[0]), max(a[1], b[1])))
            box = (int(x0), int(y0), int(round(x1)), int(round(y1)))
            if box[2] - box[0] < 2 or box[3] - box[1] < 2:
                return
            self._snapshot()
            self.base = self.base.crop(box)
            self.shapes = [s.moved(-box[0], -box[1]) for s in self.shapes]
            self.selected = None
            self._changed(full_layout=True)
            return
        self._snapshot()
        shape = Shape(self.tool, pts, self.color, self.width, font_size=self.font_size)
        self.shapes.append(shape)
        self._changed()

    def _double(self, e):
        if self.tool != "select" or self.base is None:
            return
        p = self.to_image(e)
        hit = next((s for s in reversed(self.shapes) if s.kind == "text" and s.hit(*p)), None)
        if hit:
            self._drag = None
            self._start_text(hit.points[0], editing=hit)

    # ---- live preview while drawing -----------------------------------
    def _make_preview(self):
        c = self.canvas
        w = max(1, self.width * self.zoom)
        col = self.color
        t = self.tool
        if t in ("rect",):
            self._preview = c.create_rectangle(0, 0, 0, 0, outline=col, width=w)
        elif t == "blur":
            self._preview = c.create_rectangle(0, 0, 0, 0, outline="#ffffff", dash=(4, 3), width=1)
        elif t == "crop":
            self._preview = c.create_rectangle(0, 0, 0, 0, outline="#29b6f6", dash=(6, 3), width=2)
        elif t == "ellipse":
            self._preview = c.create_oval(0, 0, 0, 0, outline=col, width=w)
        elif t in ("line", "arrow"):
            kw = {}
            if t == "arrow":
                hl = max(14, self.width * 4) * self.zoom
                kw = {"arrow": "last", "arrowshape": (hl, hl, hl * 0.45)}
            self._preview = c.create_line(0, 0, 0, 0, fill=col, width=w, capstyle="round", **kw)
        elif t in ("pen", "highlight"):
            if t == "highlight":
                w *= 3
            self._preview = c.create_line(0, 0, 0, 0, fill=col, width=w, capstyle="round",
                                          joinstyle="round", smooth=True)
        self._update_preview()

    def _update_preview(self):
        if self._preview is None or not self._drag:
            return
        pts = [self.to_canvas(*p) for p in self._drag["points"]]
        if len(pts) == 1:
            pts = pts * 2
        flat = [v for p in (pts if self.tool in ("pen", "highlight") else (pts[0], pts[-1])) for v in p]
        self.canvas.coords(self._preview, *flat)

    def _clear_preview(self):
        if self._preview is not None:
            self.canvas.delete(self._preview)
            self._preview = None

    # ---- text ----------------------------------------------------------
    def _start_text(self, p, editing=None):
        self._commit_text()
        cx, cy = self.to_canvas(*p)
        size = editing.font_size if editing else self.font_size
        color = editing.color if editing else self.color
        entry = tk.Entry(self.canvas, font=("Segoe UI", -max(8, int(size * self.zoom)), "bold"), fg=color,
                         bg="#ffffff", insertbackground=color, relief="solid", bd=1, width=24)
        if editing:
            entry.insert(0, editing.text)
            self.selected = None
        win = self.canvas.create_window(cx, cy, window=entry, anchor="nw")
        self._text_entry = (entry, win, p, editing)
        entry.focus_set()
        entry.bind("<Return>", lambda e: self._commit_text())
        entry.bind("<Escape>", lambda e: self._cancel_text())
        self.on_status("Type your text, Enter to place it, Esc to cancel")

    def _commit_text(self):
        if self._text_entry is None:
            return
        entry, win, p, editing = self._text_entry
        text = entry.get().strip()
        self._text_entry = None
        self.canvas.delete(win)
        entry.destroy()
        if editing is not None:
            if text == editing.text:
                return
            self._snapshot()
            i = self.shapes.index(editing)
            if text:
                import copy
                s = copy.deepcopy(editing)
                s.text = text
                self.shapes[i] = s
            else:
                self.shapes.pop(i)
            self._changed()
        elif text:
            self._snapshot()
            self.shapes.append(Shape("text", [p], self.color, self.width, text=text, font_size=self.font_size))
            self._changed()

    def _cancel_text(self):
        if self._text_entry is None:
            return
        entry, win, _, _ = self._text_entry
        self._text_entry = None
        self.canvas.delete(win)
        entry.destroy()

    def editing_text(self):
        return self._text_entry is not None


def _snap45(a, b):
    import math
    dx, dy = b[0] - a[0], b[1] - a[1]
    ang = round(math.atan2(dy, dx) / (math.pi / 4)) * (math.pi / 4)
    r = math.hypot(dx, dy)
    return (a[0] + r * math.cos(ang), a[1] + r * math.sin(ang))


def _square(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    s = max(abs(dx), abs(dy))
    return (a[0] + s * (1 if dx >= 0 else -1), a[1] + s * (1 if dy >= 0 else -1))


__all__ = ["Editor", "TOOLS", "step_radius"]
