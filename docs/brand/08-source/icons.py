"""Generate the Holdem Knight logo option SVGs (viewBox 0 0 512 512)."""
import json
import pathlib

FELT950 = "#0e1b16"
FELT900 = "#13241e"
FELT800 = "#1a3129"
FELT700 = "#1d5c47"
BONE = "#f3efe2"
GOLD = "#d6b04c"
GOLD_DEEP = "#9a7a22"

KNIGHT_D = (
    "M22 94 H80 V87 H75 V82 C72 80 70 78 69 74 C66 64 66 56 68 48 C70 38 69 29 63 21 "
    "C59 16 53 13 48 12 L46 4 L40 11 L36 5 L33 14 C25 18 19 26 16 35 L10 47 C8 51 10 55 14 55 "
    "L18 54 C20 57 24 57 26 55 L30 51 C34 51 38 49 42 46 C43 55 38 63 32 70 C30 73 29 77 30 82 "
    "H26 V87 H22 Z"
)
SPADE_D = (
    "M50 8 C40 30 10 42 10 64 C10 78 22 86 34 84 C40 83 44 80 46 76 C44 86 40 92 34 96 H66 "
    "C60 92 56 86 54 76 C56 80 60 83 66 84 C78 86 90 78 90 64 C90 42 60 30 50 8 Z"
)
HEART_D = (
    "M50 92 C40 80 8 62 8 36 C8 20 20 10 32 10 C40 10 46 14 50 22 C54 14 60 10 68 10 "
    "C80 10 92 20 92 36 C92 62 60 80 50 92 Z"
)


def knight(x, y, size, fill, cut):
    s = size / 100
    return (
        f'<g transform="translate({x} {y}) scale({s})">'
        f'<path fill="{fill}" d="{KNIGHT_D}"/>'
        f'<circle cx="36" cy="27" r="3" fill="{cut}"/>'
        f'<path d="M58 24 C62 30 64 38 62 46 M54 22 C57 27 58 33 57 38" stroke="{cut}" '
        f'stroke-width="1.8" fill="none" stroke-linecap="round"/>'
        f'<path d="M13 50 L20 49" stroke="{cut}" stroke-width="1.6" stroke-linecap="round"/>'
        "</g>"
    )


def glyph_k(x, y, h, fill):
    """Slab-serif K drawn with strokes in a 100x140 box, scaled to height h."""
    s = h / 140
    return (
        f'<g transform="translate({x} {y}) scale({s})" stroke="{fill}" fill="none" stroke-linecap="butt">'
        '<path d="M24 12 V128" stroke-width="24"/>'
        '<path d="M34 80 L88 14" stroke-width="20"/>'
        '<path d="M48 62 L94 128" stroke-width="22"/>'
        '<path d="M2 16 H46 M2 124 H46 M66 16 H104 M72 124 H108" stroke-width="8"/>'
        "</g>"
    )


def suit(d, x, y, size, fill):
    s = size / 100
    return f'<path transform="translate({x} {y}) scale({s})" d="{d}" fill="{fill}"/>'


def card(w, h, inner):
    """A card centred on (0,0)."""
    return (
        f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="24" fill="{BONE}"/>'
        f'<rect x="{-w/2+12}" y="{-h/2+12}" width="{w-24}" height="{h-24}" rx="15" fill="none" '
        f'stroke="{GOLD_DEEP}" stroke-width="3"/>' + inner
    )


def shadow_card(w, h):
    return f'<rect x="{-w/2+8}" y="{-h/2+10}" width="{w}" height="{h}" rx="24" fill="{FELT950}" opacity="0.35"/>'


def bg(fill):
    return f'<rect width="512" height="512" rx="112" fill="{fill}"/>'


def k_face(suit_d, suit_fill):
    # big K + suit, card centred at 0,0 (card 200x280)
    return glyph_k(-46, -104, 128, FELT950) + suit(suit_d, -28, 40, 56, suit_fill)




def corner_index(x, y, rot=0):
    return (
        f'<g transform="translate({x} {y}) rotate({rot})">'
        + glyph_k(0, 0, 44, FELT950)
        + suit(SPADE_D, 2, 50, 30, FELT950)
        + "</g>"
    )


def option_b():
    w, h = 270, 370
    inner = (
        knight(-104, -100, 208, FELT700, BONE)
        + corner_index(-w / 2 + 22, -h / 2 + 22)
        + corner_index(w / 2 - 22, h / 2 - 22, 180)
    )
    return bg(FELT900) + f'<g transform="translate(256 256)">{shadow_card(w,h)}{card(w,h,inner)}</g>'


def option_c():
    inserts = "".join(
        f'<rect x="228" y="58" width="56" height="44" rx="8" fill="{BONE}" transform="rotate({a} 256 256)"/>'
        for a in range(0, 360, 60)
    )
    return (
        bg(FELT900)
        + f'<circle cx="256" cy="256" r="198" fill="{FELT700}"/>'
        + inserts
        + f'<circle cx="256" cy="256" r="146" fill="none" stroke="{GOLD}" stroke-width="9" stroke-dasharray="22 14"/>'
        + f'<circle cx="256" cy="256" r="128" fill="{FELT800}"/>'
        + knight(158, 150, 196, BONE, FELT800)
    )


def option_d():
    left, right, top, bot = 150, 362, 140, 372
    mid = 256
    stem = 40
    return (
        bg(FELT700)
        + f'<polygon points="{left+stem},{mid} {mid},{top+22} {right-stem},{mid} {mid},{bot-22}" fill="{GOLD}"/>'
        + f'<g fill="none" stroke="{BONE}" stroke-width="30" stroke-linejoin="miter" stroke-linecap="butt">'
        + f'<path d="M{left+stem} {mid} L{mid} {top+22} L{right-stem} {mid} L{mid} {bot-22} Z"/></g>'
        + f'<rect x="{left}" y="{top}" width="{stem}" height="{bot-top}" fill="{BONE}"/>'
        + f'<rect x="{right-stem}" y="{top}" width="{stem}" height="{bot-top}" fill="{BONE}"/>'
        + f'<rect x="{left-14}" y="{top}" width="{stem+28}" height="12" fill="{BONE}"/>'
        + f'<rect x="{left-14}" y="{bot-12}" width="{stem+28}" height="12" fill="{BONE}"/>'
        + f'<rect x="{right-stem-14}" y="{top}" width="{stem+28}" height="12" fill="{BONE}"/>'
        + f'<rect x="{right-stem-14}" y="{bot-12}" width="{stem+28}" height="12" fill="{BONE}"/>'
    )




def fan_card(dx, rot, inner, w=212, h=292):
    """Card whose bottom-centre pivots on (256+dx, 418)."""
    return (
        f'<g transform="translate({256+dx} 404) rotate({rot})">'
        f'<rect x="{-w/2+8}" y="{-h+10}" width="{w}" height="{h}" rx="24" fill="{FELT950}" opacity="0.35"/>'
        f'<rect x="{-w/2}" y="{-h}" width="{w}" height="{h}" rx="24" fill="{BONE}"/>'
        f'<rect x="{-w/2+12}" y="{-h+12}" width="{w-24}" height="{h-24}" rx="15" fill="none" stroke="{GOLD_DEEP}" stroke-width="3"/>'
        + inner + "</g>"
    )


def corner_k(suit_d, suit_fill, kh=112):
    return glyph_k(-84, -266, kh, FELT950) + suit(suit_d, -80, -266 + kh + 14, 48, suit_fill)


def option_a():
    back = fan_card(-44, -15, corner_k(SPADE_D, FELT950))
    front = fan_card(44, 9, corner_k(HEART_D, GOLD_DEEP))
    return bg(FELT700) + back + front


def option_e():
    back = fan_card(-44, -15, corner_k(SPADE_D, FELT950))
    face = glyph_k(-84, -266, 58, FELT950) + suit(SPADE_D, -82, -198, 30, FELT950) + knight(-70, -190, 168, FELT700, BONE)
    front = fan_card(44, 9, face)
    return bg(FELT700) + back + front


OPTIONS = {
    "a": option_a(),
    "b": option_b(),
    "c": option_c(),
    "d": option_d(),
    "e": option_e(),
}

if __name__ == "__main__":
    out = pathlib.Path(__file__).parent
    for key, body in OPTIONS.items():
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{body}</svg>'
        (out / f"opt-{key}.svg").write_text(svg)
    (out / "options.json").write_text(json.dumps(OPTIONS))


# ---------------- Round 2: refinements of D and E ----------------
SHIELD_D = "M256 58 L420 108 V250 C420 350 350 420 256 458 C162 420 92 350 92 250 V108 Z"


def kdk(cx=256, cy=256, scale=1.0, half_w=96, half_h=126, stem=38, stroke=26,
        stem_fill=BONE, diamond_fill=GOLD, inner=""):
    """K◇K emblem: two stems with a diamond between them, centred on cx,cy."""
    gap = -4  # diamond tips run into the stems so each side reads as a K
    lx = -half_w - gap - stem
    rx = half_w + gap
    top, bot = -half_h - 10, half_h + 10
    serif = 13
    body = (
        f'<polygon points="{-half_w},0 0,{-half_h} {half_w},0 0,{half_h}" fill="{diamond_fill}"/>'
        + inner
        + f'<path d="M{-half_w} 0 L0 {-half_h} L{half_w} 0 L0 {half_h} Z" fill="none" stroke="{stem_fill}" '
        f'stroke-width="{stroke}" stroke-linejoin="miter"/>'
        + f'<rect x="{lx}" y="{top}" width="{stem}" height="{bot-top}" fill="{stem_fill}"/>'
        + f'<rect x="{rx}" y="{top}" width="{stem}" height="{bot-top}" fill="{stem_fill}"/>'
        + "".join(
            f'<rect x="{x - serif}" y="{y}" width="{stem + 2*serif}" height="12" fill="{stem_fill}"/>'
            for x in (lx, rx) for y in (top, bot - 12)
        )
    )
    return f'<g transform="translate({cx} {cy}) scale({scale})">{body}</g>'


def d1():  # knight inside the diamond
    inner = knight(-56, -60, 122, FELT900, GOLD)
    return bg(FELT700) + kdk(inner=inner)


def d2():  # heraldic shield around K◇K
    return (
        bg(FELT900)
        + f'<path d="{SHIELD_D}" fill="{FELT700}" stroke="{GOLD}" stroke-width="12" stroke-linejoin="round"/>'
        + kdk(cx=256, cy=246, scale=0.74)
    )


def d3():  # shield + knight in diamond
    inner = knight(-56, -60, 122, FELT900, GOLD)
    return (
        bg(FELT900)
        + f'<path d="{SHIELD_D}" fill="{FELT700}" stroke="{GOLD}" stroke-width="12" stroke-linejoin="round"/>'
        + kdk(cx=256, cy=246, scale=0.74, inner=inner)
    )


def fan_card2(dx, rot, inner, face=BONE, border=None, w=216, h=296):
    border_el = (
        f'<rect x="{-w/2+12}" y="{-h+12}" width="{w-24}" height="{h-24}" rx="15" fill="none" '
        f'stroke="{border}" stroke-width="5"/>' if border else ""
    )
    return (
        f'<g transform="translate({256+dx} 404) rotate({rot})">'
        f'<rect x="{-w/2+8}" y="{-h+10}" width="{w}" height="{h}" rx="26" fill="{FELT950}" opacity="0.4"/>'
        f'<rect x="{-w/2}" y="{-h}" width="{w}" height="{h}" rx="26" fill="{face}"/>'
        + border_el + inner + "</g>"
    )


def e1():  # cleaner: no inner rule lines, larger knight
    back = fan_card2(-46, -15, corner_k(SPADE_D, FELT950, kh=120))
    face = glyph_k(-86, -270, 64, FELT950) + knight(-84, -196, 188, FELT700, BONE)
    return bg(FELT700) + back + fan_card2(46, 9, face)


def e2():  # front card in felt green, bone knight: two cards read apart at small sizes
    back = fan_card2(-46, -15, corner_k(SPADE_D, FELT950, kh=120))
    face = glyph_k(-86, -270, 64, BONE) + knight(-84, -196, 188, BONE, FELT700)
    front = fan_card2(46, 9, face, face=FELT700, border=GOLD)
    return bg(FELT900) + back + front


def e3():  # gold knight on dark card, K◇K-style crispness
    back = fan_card2(-46, -15, corner_k(SPADE_D, FELT950, kh=120))
    face = glyph_k(-86, -270, 64, GOLD) + knight(-84, -196, 188, GOLD, FELT950)
    front = fan_card2(46, 9, face, face=FELT950, border=GOLD)
    return bg(FELT700) + back + front


ROUND2 = {"d1": d1(), "d2": d2(), "d3": d3(), "e1": e1(), "e2": e2(), "e3": e3()}
OPTIONS.update(ROUND2)

if __name__ == "__main__":
    out = pathlib.Path(__file__).parent
    for key, body in ROUND2.items():
        (out / f"opt-{key}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{body}</svg>')


# ---------------- Round 3: real knight / king figures ----------------
_CLIP = [0]


def glyph_k(x, y, h, fill):  # noqa: F811  (redefined: arms clipped to the cap height)
    s = h / 140
    _CLIP[0] += 1
    cid = f"kc{_CLIP[0]}"
    return (
        f'<g transform="translate({x} {y}) scale({s})">'
        f'<clipPath id="{cid}"><rect x="-4" y="12" width="116" height="116"/></clipPath>'
        f'<g stroke="{fill}" fill="none" stroke-linecap="butt">'
        '<path d="M24 12 V128" stroke-width="24"/>'
        f'<g clip-path="url(#{cid})"><path d="M30 86 L92 8" stroke-width="20"/>'
        '<path d="M46 60 L98 134" stroke-width="22"/></g>'
        '<path d="M2 16 H46 M2 124 H46 M64 16 H104 M70 124 H110" stroke-width="8"/>'
        "</g></g>"
    )


def _place(x, y, size, inner):
    return f'<g transform="translate({x} {y}) scale({size/100})">{inner}</g>'


def helmet(x, y, size, fig, cut, plume):
    return _place(x, y, size, (
        f'<path d="M50 12 C47 1 60 -4 76 0 C88 3 95 14 93 27 C87 17 76 11 61 13 Z" fill="{plume}"/>'
        f'<path d="M50 10 C61 10 71 19 72 35 L72 64 C72 76 63 84 50 88 C37 84 28 76 28 64 L28 35 C29 19 39 10 50 10 Z" fill="{fig}"/>'
        f'<path d="M50 11 V38" stroke="{cut}" stroke-width="2.4"/>'
        f'<path d="M31 40 H47 V46 H31 Z M53 40 H69 V46 H53 Z" fill="{cut}"/>'
        f'<g fill="{cut}"><rect x="35" y="58" width="7" height="2.6" rx="1"/><rect x="35" y="65" width="7" height="2.6" rx="1"/>'
        f'<rect x="58" y="58" width="7" height="2.6" rx="1"/><rect x="58" y="65" width="7" height="2.6" rx="1"/></g>'
    ))


def knight_bust(x, y, size, fig, cut, accent):
    return _place(x, y, size, (
        f'<path d="M50 12 C47 1 60 -4 76 0 C88 3 95 14 93 27 C87 17 76 11 61 13 Z" fill="{accent}"/>'
        f'<path d="M6 100 C6 84 17 76 30 74 L38 71 H62 L70 74 C83 76 94 84 94 100 Z" fill="{fig}"/>'
        f'<path d="M13 100 C13 88 21 82 32 80 M87 100 C87 88 79 82 68 80" stroke="{cut}" stroke-width="2.6" fill="none"/>'
        f'<path d="M50 87 L56 93 L50 99 L44 93 Z" fill="{accent}"/>'
        f'<path d="M50 10 C61 10 71 19 72 35 L72 58 C72 69 63 76 50 79 C37 76 28 69 28 58 L28 35 C29 19 39 10 50 10 Z" fill="{fig}"/>'
        f'<path d="M50 11 V36" stroke="{cut}" stroke-width="2.2"/>'
        f'<path d="M31 38 H47 V43 H31 Z M53 38 H69 V43 H53 Z" fill="{cut}"/>'
        f'<g fill="{cut}"><rect x="35" y="53" width="7" height="2.4" rx="1"/><rect x="35" y="59" width="7" height="2.4" rx="1"/>'
        f'<rect x="58" y="53" width="7" height="2.4" rx="1"/><rect x="58" y="59" width="7" height="2.4" rx="1"/></g>'
    ))


def king_bust(x, y, size, fig, dark, accent):
    return _place(x, y, size, (
        f'<path d="M6 100 C6 84 18 76 32 74 H68 C82 76 94 84 94 100 Z" fill="{fig}"/>'
        f'<path d="M50 76 V100" stroke="{accent}" stroke-width="5"/>'
        f'<path d="M30 22 L28 4 L39 13 L50 0 L61 13 L72 4 L70 22 Z" fill="{accent}"/>'
        f'<circle cx="50" cy="40" r="19" fill="{fig}"/>'
        f'<path d="M31 42 C31 62 40 76 50 80 C60 76 69 62 69 42 C66 50 62 53 56 53 C53 53 51 51 50 50 C49 51 47 53 44 53 C38 53 34 50 31 42 Z" fill="{dark}"/>'
        f'<path d="M45 58 H55" stroke="{fig}" stroke-width="2.2" stroke-linecap="round"/>'
        f'<circle cx="43" cy="38" r="2.4" fill="{dark}"/><circle cx="57" cy="38" r="2.4" fill="{dark}"/>'
        f'<rect x="29" y="20" width="42" height="6" rx="2" fill="{accent}"/>'
    ))


def crown(x, y, size, fill, gem):
    return _place(x, y, size, (
        f'<path d="M14 74 L8 30 L31 50 L50 16 L69 50 L92 30 L86 74 Z" fill="{fill}"/>'
        f'<rect x="12" y="77" width="76" height="13" rx="3" fill="{fill}"/>'
        f'<g fill="{fill}"><circle cx="8" cy="27" r="6"/><circle cx="50" cy="13" r="6"/><circle cx="92" cy="27" r="6"/></g>'
        f'<g fill="{gem}"><circle cx="30" cy="83.5" r="3"/><circle cx="50" cy="83.5" r="3"/><circle cx="70" cy="83.5" r="3"/></g>'
    ))


def _green_front(face):
    return fan_card2(46, 9, face, face=FELT700, border=GOLD)


def _back_k():
    return fan_card2(-46, -15, corner_k(SPADE_D, FELT950, kh=120))


def e4():  # knight bust on the green front card
    face = glyph_k(-86, -270, 60, BONE) + knight_bust(-86, -200, 176, BONE, FELT700, GOLD)
    return bg(FELT900) + _back_k() + _green_front(face)


def e5():  # king bust on the green front card
    face = glyph_k(-86, -270, 60, BONE) + king_bust(-86, -200, 176, BONE, FELT950, GOLD)
    return bg(FELT900) + _back_k() + _green_front(face)


def e6():  # crowned K
    face = crown(-58, -262, 108, GOLD, FELT700) + glyph_k(-62, -150, 128, BONE)
    return bg(FELT900) + _back_k() + _green_front(face)


SHIELD_INNER = f'<path d="{SHIELD_D}" fill="{FELT700}" stroke="{GOLD}" stroke-width="12" stroke-linejoin="round"/>'


def d4():  # knight helmet inside the diamond
    return bg(FELT700) + kdk(inner=helmet(-61, -54, 112, FELT900, GOLD, FELT900))


def d5():  # shield + crown above K◇K (kings)
    return (bg(FELT900) + SHIELD_INNER + crown(206, 112, 100, GOLD, FELT700)
            + kdk(cx=256, cy=290, scale=0.62))


def d6():  # shield + helmet in diamond
    return (bg(FELT900) + SHIELD_INNER
            + kdk(cx=256, cy=250, scale=0.74, inner=helmet(-61, -54, 112, FELT900, GOLD, FELT900)))


ROUND3 = {"d4": d4(), "d5": d5(), "d6": d6(), "e4": e4(), "e5": e5(), "e6": e6()}
OPTIONS.update(ROUND3)

if __name__ == "__main__":
    out = pathlib.Path(__file__).parent
    for key, body in ROUND3.items():
        (out / f"opt-{key}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{body}</svg>')
