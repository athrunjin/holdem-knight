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

### Google's button

The one exception to the app's colors (2026-11-27, [ADR 0052](../adr/0052-sign-in-with-google-and-a-first-entry-agreement.md)): signing in with Google is in Google's own dark button, as its guidelines for the button ask. Three tokens, `google-fill` (`#131314`), `google-line` (`#8e918f`) and `google-text` (`#e3e3e3`), and the G mark in Google's four colors (`public/google-g.svg`). Nothing but that button uses them, and it uses nothing else: not `accent`, not `highlight`. The label is in the app's own font.

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

- **Long reading text** (the terms and the privacy policy, `LegalText` in `account/`): `text-sm` at a 24px line (`leading-6`) in `text`, in the narrow column of a form (`max-w-md`), so a line holds about 32 Chinese characters or 65 Latin ones and never runs the width of a tablet. Under the title, a muted `text-xs` line with the date it took effect and its version. Each numbered section is a `text-base` medium heading, 24px from the one before, with 8px between its paragraphs; lists are bulleted with muted markers. An email address standing alone is a gold link 44px tall; inside a sentence it stays in the line, gold and medium.
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
| Page frame | `Page` | Title at the left, on every page. An emblem at the right leads back where a page has no tab of its own. One exception, the organizer's decision: 我的 has no title; its header is who is using the app at the left (avatar, name, a muted line with its (i)) and the role switch at the right, and its title is kept for readers only. Signed in, the header shows the account's name on the avatar of the host's own record, with its number, on both faces |
| Host or Player | `RoleSwitch` | A small pill of two segments, about 30px tall in a 44px target; one tap anywhere flips it. The chosen segment is filled with `line`, in `text` and medium weight; the other is muted. No gold. The role is kept on the device and shared by 牌局 and 我的 |
| 我的 for a Player | `PlayerFace` in `routes/me.tsx` | The host's own results as a player, from their own record (ADR 0051): two cards in one currency, the player page's (panda points where they have a settled game in them): the running result (the player page's curve, from the first game to now with no filter or tick), a whole-card link to their page, and the latest ten games' result and bars, which is not a link. With no settled game, one plain sentence and no empty chart. No payments card: what the host pays or is paid is on the Host face's 转账. While the games are read, nothing is shown under the header, as how many cards there are and how tall decides the face's height; the cards and the settings under them arrive together |
| A choice among a few | `TextMenu` | Text and a chevron; the list opens under it, in the page. The choice in force is white, the rest gray. No radio circles, frames or ticks |
| A saved setting | `ConfigMenu` | One tap switches, with no second confirmation. A dialog only past five saved entries |
| Options that can be on or off | Text switches | On in the option's own color, off gray and struck through |
| Typing a number | `TextField` | A tap selects the whole value. Money fills to two decimals on leaving, odds to one |
| A game in a list | `GameListRow` | The same row on every page that lists games |
| A filter with several parts | `IncomeFilter` | A framed button that grows into its panel. What is chosen counts when the panel is put away |
| A player | `PlayerAvatar` | Wherever a player is listed. A tap on it opens the player's page |
| The host's own record | `OwnTag` | A small muted pill reading Host after the name, the shape of the guest's sign-in pill but not gold, as it is a fact and not an action. On the own record wherever players are listed: first in the lists a game's players are picked from, in the player list and on its page |
| A transfer made or not | `DoneButton` | An empty box until ticked, at the end of its line. The same on the settlement page and on 转账 |
| Signing in with Google | `GoogleButton` in `account/AuthParts.tsx` | Google's dark button (section 2), the full width of the column, 48px tall, `rounded-xl`: the 18px G at the left of its label, 12px apart, the two centered, `text-sm` medium. Above the email form on sign-in and sign-up, with 或 between them on a `line` hairline either side. Tapped, it is dimmed until the browser leaves. Coming back, a line at the top of the column says what happened: muted for a sign-in turned down at Google, an alert in gold for one that failed |
| Agreeing to the terms | `AgreeField` in `account/AuthParts.tsx` | The 20px box in a 44px target, in `accent`, beside one muted sentence that ticks it when tapped and holds no link. Under the sentence, the terms and the privacy policy as two gold links on a row of their own, each 44px tall, with a muted `·` between (the organizer's decision, 2026-11-27: a link inside a sentence is too small a target). Its issue sits under it all at the column's left edge, in line with the fields' issues, not under the links, where gold on gold could read as a third link (2026-11-27). On sign-up, and on the first-entry step |
| First entry | `FirstEntry` in `account/` | An account that has not agreed to the terms sees this in place of every page but the terms, with the tabs kept: the title at the left with no way back, a muted line with its address, the name prefilled, `AgreeField`, 开始使用, and 退出登录 centered under it as a link |
| Bringing guest records in | `GuestImportCard` in `account/` | On 我的, signed in, between the face and the settings, only while this device's guest records hold something not yet brought into this account (ADR 0053). One title line, muted 游客记录 `·` how many games, with 带进账户 at the right in gold. Tapped, it opens in place as ticked transfers' buttons do: the games, players and settings as rows of a muted name and a count, a muted sentence that the device keeps its records and it needs a connection, then 取消 at the left and 确认带入 at the right, filled green. While it runs both are dimmed and the right one says it is working; failed, a gold alert says only what is known (turned down, so nothing was brought in; or no answer, so all or none, and a retry makes no second copy) and the right one reads 重试. Done, the details close back up as what came of it opens in their place under the title line, so the card changes height as one: a green tick, the games, players and settings added in the confirmation's words and order, and those the account already had, only when there are any; one that adds nothing says 没有新的记录要带入. What opens, fails or is done is brought into view once the fold has settled and the pages read have landed, to the nearest edge and clear of the tab bar, at once with motion turned down. Done stays until the page is left. Focus follows: into the details when opened, back to 带进账户 on 取消, to what came of it when done. Signed in, what is under the face waits for the device's records to be read, so the card and the settings arrive together; the card plays in once for what it offers, not again when 我的 is come back to (2026-11-27) |
| Records not sent | The dot on 我的, in `AppShell` | Signed in, while any record of the account's books on this device waits to be sent: a 10px gold dot (`size-2.5`, `rounded-full`) centred on the top-right corner of 我的's icon, in the bottom and the side navigation, ringed off it in `surface` (`border-2`) as a line chart's end dot is. It takes no space and is no target; readers hear 有记录未发送 after the tab's label. It appears with `animate-appear` and goes at once. Nothing else at the top of a page says that records wait |
| How the account's books stand | `SyncRow` in `account/` | Signed in, the first row of 我的's settings card, above 语言, as tall as its rows: 同步 at the left with a muted `text-xs` line under it, 上次同步 and the last read from the account as an absolute time (今天 20:15, else 11月28日 20:15), none if never read on this device. At the right the state in `text-sm`, muted (已全部发送, 发送中, N 条待发送, N 条待发送 · 未联网) or gold for N 条没有发送, and one gold text button 44px tall: 立即同步, dimmed while sending or offline, or 重试 once a record is turned down. A send is told only once it has run 600ms. Where they do not fit, the state wraps under the label, starting at its left edge, and the button keeps its size on the first line. The header's line on 我的 says the state with no count, from the same status |
| A record the account turned down | The refusal alert, `SyncStatus` in `layout/` | At the top of every page of the account's books while the first waiting record is turned down, in the frame of a read failure (`rounded-xl`, `line` border, `surface`, 16px side margins): N 条记录没有发送 in gold, then a muted line naming what it stopped at in the app's words (that game's start and the kind: 牌局, 账目, 保险, 结算, 一位玩家, 一个保存的设置; 删除 before a deletion) and that the records are on this device, with an (i) at its end holding one plain sentence and the answer's code only, as 代码 400; the line's last few characters stay with the (i), whose focus ring is drawn round the icon. 导出备份 (outline) and 重试 (gold text) on a row of their own at the right, each 44px tall; 导出备份 exports from wherever it is. It opens in place and what is under it moves with it, closes the same way backward, and stays put across pages |
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
- **Something of no fixed height opens by its grid row.** `animate-unfold` ends at a 4rem height and would cut off anything taller, so a block whose height depends on its text, as the refusal alert, opens by a transition of its grid row from `0fr` to `1fr` with its opacity (350ms ease-out) and closes the same way backward (250ms ease-in); what is under it moves with it.
- **Reduced motion.** With motion turned down on the device, everything is in its final state at once.
- Use `useCountUp`, `useEntered` and `usePlaysIn` from `lib/motion.ts` and the `animate-*` tokens in the stylesheet. A new keyframe is added to the stylesheet with a line saying what it is for. No animation library.

## 7. Order and layout of a page

1. Title, with the emblem or actions at the right.
2. The headline card: what it is of and its period on one line, filters at the right of that line, then the figure. The figure stands right under that line in every card, at the same place, so the eye finds it by the title and not by whatever chart follows; figures that go with it sit at its right, and a chart starts a clear step below.
3. The breakdown of that figure.
4. Charts or trends, with their own controls inside their card. A card's title sits at its top left: a muted name, `·`, then the period as a menu with the count in brackets. A legend that also filters is a row of chips under it, in the chart's columns, each chip holding its name and its figure, with a clear step of space before the chart.
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

- A light theme, or any color outside the tokens and the chart colors. Google's button is the one exception (section 2).
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
| 2026-11-26 | A legend that filters as a row of chips, each holding its name and its figure, on a tint of `line` (half) so a muted figure stays readable, with a 16px step before the chart |
| 2026-11-26 | 我的 without a title: who is using the app at the left of its header and the role switch at the right; a guest's sign-in is a small gold outline pill after the name, inside the identity's link |
| 2026-11-26 | The role switch, shared by 牌局 and 我的 in place of two large buttons: two segments, the chosen one on `line`, one tap flips, kept on the device |
| 2026-11-26 | 我的 for a Host: previews of 收益 and 转账 as whole-card links with the income page's ring at a smaller size, then the settings as rows of one card |
| 2026-11-26 | A preview card that shows money names its currency by its mark after the title, muted at 18px (`size-4.5`, as in a game's row), a mark and not a control; a card with nothing to show has none |
| 2026-11-26 | Each preview card on 我的 shows what its page would open on, the view kept there or the page's own defaults, so its figures equal the page's; 转账 also opens on panda points where there are any, as 收益 does |
| 2026-11-26 | 我的 for a Player: the host's own record and its results, two cards in one currency, the curve a whole link and the bars not; nothing under the header until its games are read, as a stand-in would jump. The own record marked by a muted Host tag and listed first in the pickers; the header shows the account's name on its avatar and number |
| 2026-11-27 | Signing in with Google in Google's own dark button, the one exception to the app's colors; the agreement as one component for sign-up and the first-entry step, which stands in for every page until an account has agreed |
| 2026-11-27 | The agreement's links on a row of their own under its sentence, each 44px tall, rather than inside it |
| 2026-11-27 | The agreement's issue at the column's left edge, in line with the fields' issues |
| 2026-11-27 | Long reading text, for the terms and the privacy policy: the form's column, `text-sm` on a 24px line, numbered `text-base` headings, a muted line with the date and the version |
| 2026-11-27 | Bringing guest records into an account: a card on 我的 that opens in place with what will be brought, confirmed as ticked transfers are |
| 2026-11-27 | The guest import done in place: the details close as what came of it opens under the title line, and the card plays in once for what it offers |
| 2026-11-28 | An account's sync: a 10px gold dot on 我的 in place of the line at the top of every page, the 同步 row first in 我的's settings, and the refusal alert naming what it stopped at, with 导出备份 and 重试 |
| 2026-11-28 | The refusal alert opens and closes by its grid row, not `animate-unfold`, as its height is not fixed |
