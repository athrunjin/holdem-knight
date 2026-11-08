# Hold’em Knight brand guide v1.1

> Final: 2026-11-07. Source: **D4, the diamond knight helmet**, from round three ("knights and kings") of the logo canvas.
> v1.1 replaces v1, which used the knight card (E4) and the crowned shield (D5) by mistake.
> The decision is recorded in [ADR 0021](../adr/0021-brand-identity.md).

## 1. The mark: D4 diamond knight helmet

**The brand has one mark:** two facing K's whose diagonal strokes meet in a gold diamond (♦), with a knight helmet inside the diamond (gold visor slit, plume).

- The two K's are pocket kings, KK, the biggest pair after aces in Hold’em.
- The diamond is the suit, and it falls out of the K's diagonals.
- The helmet is the Knight: the organizer guards the game, its books, its rules and its fairness.

| Part | What it is | Where it's used | Folder |
| --- | --- | --- | --- |
| **App icon** | Felt-green square with the emblem | Home screens, PWA install icon, app stores | `01-app-icon/` |
| **Emblem** | Transparent, with versions for dark and light backgrounds | Site header, splash, share images, merchandise (card backs, chips, table cloth) | `02-emblem/` |
| **Small mark** | K◇K without the helmet, with heavier strokes | Favicon and anywhere under 32px | `03-mark/` |

The small mark exists because the helmet still reads at 48px but is a dot at 32px. Under 32px the helmet goes, and K◇K still reads at 16px as two stems around a diamond.

## 2. Folder layout

```
docs/brand/
├── README.md                   This guide
├── 00-preview/brand-sheet.png  One-page overview
├── 01-app-icon/                App icon
├── 02-emblem/                  Emblem (dark, light and one-colour versions)
├── 03-mark/                    Small mark and favicon
├── 04-wordmark/                Wordmarks (English, Chinese, stacked)
├── 05-lockup/                  Emblem and wordmark together
├── 06-color/                   Palette (JSON, CSS, swatch sheet)
├── 07-marketing/               Share image, GitHub social image, splash
└── 08-source/                  Build scripts and font licences
```

Every SVG is vector with its text converted to paths, so it looks the same everywhere without the fonts installed.

**Only SVGs are kept in the repository**, plus the brand sheet. The PNG exports (about 2 MB) can be rebuilt with `08-source/build_brand_v2.py`. The PNGs the app ships are in `apps/web/public/`.

## 3. App icon `01-app-icon/`

| File | Use |
| --- | --- |
| `app-icon-master.svg` | Master. **Full-bleed square with no rounded corners**: iOS and Android round the corners themselves |
| `app-icon-maskable.svg` | Android adaptive icon: the emblem is scaled to 84% so a circular crop doesn't cut it |
| `app-icon-rounded-preview.svg` | **For showing the icon only** (slides, README, web pages). Never use it as an install icon |

The icon background is felt-700 (`#1D5C47`), a step lighter than the app's dark background, so it stands out on a home screen.

The name under the home screen icon is **Holdem Knight**, without the apostrophe. At 13 characters some phones cut it to "Holdem Kni…". That's the system's doing; check on real devices.

## 4. Emblem `02-emblem/`

| File | Use |
| --- | --- |
| `emblem-on-dark.svg` | Dark backgrounds: bone stems, gold diamond, dark helmet |
| `emblem-on-light.svg` | Light backgrounds: felt-green stems, gold diamond, dark helmet |
| `emblem-mono-dark.svg` | One colour, dark: single-colour print, stamps, watermarks on light backgrounds |
| `emblem-mono-bone.svg` | One colour, bone: watermarks on dark photos or backgrounds |
| `emblem-mono-gold.svg` | One colour, gold: foil, embroidery, chips and card backs |

**The dark version's bone stems disappear on a light background**, so light backgrounds always take the `on-light` version.

In the one-colour versions the diamond is an outline and the helmet's visor and breathing holes are cut out, so the background shows through on any colour.

## 5. Small mark `03-mark/`

| File | Use |
| --- | --- |
| `favicon.svg` | Browser tab icon (modern browsers prefer it) and the 40px icon at the top of the app's sidebar |
| `mark.svg` | Transparent, for dark backgrounds |
| `mark-on-light.svg` | Transparent, for light backgrounds |
| `mark-mono-dark.svg`, `mark-mono-bone.svg` | One-colour versions |

`favicon.ico` (16, 32 and 48px, for older browsers and Windows) is in `apps/web/public/`.

## 6. Wordmarks `04-wordmark/`

- English: **Hold’em Knight** in Cinzel Bold, tracking +2%. It uses the curly apostrophe (’), as in ADR 0020.
- Chinese: **有局 · 德州账本** in Noto Serif SC SemiBold, tracking +8%. The middle dot is gold.
- Stacked (`wordmark-stack-*`): English above, Chinese below at about 46% of the English size.

Each comes in `on-light` (deep green text) and `on-dark` (bone text).

## 7. Lockups `05-lockup/`

| File | When to use it |
| --- | --- |
| `lockup-horizontal-*` | First choice: site header, document heading, banners |
| `lockup-vertical-*` | Tall or square spaces: splash, posters, the back of a business card |
| `lockup-appicon-*` | Introducing the app itself: the GitHub README, download pages, promotional images |

The proportions and spacing are fixed. Scale a lockup as a whole; don't move the emblem or text inside it.

## 8. Colour `06-color/`

The palette is the app's design tokens in `apps/web/src/styles.css`, with no new colours. `palette.json` is for scripts and `palette.css` can be imported as is.

| Token | Value | Use |
| --- | --- | --- |
| felt-950 | `#0E1B16` | Deepest base: dark-mode page background; text on light backgrounds |
| felt-900 | `#13241E` | Splash and share image background; manifest `theme_color`; helmet |
| felt-800 | `#1A3129` | Dark cards |
| felt-700 | `#1D5C47` | Primary brand green: app icon background; emblem stems on light backgrounds |
| felt-500 | `#3F9A78` | Accent green in dark mode |
| felt-100 | `#E3EBE6` | Light dividers and textures |
| felt-50 | `#F2F5F2` | Light-mode page background |
| bone | `#F3EFE2` | Stems and text on dark backgrounds |
| chip-gold | `#D6B04C` | **The only accent**: diamond, helmet visor, wordmark dot |
| chip-gold-deep | `#9A7A22` | Gold text on light backgrounds |

Contrast (WCAG, body text needs at least 4.5:1):

- Bone on felt-900: 14.1:1; bone on felt-700: 6.8:1. Fine for text.
- Chip gold on felt-900: 7.8:1. Fine for text.
- Chip gold on felt-700: 3.8:1; deep gold on felt-50: 3.7:1. **Graphics and large text (24px and up) only.**
- Chip gold on felt-50: 1.9:1. **Never write in chip gold on a light background.** The gold diamond in the emblem is fine because a green outline surrounds it.

## 9. Typefaces

| Use | Typeface | Licence |
| --- | --- | --- |
| English wordmark, large headings | Cinzel Bold / SemiBold | SIL OFL 1.1 |
| Chinese wordmark, taglines | Noto Serif SC SemiBold | SIL OFL 1.1 |
| App interface | Unchanged: Archivo and the system Chinese font | — |

The licences are in `08-source/fonts-licenses/`. The wordmarks are already paths, so the fonts are only needed to set new promotional text.

## 10. Clear space and minimum sizes

- **Clear space:** keep at least half a diamond's width empty around the emblem. The lockup files already include it.
- **Minimum sizes:**

| Part | Smallest size | Below that, use |
| --- | --- | --- |
| App icon, emblem with helmet | 48px | The small mark K◇K |
| Horizontal lockup | 32px tall (English wordmark about 12px) | The emblem alone |
| Small mark | 16px | — |

## 11. Don't

- Don't change the colours or add gradients, outlines, shadows or glows.
- Don't stretch, squash or rotate the mark.
- Don't put the dark-background version on a light background (the stems vanish).
- Don't write in chip gold on a light background.
- Don't round the corners of icon files yourself (the system does it).
- Don't retype the wordmark in another typeface.
- Don't use the helmet version under 48px; use K◇K.
- Don't swap the helmet back to a chess knight (that's a horse, not a knight).

## 12. How to write the name

| Where | Form |
| --- | --- |
| Brand, wordmark | Hold’em Knight |
| Full name (page title, manifest `name`) | Hold’em Knight · Tablebook |
| Under the home screen icon | Holdem Knight |
| Chinese name | 有局; in full, 有局 · 德州账本 |
| Code, domain, packages | `holdem-knight` (no apostrophe) |
| Slogan (optional) | 你的守局骑士 |

## 13. How it got here

1. **Round one:** A pocket kings, B knight K card, C knight chip, D K◇K badge, E pocket kings with a knight. D and E went forward.
2. **Round two:** D's diamond joined to the stems so both sides read as K, plus a shield. The problem was a chess knight, a horse rather than a knight.
3. **Round three:** a knight's helmet, knight and king busts, and a crown. **D4, the diamond knight helmet, was chosen.**
4. **v1 → v1.1:** v1 used E4 (knight card) and D5 (crowned shield) by mistake and was corrected to D4. D5, D6 and E4–E6 stay on the canvas as alternatives.

Names and marks that were dropped: Chip Leader (clashes with Chip Leader Coaching), KK 德州 (clashes with the real-money KKPoker), Felt (an app like this already exists) and the chess knight.

## 14. Changing and rebuilding `08-source/`

Every file is drawn by a script, so one change can be exported everywhere:

- `icons.py`: all the artwork (K, knight helmet, crown, shield, K◇K, cards).
- `textpath.py`: converts wordmark text to paths.
- `build_brand.py`: shared export helpers (wordmarks, palette, favicon, copying files).
- `build_brand_v2.py`: **the entry point for the current version**, with D4 as the mark. Run `python3 build_brand_v2.py`.

It needs Python 3, `fonttools`, `brotli`, `rsvg-convert` (librsvg) and ImageMagick, with the fonts from npm: `@fontsource/cinzel` and `@fontsource/noto-serif-sc`. The font folder is set at the top of `textpath.py` and the output folder at the top of `build_brand.py`; change both to local paths first.

To change a colour, change `apps/web/src/styles.css` first, then `06-color/` and the constants in `icons.py`, and rebuild.

## 15. Open questions

- "Holdem Knight" is cut off under the icon on some phones. If it looks bad on real devices, go back to "Knight" or use 有局.
- The Chinese name 有局 is only used in the wordmark and promotion so far, not in the app (ADR 0020).
- A China release would need to check app store rules on words like 德州.
