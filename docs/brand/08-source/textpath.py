"""Turn short strings into SVG path outlines (no system fonts needed)."""
import pathlib
import re
from functools import lru_cache

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONTS = pathlib.Path("/home/claude/fonts")
CINZEL = {600: FONTS / "cinzel/files/cinzel-latin-600-normal.woff2",
          700: FONTS / "cinzel/files/cinzel-latin-700-normal.woff2"}


@lru_cache(None)
def _font(path):
    return TTFont(str(path))


@lru_cache(None)
def _noto_ranges(weight):
    css = (FONTS / f"notoserifsc/{weight}.css").read_text()
    out = []
    for block in re.findall(r"@font-face\s*{(.*?)}", css, re.S):
        url = re.search(r"url\(\./files/([^)]+?\.woff2)\)", block)
        ur = re.search(r"unicode-range:\s*([^;]+);", block)
        if not (url and ur):
            continue
        ranges = []
        for part in ur.group(1).split(","):
            part = part.strip().replace("U+", "")
            if "-" in part:
                a, b = part.split("-")
                ranges.append((int(a, 16), int(b, 16)))
            else:
                ranges.append((int(part, 16), int(part, 16)))
        out.append((FONTS / "notoserifsc/files" / url.group(1), ranges))
    return out


def _noto_font_for(ch, weight):
    cp = ord(ch)
    for path, ranges in _noto_ranges(weight):
        if any(a <= cp <= b for a, b in ranges):
            return _font(path)
    raise KeyError(ch)


def text_path(text, size, family="cinzel", weight=700, tracking=0.0):
    """Return (svg_path_d, width) for text set at `size` px, baseline at y=0."""
    pen_x = 0.0
    parts = []
    for ch in text:
        font = _font(CINZEL[weight]) if family == "cinzel" else _noto_font_for(ch, weight)
        upm = font["head"].unitsPerEm
        scale = size / upm
        cmap = font.getBestCmap()
        gname = cmap.get(ord(ch))
        gs = font.getGlyphSet()
        if gname is None:
            pen_x += size * 0.3
            continue
        svgpen = SVGPathPen(gs)
        tpen = TransformPen(svgpen, (scale, 0, 0, -scale, pen_x, 0))
        gs[gname].draw(tpen)
        d = svgpen.getCommands()
        if d:
            parts.append(d)
        pen_x += gs[gname].width * scale + tracking * size
    return " ".join(parts), pen_x - tracking * size
