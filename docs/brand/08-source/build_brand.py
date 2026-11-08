"""Build the Holdem Knight brand hand-off folder (round 3: E4 app icon + D5 emblem)."""
import json
import pathlib
import shutil
import subprocess

import icons as I
from textpath import text_path

OUT = pathlib.Path("/home/claude/brand/holdem-knight-brand")
if OUT.exists():
    shutil.rmtree(OUT)

BONE, GOLD, GOLD_DEEP = I.BONE, I.GOLD, I.GOLD_DEEP
F950, F900, F800, F700 = I.FELT950, I.FELT900, I.FELT800, I.FELT700
INK, MUTED_L, MUTED_D = "#0e1b16", "#5b6b64", "#b9c7c0"


def svg(viewbox, body, w=None, h=None, title=None):
    vb = viewbox.split()
    w = w or vb[2]
    h = h or vb[3]
    t = f"<title>{title}</title>" if title else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" width="{w}" height="{h}">'
            f"{t}{body}</svg>\n")


def write(rel, text):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)
    return p


def png(src, rel, w, h=None, bg=None):
    dst = OUT / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["rsvg-convert", "-w", str(w), "-h", str(h or w), str(src), "-o", str(dst)]
    if bg:
        cmd[1:1] = ["-b", bg]
    subprocess.run(cmd, check=True)
    return dst


# ---------- artwork pieces (all in a 512 box) ----------
def e4_content():
    face = I.glyph_k(-86, -270, 60, BONE) + I.knight_bust(-86, -200, 176, BONE, F700, GOLD)
    return I._back_k() + I._green_front(face)


def full_bleed(fill):
    return f'<rect width="512" height="512" fill="{fill}"/>'


def rounded(fill):
    return f'<rect width="512" height="512" rx="112" fill="{fill}"/>'


def scaled(body, s):
    return f'<g transform="translate(256 256) scale({s}) translate(-256 -256)">{body}</g>'


EMBLEM_VB = "80 46 352 424"  # crops the shield with its stroke


def emblem_colour():
    return I.SHIELD_INNER + I.crown(206, 112, 100, GOLD, F700) + I.kdk(cx=256, cy=290, scale=0.62)


def emblem_mono(c):
    return (f'<path d="{I.SHIELD_D}" fill="none" stroke="{c}" stroke-width="12" stroke-linejoin="round"/>'
            + I.crown(206, 112, 100, c, "none")
            + I.kdk(cx=256, cy=290, scale=0.62, stem_fill=c, diamond_fill="none"))


MARK_VB = "104 112 304 288"


def mark(stem=BONE, dia=GOLD):
    return I.kdk(stem_fill=stem, diamond_fill=dia, stem=44, stroke=32)


# ---------- wordmarks ----------
def wm_en(size):
    return text_path("Hold’em Knight", size, "cinzel", 700, 0.02)


def wm_zh_parts(size):
    a, wa = text_path("有局", size, "noto", 600, 0.08)
    dot, wd = text_path("·", size, "noto", 600, 0)
    b, wb = text_path("德州账本", size, "noto", 600, 0.08)
    gap = size * 0.35
    return [(a, 0), (dot, wa + gap), (b, wa + gap + wd + gap)], wa + wd + wb + 2 * gap


def zh_group(size, x, y, main, dotc):
    parts, width = wm_zh_parts(size)
    out = "".join(
        f'<path transform="translate({x + dx:.2f} {y})" d="{d}" fill="{dotc if i == 1 else main}"/>'
        for i, (d, dx) in enumerate(parts)
    )
    return out, width


def wordmark_stack(en_size, theme):
    en_c, zh_c, dot_c = (INK, MUTED_L, GOLD_DEEP) if theme == "light" else (BONE, MUTED_D, GOLD)
    d, w_en = wm_en(en_size)
    zh_size = en_size * 0.46
    _, w_zh = wm_zh_parts(zh_size)
    cap = en_size * 0.70
    body = f'<path transform="translate(0 {cap:.2f})" d="{d}" fill="{en_c}"/>'
    zh, _ = zh_group(zh_size, 0, cap + en_size * 0.62, zh_c, dot_c)
    height = cap + en_size * 0.62 + zh_size * 0.25
    return body + zh, max(w_en, w_zh), height


def wordmark_files():
    for theme in ("light", "dark"):
        en_c = INK if theme == "light" else BONE
        d, w = wm_en(96)
        write(f"04-wordmark/wordmark-en-on-{theme}.svg",
              svg(f"0 -72 {w:.0f} 96", f'<path d="{d}" fill="{en_c}"/>', title="Hold’em Knight"))
        zc, dc = (MUTED_L, GOLD_DEEP) if theme == "light" else (MUTED_D, GOLD)
        g, wz = zh_group(48, 0, 0, INK if theme == "light" else BONE, dc)
        write(f"04-wordmark/wordmark-zh-on-{theme}.svg",
              svg(f"0 -44 {wz:.0f} 56", g, title="有局 · 德州账本"))
        body, ws, hs = wordmark_stack(96, theme)
        write(f"04-wordmark/wordmark-stack-on-{theme}.svg",
              svg(f"0 0 {ws:.0f} {hs:.0f}", body, title="Hold’em Knight 有局 · 德州账本"))


# ---------- lockups ----------
def lockup_horizontal(theme, mark_body, mark_vb, mark_h=220):
    vbx, vby, vbw, vbh = map(float, mark_vb.split())
    s = mark_h / vbh
    mark_w = vbw * s
    text, tw, th = wordmark_stack(92, theme)
    gap = 56
    ty = (mark_h - th) / 2
    body = (f'<g transform="scale({s:.4f}) translate({-vbx} {-vby})">{mark_body}</g>'
            f'<g transform="translate({mark_w + gap:.2f} {ty:.2f})">{text}</g>')
    return body, mark_w + gap + tw, mark_h


def lockup_vertical(theme, mark_h=300):
    vbx, vby, vbw, vbh = map(float, EMBLEM_VB.split())
    s = mark_h / vbh
    mark_w = vbw * s
    text, tw, th = wordmark_stack(92, theme)
    W = max(mark_w, tw)
    body = (f'<g transform="translate({(W - mark_w) / 2:.2f} 0) scale({s:.4f}) translate({-vbx} {-vby})">'
            f'{emblem_colour()}</g>'
            f'<g transform="translate({(W - tw) / 2:.2f} {mark_h + 48})">{text}</g>')
    return body, W, mark_h + 48 + th


def padded(body, w, h, pad):
    return f'<g transform="translate({pad:.1f} {pad:.1f})">{body}</g>', w + 2 * pad, h + 2 * pad


def lockup_files():
    for theme in ("light", "dark"):
        b, w, h = padded(*lockup_horizontal(theme, emblem_colour(), EMBLEM_VB), 40)
        p = write(f"05-lockup/lockup-horizontal-on-{theme}.svg", svg(f"0 0 {w:.0f} {h:.0f}", b, title="Hold’em Knight"))
        png(p, f"05-lockup/lockup-horizontal-on-{theme}.png", int(w * 2), int(h * 2))
        b, w, h = padded(*lockup_vertical(theme), 48)
        p = write(f"05-lockup/lockup-vertical-on-{theme}.svg", svg(f"0 0 {w:.0f} {h:.0f}", b, title="Hold’em Knight"))
        png(p, f"05-lockup/lockup-vertical-on-{theme}.png", int(w * 2), int(h * 2))
        b, w, h = padded(*lockup_horizontal(theme, rounded(F900) + e4_content(), "0 0 512 512", 200), 40)
        p = write(f"05-lockup/lockup-appicon-on-{theme}.svg", svg(f"0 0 {w:.0f} {h:.0f}", b, title="Hold’em Knight"))
        png(p, f"05-lockup/lockup-appicon-on-{theme}.png", int(w * 2), int(h * 2))


# ---------- app icon ----------
def app_icon_files():
    master = write("01-app-icon/app-icon-master.svg",
                   svg("0 0 512 512", full_bleed(F900) + e4_content(), 1024, 1024, "Hold’em Knight app icon"))
    rnd = write("01-app-icon/app-icon-rounded-preview.svg",
                svg("0 0 512 512", rounded(F900) + e4_content(), 512, 512, "Hold’em Knight app icon (preview)"))
    mask = write("01-app-icon/app-icon-maskable.svg",
                 svg("0 0 512 512", full_bleed(F900) + scaled(e4_content(), 0.72), 512, 512, "maskable"))
    for size in (1024, 512, 192):
        png(master, f"01-app-icon/app-icon-{size}.png", size)
    png(master, "01-app-icon/apple-touch-icon-180.png", 180)
    png(mask, "01-app-icon/app-icon-maskable-512.png", 512)
    png(rnd, "01-app-icon/app-icon-rounded-preview-512.png", 512)


# ---------- emblem ----------
def emblem_files():
    p = write("02-emblem/emblem.svg", svg(EMBLEM_VB, emblem_colour(), 352, 424, "Hold’em Knight emblem"))
    png(p, "02-emblem/emblem-1024.png", int(1024 * 352 / 424), 1024)
    for name, c in (("mono-dark", INK), ("mono-bone", BONE), ("mono-gold", GOLD)):
        p = write(f"02-emblem/emblem-{name}.svg", svg(EMBLEM_VB, emblem_mono(c), 352, 424))
        png(p, f"02-emblem/emblem-{name}-1024.png", int(1024 * 352 / 424), 1024)
    p = write("02-emblem/emblem-on-dark-tile.svg",
              svg("0 0 512 512", rounded(F900) + emblem_colour(), 512, 512, "emblem tile"))
    png(p, "02-emblem/emblem-on-dark-tile-512.png", 512)


# ---------- small mark + favicons ----------
def mark_files():
    p = write("03-mark/mark.svg", svg(MARK_VB, mark(), 304, 288, "K◇K mark"))
    png(p, "03-mark/mark-512.png", 512, int(512 * 288 / 304))
    for name, stem, dia in (("mono-dark", INK, "none"), ("mono-bone", BONE, "none")):
        write(f"03-mark/mark-{name}.svg", svg(MARK_VB, mark(stem, dia), 304, 288))
    fav = write("03-mark/favicon.svg", svg("0 0 512 512", rounded(F700) + mark(), 64, 64, "Hold’em Knight"))
    for size in (16, 32, 48):
        png(fav, f"03-mark/favicon-{size}.png", size)
    subprocess.run(["convert", *(str(OUT / f"03-mark/favicon-{s}.png") for s in (16, 32, 48)),
                    str(OUT / "03-mark/favicon.ico")], check=True)


# ---------- marketing ----------
TAGLINE = "线下德州组局助手 · 买入记账 · 结算 · 保险 · 抽水 · 计时"


def banner(W, H, rel):
    vbx, vby, vbw, vbh = map(float, EMBLEM_VB.split())
    mh = H * 0.56
    s = mh / vbh
    mw = vbw * s
    text, tw, th = wordmark_stack(H * 0.135, "dark")
    tag, tagw = text_path(TAGLINE, H * 0.040, "noto", 600, 0.04)
    total = mw + H * 0.09 + max(tw, tagw)
    x0 = (W - total) / 2
    y0 = (H - mh) / 2
    tx = x0 + mw + H * 0.09
    ty = (H - th) / 2 - H * 0.04
    body = (f'<rect width="{W}" height="{H}" fill="{F900}"/>'
            f'<g transform="translate({x0:.1f} {y0:.1f}) scale({s:.4f}) translate({-vbx} {-vby})">{emblem_colour()}</g>'
            f'<g transform="translate({tx:.1f} {ty:.1f})">{text}</g>'
            f'<path transform="translate({tx:.1f} {ty + th + H * 0.10:.1f})" d="{tag}" fill="{MUTED_D}"/>')
    p = write(rel, svg(f"0 0 {W} {H}", body))
    png(p, rel.replace(".svg", ".png"), W, H)


def splash(W, H, rel):
    body_l, lw, lh = lockup_vertical("dark", mark_h=W * 0.36)
    s = (W * 0.72) / lw
    x = (W - lw * s) / 2
    y = (H - lh * s) / 2
    body = f'<rect width="{W}" height="{H}" fill="{F900}"/><g transform="translate({x:.1f} {y:.1f}) scale({s:.4f})">{body_l}</g>'
    p = write(rel, svg(f"0 0 {W} {H}", body))
    png(p, rel.replace(".svg", ".png"), W, H)


def marketing_files():
    banner(1200, 630, "07-marketing/og-image-1200x630.svg")
    banner(1280, 640, "07-marketing/github-social-1280x640.svg")
    splash(1170, 2532, "07-marketing/splash-portrait-1170x2532.svg")


# ---------- colour ----------
PALETTE = [
    ("felt-950", F950, "Deepest base: dark-mode page background; text on light backgrounds", "Felt 950"),
    ("felt-900", F900, "Splash and share image background; manifest theme_color; helmet", "Felt 900"),
    ("felt-800", F800, "Dark cards", "Felt 800"),
    ("felt-700", F700, "Primary brand green: app icon background; emblem stems on light backgrounds", "Felt 700"),
    ("felt-500", "#3f9a78", "Accent green in dark mode", "Felt 500"),
    ("felt-100", "#e3ebe6", "Light dividers and textures", "Felt 100"),
    ("felt-50", "#f2f5f2", "Light-mode page background", "Felt 50"),
    ("bone", BONE, "Stems and text on dark backgrounds", "Bone"),
    ("chip-gold", GOLD, "The only accent: diamond, helmet visor, wordmark dot", "Chip Gold"),
    ("chip-gold-deep", GOLD_DEEP, "Gold text on light backgrounds (for contrast)", "Chip Gold Deep"),
]


def colour_files():
    write("06-color/palette.json", json.dumps(
        [{"token": t, "hex": h, "usage": u, "name": n} for t, h, u, n in PALETTE], ensure_ascii=False, indent=2))
    write("06-color/palette.css", ":root {\n" + "".join(
        f"  --color-{t}: {h}; /* {u} */\n" for t, h, u, _ in PALETTE) + "}\n")
    cols = 5
    sw, sh = 260, 190
    parts = []
    for i, (t, h, u, n) in enumerate(PALETTE):
        x, y = (i % cols) * (sw + 20) + 20, (i // cols) * (sh + 20) + 20
        light = h.lower() in ("#f3efe2", "#e3ebe6", "#f2f5f2", "#d6b04c", "#3f9a78")
        tc = INK if light else BONE
        name_d, _ = text_path(n, 24, "cinzel", 700)
        hex_d, _ = text_path(h.upper(), 20, "cinzel", 600)
        parts.append(f'<rect x="{x}" y="{y}" width="{sw}" height="{sh}" rx="18" fill="{h}" stroke="#d3ddd7"/>'
                     f'<path transform="translate({x + 20} {y + sh - 52})" d="{name_d}" fill="{tc}"/>'
                     f'<path transform="translate({x + 20} {y + sh - 22})" d="{hex_d}" fill="{tc}"/>')
    W = cols * (sw + 20) + 20
    H = 2 * (sh + 20) + 20
    p = write("06-color/palette.svg", svg(f"0 0 {W} {H}", f'<rect width="{W}" height="{H}" fill="#ffffff"/>' + "".join(parts)))
    png(p, "06-color/palette.png", W, H)


# ---------- ready-to-copy files for the repo ----------
def repo_files():
    base = "for-repo/apps/web/public"
    for src, dst in (
        ("03-mark/favicon.svg", "favicon.svg"),
        ("03-mark/favicon.ico", "favicon.ico"),
        ("01-app-icon/apple-touch-icon-180.png", "apple-touch-icon.png"),
        ("01-app-icon/app-icon-192.png", "pwa-192.png"),
        ("01-app-icon/app-icon-512.png", "pwa-512.png"),
        ("01-app-icon/app-icon-maskable-512.png", "pwa-512-maskable.png"),
        ("07-marketing/og-image-1200x630.png", "og-image.png"),
    ):
        (OUT / base).mkdir(parents=True, exist_ok=True)
        shutil.copy(OUT / src, OUT / base / dst)


if __name__ == "__main__":
    app_icon_files()
    emblem_files()
    mark_files()
    wordmark_files()
    lockup_files()
    marketing_files()
    colour_files()
    repo_files()
    print(sum(1 for _ in OUT.rglob("*") if _.is_file()), "files")
