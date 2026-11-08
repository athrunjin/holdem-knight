"""Holdem Knight brand v1.1: D4 (K◇K with a knight helmet) is the single primary mark.

Reuses build_brand.py's helpers and swaps the artwork.
"""
import shutil
import subprocess

import build_brand as B
import icons as I

BONE, GOLD = I.BONE, I.GOLD
F900, F700 = I.FELT900, I.FELT700


def helm(fig=F900, cut=GOLD, plume=F900):
    return I.helmet(-61, -54, 112, fig, cut, plume)


def emblem(theme="dark"):
    """D4: two facing K's whose arms form a diamond, with a knight helmet inside."""
    stem = BONE if theme == "dark" else F700
    return I.kdk(stem_fill=stem, inner=helm())


_MASK = [0]


def helm_mono(c):
    """Helmet in one colour with the visor, ridge and breathing holes cut out (transparent)."""
    _MASK[0] += 1
    mid = f"hm{_MASK[0]}"
    return (f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="-200" y="-200" width="400" height="400">'
            f'{helm(fig="white", cut="black", plume="white")}</mask>'
            f'<rect x="-200" y="-200" width="400" height="400" fill="{c}" mask="url(#{mid})"/>')


def emblem_mono(c):
    return I.kdk(stem_fill=c, diamond_fill="none", inner=helm_mono(c))


VB = "104 112 304 288"


def app_icon_files():
    w = B.write
    master = w("01-app-icon/app-icon-master.svg",
               B.svg("0 0 512 512", B.full_bleed(F700) + emblem(), 1024, 1024, "Hold’em Knight app icon"))
    rnd = w("01-app-icon/app-icon-rounded-preview.svg",
            B.svg("0 0 512 512", B.rounded(F700) + emblem(), 512, 512, "Hold’em Knight app icon (preview)"))
    mask = w("01-app-icon/app-icon-maskable.svg",
             B.svg("0 0 512 512", B.full_bleed(F700) + B.scaled(emblem(), 0.84), 512, 512, "maskable"))
    for size in (1024, 512, 192):
        B.png(master, f"01-app-icon/app-icon-{size}.png", size)
    B.png(master, "01-app-icon/apple-touch-icon-180.png", 180)
    B.png(mask, "01-app-icon/app-icon-maskable-512.png", 512)
    B.png(rnd, "01-app-icon/app-icon-rounded-preview-512.png", 512)


def emblem_files():
    for theme in ("dark", "light"):
        p = B.write(f"02-emblem/emblem-on-{theme}.svg", B.svg(VB, emblem(theme), 304, 288, "Hold’em Knight"))
        B.png(p, f"02-emblem/emblem-on-{theme}-1024.png", 1024, int(1024 * 288 / 304))
    for name, c in (("mono-dark", B.INK), ("mono-bone", BONE), ("mono-gold", GOLD)):
        p = B.write(f"02-emblem/emblem-{name}.svg", B.svg(VB, emblem_mono(c), 304, 288))
        B.png(p, f"02-emblem/emblem-{name}-1024.png", 1024, int(1024 * 288 / 304))


def mark_files():
    B.mark_files()
    B.write("03-mark/mark-on-light.svg", B.svg(B.MARK_VB, B.mark(stem=F700, dia=GOLD), 304, 288))


def lockup_vertical(theme, mark_h=300):
    vbx, vby, vbw, vbh = map(float, VB.split())
    s = mark_h / vbh
    mark_w = vbw * s
    text, tw, th = B.wordmark_stack(92, theme)
    W = max(mark_w, tw)
    body = (f'<g transform="translate({(W - mark_w) / 2:.2f} 0) scale({s:.4f}) translate({-vbx} {-vby})">'
            f"{emblem(theme)}</g>"
            f'<g transform="translate({(W - tw) / 2:.2f} {mark_h + 56})">{text}</g>')
    return body, W, mark_h + 56 + th


def lockup_files():
    for theme in ("light", "dark"):
        b, w, h = B.padded(*B.lockup_horizontal(theme, emblem(theme), VB, 200), 40)
        p = B.write(f"05-lockup/lockup-horizontal-on-{theme}.svg", B.svg(f"0 0 {w:.0f} {h:.0f}", b, title="Hold’em Knight"))
        B.png(p, f"05-lockup/lockup-horizontal-on-{theme}.png", int(w * 2), int(h * 2))
        b, w, h = B.padded(*lockup_vertical(theme), 48)
        p = B.write(f"05-lockup/lockup-vertical-on-{theme}.svg", B.svg(f"0 0 {w:.0f} {h:.0f}", b, title="Hold’em Knight"))
        B.png(p, f"05-lockup/lockup-vertical-on-{theme}.png", int(w * 2), int(h * 2))
        b, w, h = B.padded(*B.lockup_horizontal(theme, B.rounded(F700) + emblem(), "0 0 512 512", 200), 40)
        p = B.write(f"05-lockup/lockup-appicon-on-{theme}.svg", B.svg(f"0 0 {w:.0f} {h:.0f}", b, title="Hold’em Knight"))
        B.png(p, f"05-lockup/lockup-appicon-on-{theme}.png", int(w * 2), int(h * 2))


def banner(W, H, rel):
    vbx, vby, vbw, vbh = map(float, VB.split())
    mh = H * 0.44
    s = mh / vbh
    mw = vbw * s
    text, tw, th = B.wordmark_stack(H * 0.135, "dark")
    tag, tagw = B.text_path(B.TAGLINE, H * 0.040, "noto", 600, 0.04)
    total = mw + H * 0.10 + max(tw, tagw)
    x0 = (W - total) / 2
    y0 = (H - mh) / 2
    tx = x0 + mw + H * 0.10
    ty = (H - th) / 2 - H * 0.04
    body = (f'<rect width="{W}" height="{H}" fill="{F900}"/>'
            f'<g transform="translate({x0:.1f} {y0:.1f}) scale({s:.4f}) translate({-vbx} {-vby})">{emblem()}</g>'
            f'<g transform="translate({tx:.1f} {ty:.1f})">{text}</g>'
            f'<path transform="translate({tx:.1f} {ty + th + H * 0.10:.1f})" d="{tag}" fill="{B.MUTED_D}"/>')
    p = B.write(rel, B.svg(f"0 0 {W} {H}", body))
    B.png(p, rel.replace(".svg", ".png"), W, H)


def splash(W, H, rel):
    body_l, lw, lh = lockup_vertical("dark", mark_h=W * 0.42)
    s = (W * 0.74) / lw
    x = (W - lw * s) / 2
    y = (H - lh * s) / 2
    body = (f'<rect width="{W}" height="{H}" fill="{F900}"/>'
            f'<g transform="translate({x:.1f} {y:.1f}) scale({s:.4f})">{body_l}</g>')
    p = B.write(rel, B.svg(f"0 0 {W} {H}", body))
    B.png(p, rel.replace(".svg", ".png"), W, H)


def marketing_files():
    banner(1200, 630, "07-marketing/og-image-1200x630.svg")
    banner(1280, 640, "07-marketing/github-social-1280x640.svg")
    splash(1170, 2532, "07-marketing/splash-portrait-1170x2532.svg")


if __name__ == "__main__":
    if B.OUT.exists():
        shutil.rmtree(B.OUT)
    app_icon_files()
    emblem_files()
    mark_files()
    B.wordmark_files()
    lockup_files()
    marketing_files()
    B.colour_files()
    B.repo_files()
    print(sum(1 for _ in B.OUT.rglob("*") if _.is_file()), "files")
