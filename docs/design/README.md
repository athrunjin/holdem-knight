# Visual guide

How Hold’em Knight looks and moves, and why. It collects what the app already does and what the
organizer has asked for across its pages, so a new page starts from the same place as the old ones.

- The brand (logo, icon, wordmark, palette files) is in [`docs/brand/README.md`](../brand/README.md).
- The values themselves are tokens in [`apps/web/src/styles.css`](../../apps/web/src/styles.css). This guide says how to use them. Where the two differ, the stylesheet is right and this guide is fixed.
- Every change to the interface is checked against this guide before it is handed over: see [the visual review](review.md).

The guide is a living document ([ADR 0050](../adr/0050-a-visual-guide-and-a-visual-review.md)). A decision made while reviewing a page is added here in the same pull request, with its date in the [log](#log) at the foot.

## 1. Principles

1. **One hand, at the table, at night.** The app is used on a phone during a live game, mostly indoors in low light. Anything that needs two hands, a long read or a bright screen is wrong for it.
2. **Figures first.** A page leads with the number the organizer came for. Labels are small and gray; figures are large and white.
3. **In place, not on top.** A choice opens where it was tapped: a list under its line, a panel out of its button, a line under its row. A dialog is for typing, or for a list too long to show in place.
4. **Few colors, each with one meaning.** Felt green is the ground, chip gold is the one accent. A color on screen says something: gold is attention or insurance, green is gain, red is loss.
5. **The same thing looks the same everywhere.** A game's row, a menu, a switch are one component each, used on every page. A change to one is a change to all of them.
6. **Rules are not design.** Money, odds and settlement follow the rules of the game in `packages/core`. A display fix changes the display only.

## 2. Color

Dark is the only mode, whatever the device is set to (2026-11-21). Nothing is designed, drawn or checked in a light theme.

### Tokens

| Token | Value | Used for |
| --- | --- | --- |
| `bg` | `#0e1b16` | The page |
| `surface` | `#13241e` | Cards, rows, menus, panels |
| `line` | `#26413a` | Borders, dividers, empty tracks. Also the fill of a chosen chip or pill |
| `text` | `#e7ede9` | Figures, names, whatever is in force |
| `muted` | `#93a59d` | Labels, captions, units, what is not chosen |
| `accent` | `#3f9a78` | Primary buttons, progress, the dealer's wage in charts |
| `highlight` | `#d6b04c` | The one accent: links to act on, amounts still out, the unsettled mark, focus rings, insurance |
| `win` | `#5cc79f` | A gain, with its plus sign. The charge labels on a game's row |
| `loss` | `#ef8a7f` | A loss, with its minus sign. Also what is overdue or set down as a bad debt, with its word |

Use the Tailwind names (`bg-surface`, `text-muted`, `border-line`). A hex value in a component is a defect.

### Chart colors

The four kinds of income keep one color each on every page that charts them:

| Kind | Color | Note |
| --- | --- | --- |
| Insurance | `highlight` | Red (`loss`) where it lost, and drawn the other way round |
| Wage | `accent` | The deeper green |
| Table fee | `table-fee` (`#a9e4c8`) | The lighter green |
| Rake | `rake` (`#6aa9e9`) | The only blue in the app |

They are listed in the order insurance, wage, table fee, rake. `table-fee` and `rake` are tokens in the stylesheet (`bg-table-fee`, `stroke-rake`) that nothing but a chart of income uses.

### Avatar grounds

A player's avatar is the first character of the name in bone on one of six deep grounds, `avatar-1` to `avatar-6` in the stylesheet, which a record falls on by its ID. They are quiet on purpose and carry no meaning; nothing else uses them.

### Contrast

Text meets WCAG 2.2 AA (4.5:1) on both `bg` and `surface`: `text` 13.6:1, `muted` 6.2:1, `highlight` 7.8:1, `win` 7.8:1, `loss` 6.6:1, `accent` 4.7:1. `line` is 1.5:1 and is never text. Color is never the only signal: a loss also has its minus sign, a switched-off option is also struck through, an unsettled game also has its word.

## 3. Type

- **Family:** Archivo Variable for Latin and figures, then the system's Chinese face (PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei). No other family in the interface. The brand's display faces are for the wordmark only.
- **Figures** are tabular everywhere, so columns line up and a running number does not jitter.
- **Sizes**, all from the Tailwind scale:

| Size | Used for |
| --- | --- |
| `text-4xl` semibold | The one headline figure of a page |
| `text-2xl` semibold | Page titles; a figure in the middle of a ring |
| `text-lg`, `text-base` medium | Section headings, a row's leading figure |
| `text-sm` | Body, labels, menus, buttons. The default |
| `text-xs` | Secondary lines: a date's second line, a row's parts, option labels |
| `text-[11px]` | Captions under a figure, chart labels. The smallest size for text that must be read |
| `text-[9px]` | Corner marks only |

- **Weight:** regular for labels, medium for what is chosen or tappable, semibold for titles and headline figures. No bold, no italics.
- **Money** uses the game's currency format, without needless cents, and the currency's mark (panda, kangaroo) rather than its name. A gain or loss shown as a result carries its sign.

## 4. Space and shape

- Spacing is the Tailwind 4px scale. Pages have 16px side margins, cards 16px of padding, rows 8px between them.
- **Radius:** `rounded-2xl` for a card that holds a section, `rounded-xl` for rows, buttons, menus and inputs, `rounded-lg` for chips and pills inside them, `rounded-full` for dots and round badges. A mark in a card's corner turns with the card's own corner.
- **Borders, not shadows.** A surface is set off by a 1px `line` border. Only something floating over the page (a menu, a panel) has a shadow as well.
- **Touch targets are at least 44px** in both directions. Small text may sit in a larger invisible target; two targets never overlap. One exception, the organizer's decision: the picked players' chips above 开局 stay 20px tall, since each can also be unpicked from its tile or its row.
- **Widths.** Phones first: the layout must hold at 360px, and is judged at 393 to 412px, which is where it is used. Three figure columns in a card fit four digits comfortably, five tightly and six at the limit at 393px; a seventh wraps to the title line and never runs under its neighbor. Tablets get the same pages, centered at a readable width.
- When a line cannot fit, its least important part wraps. Nothing is cut off with an ellipsis unless it is a name.

## 5. Components

Use what exists before making something new. Each is one file under `apps/web/src/components/`.

| Need | Component | Rule |
| --- | --- | --- |
| Page frame | `Page` | Title at the left, on every page. An emblem at the right leads back where a page has no tab of its own |
| A choice among a few | `TextMenu` | Text and a chevron; the list opens under it, in the page. The choice in force is white, the rest gray. No radio circles, frames or ticks |
| A saved setting | `ConfigMenu` | One tap switches, with no second confirmation. A dialog only past five saved entries |
| Options that can be on or off | Text switches | On in the option's own color, off gray and struck through |
| Typing a number | `TextField` | A tap selects the whole value. Money fills to two decimals on leaving, odds to one |
| A game in a list | `GameListRow` | The same row on every page that lists games |
| A filter with several parts | `IncomeFilter` | A framed button that grows into its panel. What is chosen counts when the panel is put away |
| A player | `PlayerAvatar` | Wherever a player is listed. A tap on it opens the player's page |
| A transfer made or not | `DoneButton` | An empty box until ticked, at the end of its line. The same on the settlement page and on 转账 |
| Help text | `InfoButton` | Explanations live behind the small (i), not on the page |
| Currency | `CurrencyIcon`, `ChipStack` | Marks, not words |

An item in a list that has nothing behind it (an income kind no game had, a filter with no match) is shown struck out and cannot be tapped, rather than hidden: the page keeps its shape.

## 6. Motion

Motion shows where something came from and that a figure changed. It never delays the organizer, and nothing loops except an alarm.

| Kind | Duration | Easing | Example |
| --- | --- | --- | --- |
| Small state change | 150 to 300ms | ease-out | A chevron turning, a color change |
| Opening in place | 250 to 350ms | ease-out to open, ease-in to close, shorter to close | A panel growing from its button, a line unfolding under a row |
| A figure changing | 500ms | ease-out cubic | Count up or down from the value shown |
| A page's figures arriving | about 1250ms in all | ease-out cubic | The total counts up as the ring turns in and the bar runs out, together |
| Leaving a list | 350ms | ease-in | A line confirmed as done closes up and moves off to the right as it fades |

- **A chart builds in the order it is read.** Its line is drawn from the left, the bars grow from the line, and what is written at a bar steps out of it last.
- **Direction means origin.** A panel grows from the button that opened it; a line unrolls from the figure it explains; a chart grows from its baseline. Closing is the same motion backward.
- **Content follows the container.** Lines inside a panel show once it has grown.
- **Things arriving in a list** come a short way into place out of nothing, one after another. Nothing flies across the screen.
- **Layout moves with its content.** When an item is ticked on or off, its part grows or shrinks and what stands on it moves with it; nothing jumps.
- **Once per arrival.** A page plays in when it is opened, and a card plays in again, all of it, when its period, days or filter change: what was already there does not stay put while the rest moves. Coming back to the page from a game, it is as it was left, at the place it was left, with nothing playing again; what changes after that plays as usual.
- **A line added to a chart is drawn in, and drawn back out when it is taken off.** The chart keeps room for it either way, so nothing else moves.
- **Reduced motion.** With motion turned down on the device, everything is in its final state at once.
- Use `useCountUp`, `useEntered` and `usePlaysIn` from `lib/motion.ts` and the `animate-*` tokens in the stylesheet. A new keyframe is added to the stylesheet with a line saying what it is for. No animation library.

## 7. Order and layout of a page

1. Title, with the emblem or actions at the right.
2. The headline card: what it is of and its period on one line, filters at the right of that line, then the figure. The figure stands right under that line in every card, at the same place, so the eye finds it by the title and not by whatever chart follows; figures that go with it sit at its right, and a chart starts a clear step below.
3. The breakdown of that figure.
4. Charts or trends, with their own controls inside their card. A card's title sits at its top left: a muted name, `·`, then the period as a menu with the count in brackets. A legend that also filters sits in one row under it, in the chart's columns.
5. Lists, newest first unless the organizer chose otherwise.

Fixed orders are kept everywhere they appear: insurance, wage, table fee, rake for charges; the app's own order for currencies; periods from the nearest to the widest (this week, last week, this month, last month, three months, six months, this year, all). A menu of periods or stages shows the number of games behind each choice in brackets.

What the organizer chose (period, filter, order, folded sections) is kept on the device and is there on the next visit. What was unfolded in a list is still unfolded when the page is come back to from a game.

A row that stands for a person or a game unfolds its lines under itself, and the lines lead on to the page that has the whole of it. A row with a single line has that line's control on itself and no chevron.

A tick that would take its line out of the list does not act at once: buttons come out from under the ticked lines, and the lines leave when one is tapped. The one that confirms is at the right, filled green; another thing that can become of the lines is at the left, tinted red where it is a step back. A button that does not apply to every ticked line is not shown. A switch that can simply be switched back still needs no confirmation.

**What a page opens on,** before the organizer has chosen anything: this month, panda points where there are any, and no other filter. Charts of periods open on four months.

## 8. Words

- Interface text is in the catalogs under `apps/web/src/i18n`, Chinese first, every language with it ([ADR 0047](../adr/0047-interface-text-in-typed-catalogs.md)).
- Chinese uses 设置 for anything saved or configured, never 配置.
- Where English is longer than the layout allows, the word is shortened or changed. The layout is not changed for it.
- Labels are nouns of two to four characters. Sentences belong behind an (i).

## 9. Do not

- A light theme, or any color outside the tokens and the chart colors.
- A second accent, gradients, glows, or shadows on things that do not float.
- A dialog for a choice among a few fixed options, or a second confirmation for a switch that can be switched back.
- Icons where a word is clearer, and words where the app already has a mark.
- Motion that loops, bounces, or makes the organizer wait before they can tap.
- A row, menu or switch built again for one page.

## 10. Known gaps

Things that do not follow this guide yet. A pull request that touches one of them fixes it.

- Type sizes `text-[15px]` and `text-[17px]` are in use beside the scale.
- English has not been read through page by page at 360px.
- Tablet layouts are the phone layouts centered; none has been designed for the width.

## Log

| Date | Change |
| --- | --- |
| 2026-11-24 | First version, from the app as built and the organizer's requests from 2026-11-07 to 2026-11-24 |
| 2026-11-24 | With 转账: the tick as a component, rows that unfold their lines, and unfolded rows kept on return |
| 2026-11-24 | Avatars and their six grounds, with the player's page |
| 2026-11-25 | A card's figure is placed by its title, the same in every card, with a step before its chart |
| 2026-11-24 | A line chart: a few round marks on each axis, shaded to its zero line, green or red by where it ends, a dot at the end; its days are picked in a dialog |
| 2026-11-24 | A chart's line is drawn first and its bars grow from it; the extremes are written at the bars, sliding outward |
| 2026-11-24 | Bad debts: red with its word, two buttons under ticked lines, marks side by side in a row's corner |
| 2026-11-24 | Ticks that remove a line wait for a confirm, lines leave with their own motion, single-line rows carry their control, and what pages open on |
| 2026-11-26 | The table fee and rake chart colors are tokens, `table-fee` and `rake` |
| 2026-11-26 | The picked players' chips keep their 20px; the income chart's span menu kept its width beside its legend (since replaced, see below); long initials in a row are cut short before the name |
| 2026-11-26 | A card's title at its top left, as a muted name, `·` and the period as a menu; a legend that filters in one row under it, one item over each column of the chart |
