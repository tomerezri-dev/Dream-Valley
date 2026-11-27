"""Annotation shapes and the renderer that flattens them onto an image.

Everything here is pure Pillow so the same code drives both the on-screen
preview and the exported file, which keeps what you see and what you save
identical.
"""
from __future__ import annotations

import copy
import math
import os
from dataclasses import dataclass, field

from PIL import Image, ImageDraw, ImageFont

SUPERSAMPLE = 3  # local supersampling factor for anti-aliased vector shapes

KINDS = ("arrow", "line", "rect", "ellipse", "pen", "highlight", "text", "step", "blur")


@dataclass
class Shape:
    kind: str
    points: list = field(default_factory=list)  # [(x, y), ...] in image coords
    color: str = "#e53935"
    width: int = 4
    text: str = ""
    number: int = 0
    font_size: int = 28

    # ---- geometry -------------------------------------------------------
    def bbox(self):
        xs = [p[0] for p in self.points]
        ys = [p[1] for p in self.points]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
        if self.kind == "text":
            w, h = text_size(self.text, self.font_size)
            return (x0, y0, x0 + w, y0 + h)
        if self.kind == "step":
            r = step_radius(self.font_size)
            return (x0 - r, y0 - r, x0 + r, y0 + r)
        pad = self.width * (2.5 if self.kind in ("arrow", "highlight") else 1)
        return (x0 - pad, y0 - pad, x1 + pad, y1 + pad)

    def moved(self, dx, dy):
        s = copy.deepcopy(self)
        s.points = [(x + dx, y + dy) for x, y in self.points]
        return s

    def hit(self, x, y, tol=6):
        if self.kind in ("arrow", "line"):
            (ax, ay), (bx, by) = self.points[0], self.points[-1]
            return _seg_dist(x, y, ax, ay, bx, by) <= self.width + tol
        if self.kind in ("pen", "highlight"):
            w = self.width * (3 if self.kind == "highlight" else 1)
            pts = self.points
            if len(pts) == 1:
                return math.hypot(x - pts[0][0], y - pts[0][1]) <= w + tol
            return any(
                _seg_dist(x, y, *pts[i], *pts[i + 1]) <= w + tol
                for i in range(len(pts) - 1)
            )
        if self.kind == "rect":
            x0, y0, x1, y1 = _norm(self.points[0], self.points[-1])
            inside_outer = x0 - tol <= x <= x1 + tol and y0 - tol <= y <= y1 + tol
            inside_inner = x0 + tol + self.width < x < x1 - tol - self.width and \
                y0 + tol + self.width < y < y1 - tol - self.width
            return inside_outer and not inside_inner
        if self.kind == "ellipse":
            x0, y0, x1, y1 = _norm(self.points[0], self.points[-1])
            cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, max((x1 - x0) / 2, 1), max((y1 - y0) / 2, 1)
            d = math.hypot((x - cx) / rx, (y - cy) / ry)
            band = (self.width + tol) / min(rx, ry)
            return abs(d - 1) <= band
        x0, y0, x1, y1 = self.bbox()
        return x0 - tol <= x <= x1 + tol and y0 - tol <= y <= y1 + tol


def _norm(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))


def _seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


# ---- fonts --------------------------------------------------------------
_FONT_CACHE: dict = {}
_FONT_CANDIDATES = (
    "segoeuib.ttf", "arialbd.ttf", "Arial Bold.ttf",
    "DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf",
)
_FONT_DIRS = (
    os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts"),
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/truetype/liberation",
    "/Library/Fonts", "/System/Library/Fonts/Supplemental",
)


def get_font(size: int):
    size = max(6, int(size))
    if size in _FONT_CACHE:
        return _FONT_CACHE[size]
    font = None
    for name in _FONT_CANDIDATES:
        for path in [name] + [os.path.join(d, name) for d in _FONT_DIRS]:
            try:
                font = ImageFont.truetype(path, size)
                break
            except OSError:
                continue
        if font:
            break
    if font is None:
        try:
            font = ImageFont.load_default(size)
        except TypeError:  # very old Pillow
            font = ImageFont.load_default()
    _FONT_CACHE[size] = font
    return font


def text_size(text, size):
    font = get_font(size)
    stroke = stroke_for(size)
    img = Image.new("L", (1, 1))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = d.multiline_textbbox((0, 0), text or " ", font=font, stroke_width=stroke, spacing=4)
    return (x1 + stroke, y1 + stroke)


def stroke_for(size):
    return max(1, round(size / 12))


def step_radius(size):
    return int(size * 0.85)


def _contrast(color_hex):
    r, g, b = Image.new("RGB", (1, 1), color_hex).getpixel((0, 0))
    return "#000000" if (0.299 * r + 0.587 * g + 0.114 * b) > 160 else "#ffffff"


# ---- rendering ----------------------------------------------------------
def render(base: Image.Image, shapes, skip=None) -> Image.Image:
    """Return a new RGB image of `base` with every shape drawn in order."""
    out = base.convert("RGBA")
    for s in shapes:
        if s is skip:
            continue
        _draw_shape(out, s)
    return out.convert("RGB")


def _aa_layer(img, bbox, draw_fn):
    """Draw `draw_fn` into a supersampled RGBA tile covering bbox, then composite."""
    W, H = img.size
    x0, y0, x1, y1 = (int(math.floor(bbox[0])) - 2, int(math.floor(bbox[1])) - 2,
                      int(math.ceil(bbox[2])) + 2, int(math.ceil(bbox[3])) + 2)
    cx0, cy0, cx1, cy1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    ss = SUPERSAMPLE
    tile = Image.new("RGBA", ((cx1 - cx0) * ss, (cy1 - cy0) * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)

    def tx(p):
        return ((p[0] - cx0) * ss, (p[1] - cy0) * ss)

    draw_fn(d, tx, ss)
    tile = tile.resize((cx1 - cx0, cy1 - cy0), Image.LANCZOS)
    img.alpha_composite(tile, (cx0, cy0))


def _arrow_geometry(a, b, width):
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    length = math.hypot(b[0] - a[0], b[1] - a[1])
    head = min(max(14, width * 4), length * 0.6 if length else 14)
    spread = math.radians(26)
    left = (b[0] - head * math.cos(ang - spread), b[1] - head * math.sin(ang - spread))
    right = (b[0] - head * math.cos(ang + spread), b[1] - head * math.sin(ang + spread))
    back = head * math.cos(spread) * 0.85
    shaft_end = (b[0] - back * math.cos(ang), b[1] - back * math.sin(ang))
    return shaft_end, [b, left, right]


def _draw_shape(img, s: Shape):
    k = s.kind
    pts = s.points
    if not pts:
        return
    if k == "blur":
        x0, y0, x1, y1 = [int(v) for v in _norm(pts[0], pts[-1])]
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(img.width, x1), min(img.height, y1)
        if x1 - x0 < 2 or y1 - y0 < 2:
            return
        region = img.crop((x0, y0, x1, y1))
        block = max(6, min(x1 - x0, y1 - y0) // 10, 10)
        small = region.resize((max(1, (x1 - x0) // block), max(1, (y1 - y0) // block)), Image.BILINEAR)
        img.paste(small.resize(region.size, Image.NEAREST), (x0, y0))
        return

    if k == "text":
        d = ImageDraw.Draw(img)
        d.multiline_text(pts[0], s.text, fill=s.color, font=get_font(s.font_size),
                         stroke_width=stroke_for(s.font_size), stroke_fill=_contrast(s.color), spacing=4)
        return

    if k == "highlight":
        W, H = img.size
        x0, y0, x1, y1 = [int(v) for v in s.bbox()]
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1 + 1), min(H, y1 + 1)
        if x1 <= x0 or y1 <= y0:
            return
        ss = SUPERSAMPLE
        mask = Image.new("L", ((x1 - x0) * ss, (y1 - y0) * ss), 0)
        d = ImageDraw.Draw(mask)
        w = s.width * 3 * ss
        sp = [((x - x0) * ss, (y - y0) * ss) for x, y in pts]
        if len(sp) > 1:
            d.line(sp, fill=255, width=int(w), joint="curve")
        for p in (sp[0], sp[-1]):
            d.ellipse((p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2), fill=255)
        mask = mask.resize((x1 - x0, y1 - y0), Image.LANCZOS).point(lambda v: v * 110 // 255)
        layer = Image.new("RGBA", mask.size, s.color)
        layer.putalpha(mask)
        img.alpha_composite(layer, (x0, y0))
        return

    color = s.color

    def fn(d, tx, ss):
        w = max(1, int(s.width * ss))
        if k == "rect":
            x0, y0, x1, y1 = _norm(tx(pts[0]), tx(pts[-1]))
            d.rounded_rectangle((x0, y0, x1, y1), radius=w, outline=color, width=w)
        elif k == "ellipse":
            d.ellipse(_norm(tx(pts[0]), tx(pts[-1])), outline=color, width=w)
        elif k == "line":
            a, b = tx(pts[0]), tx(pts[-1])
            d.line([a, b], fill=color, width=w)
            for p in (a, b):
                d.ellipse((p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2), fill=color)
        elif k == "arrow":
            a, b = tx(pts[0]), tx(pts[-1])
            shaft_end, head = _arrow_geometry(a, b, w)
            d.line([a, shaft_end], fill=color, width=w)
            d.ellipse((a[0] - w / 2, a[1] - w / 2, a[0] + w / 2, a[1] + w / 2), fill=color)
            d.polygon(head, fill=color)
        elif k == "pen":
            sp = [tx(p) for p in pts]
            if len(sp) > 1:
                d.line(sp, fill=color, width=w, joint="curve")
            for p in (sp[0], sp[-1]):
                d.ellipse((p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2), fill=color)
        elif k == "step":
            r = step_radius(s.font_size) * ss
            c = tx(pts[0])
            d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=color,
                      outline=_contrast(color), width=max(1, ss * 2))
            font = get_font(s.font_size * ss)
            d.text(c, str(s.number), fill=_contrast(color), font=font, anchor="mm")

    _aa_layer(img, s.bbox(), fn)
