"""Whole-image effects."""
from PIL import Image, ImageDraw, ImageFilter, ImageOps


def border(img, width=4, color="#404040"):
    return ImageOps.expand(img, border=width, fill=color)


def drop_shadow(img, offset=10, blur=14, background="#ffffff", shadow="#00000077"):
    pad = blur * 2 + offset
    w, h = img.size
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), background)
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((pad + offset, pad + offset, pad + offset + w, pad + offset + h), fill=shadow)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(sh)
    canvas.paste(img, (pad, pad))
    return canvas.convert("RGB")


def rounded(img, radius=16, background="#ffffff"):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius=radius, fill=255)
    out = Image.new("RGB", img.size, background)
    out.paste(img, (0, 0), mask)
    return out


def torn_edge(img, background="#ffffff", depth=10, step=14):
    """Jagged bottom edge, like a page torn off."""
    import random
    rnd = random.Random(img.width * 31 + img.height)
    w, h = img.size
    pts = [(0, 0), (w, 0), (w, h - depth)]
    x = w
    while x > 0:
        x = max(0, x - rnd.randint(step // 2, step))
        pts.append((x, h - rnd.randint(0, depth)))
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    out = Image.new("RGB", img.size, background)
    out.paste(img, (0, 0), mask)
    return out
