# Test plan: table fee, wages and settlement UI

> Written for `eeaf651` and brought up to date for wage units, rounding modes and the game's time zone (#I-039, #I-040).
> Rules R4, R5 and R10 to R12, cases A-01, A-07 and A-08, and group H describe the current build. On the settlement
> page the organizer's card now leads and folds, which replaces what D-06, E-04 and E-07 say about its place. Cases A-06, A-09 and
> A-10 still describe the setup before PR #80, and sample backup 06 is a game from before it, charged as it was.
> See ADR [0025](../adr/0025-wage-segments-and-billing-units.md) and [0027](../adr/0027-wage-units-rounding-and-game-time-zone.md).

- Build: PR #81 (2026-11-12), on top of `main` `ad7fa4f`
- Pull requests: #68, #70, #71, #72, #80, #81
- Test link: <https://feat-wage-units-and-time-zon.holdem-knight.pages.dev> (PR #81's preview, with its own data)
- Live site, final check only: <https://holdem-knight.pages.dev>
- Decisions: ADR [0022](../adr/0022-table-fee-and-wages.md), [0023](../adr/0023-seat-time-follows-game-clock.md),
  [0024](../adr/0024-itemized-charges-and-waivers.md), [0025](../adr/0025-wage-segments-and-billing-units.md),
  [0027](../adr/0027-wage-units-rounding-and-game-time-zone.md); improvement log #I-029 to #I-033 and #I-039 to #I-041

## 1. Release notes

### #68 Table fee and wages

- Game setup has 台费 and 工资 switches. Turning one on loads last time's values, with 默认配置 as another preset.
- Defaults: a table fee of 100 in the game's currency after 30 minutes at the table, and wages of 25 an hour at all hours.
- Wages have collapsed advanced settings: a different rate for some hours of the day, or after the game has run some
  hours. Only one can be on.
- At settlement both come off each player's cash result and go to the organizer. The game header and the games list
  show 台费 and 工资 labels.

### #70 Only time while the game clock runs counts

- A clock not started means the game has not started, and a paused clock means it is paused. Nobody's time counts then.
- "开局 N 小时后" means once the clock shows N hours, skipping pauses.
- The clock's color says whether time counts: green while it runs, gold while it is paused or not yet started. Nothing is charged while it is gold.

### #71 Detail mode and itemized settlement

- 桌上玩家 has a 含费 switch in games with fees, on to begin with: a folded card then shows the player's charges
  and their result after them. Beside it, the 详细模式 switch, always off to begin with, opens each player's card on their Buy-in
  record, counted time (live), wages and table fee so far, and cash result less those charges.
- Settlement shows one card per person. Wages are listed per rate, such as `¥25/时 × 1小时40分`, then the table fee.
  Each charge has a box; unticking it waives that charge for that player.
- Each rate counts whole minutes and rounds to the cent on its own. Backups move to version 8.

### #72 Settlement summary and folding cards

- A larger 结果 title with the blinds, date and host (a placeholder), and tiles for total buy-in, clock time and balance.
- The imbalance handling and the insurance owner each take one row that opens the choices.
- Players' cards start folded: one main row and one small right-aligned line (分摊, 保险, 工资, 台费, then their sum in
  gray). A 明细 switch opens or folds them all.
- The organizer's card lists 台费收入, 工资收入, 保险 and 补齐差额 apart, then the total.

## 2. Rules

Expected results follow these rules. Bug reports cite the rule number.

| Rule | Statement |
| --- | --- |
| R1 | Time at the table starts at buy-in, stops on leaving, and starts again on 回桌. Time away does not count. Changing hands does not affect it. |
| R2 | Only time while the game clock runs counts. In a game whose clock was never started, everyone's time is 0 and no table fee or wages are charged. A game whose clock was started before #70 has no pause history, so it counts from buy-in to leaving. |
| R3 | Table fee: at most once per player per game, charged once their counted time reaches the minimum in minutes. A minimum of 0 charges everyone. The amount must be above 0, and the minimum a whole number from 0 to 1440. |
| R4 | Wages, in games started on this build: a player's counted time is cut into billing units (1, 15, 30 or 60 minutes) from when they sat down, with pauses and time away left out. A part unit at the end counts as a whole one when it is half or more (四舍五入, the default), always (向上取整) or never (向下取整), and one that counts runs on past the moment they left. Each unit is charged at the rate that covers more of it, or the higher rate on a tie. Each rate rounds half up to the cent. Example: ¥20 before midnight, ¥30 after, 30-minute units, 向上取整, 23:16 to 0:13 is 30 minutes at ¥20 and 30 at ¥30. Earlier games keep the charging they started with. |
| R5 | Rates by time of day (时段设置) and by game clock time (开局时间设置) can both be on, up to 3 of each and 4 in all; where both apply the higher rate wins. Time segments follow the game's time zone (R11). A game that starts inside them begins in them: inside their hours when the last one has an end, or within 12 hours of the first one's start when it has none. Otherwise they begin the next time the first one's hour comes round. On a daylight saving night they switch when the local clock shows their hours. Rates may be 0. |
| R6 | Table fees and wages change only cash results and go to the organizer. Chips and the table balance are unaffected. All cards' totals, the organizer's included, add up to 0, unless the difference is left unhandled (不做处理). |
| R7 | Waivers apply to one charge: a player's table fee, or a player's wages at one rate. They lock once the game is settled and can change again after 修改对局结果. A waived charge also drops out of detail mode. |
| R8 | Fees are worked out for the whole game from the settings at settlement. Changing a rate during the game reprices all counted time, not only the time after the change. |
| R9 | Last time's values: turning a switch on loads the latest game that had that option. With no earlier game, or after choosing 默认配置 in the config picker at the top right of game setup, the switches start off. Changing any number shows 自定义. |
| R10 | Backups are version 12. Backups from versions 1–11 still restore. An older app refuses a version 12 backup as newer. |
| R11 | Each game keeps the time zone it was started in, and rates by time of day follow it on every device. A game from before this build uses the viewing device's time zone. Dates on the page still show in the device's time. |
| R12 | Settlement tells players how they were charged. Each player's card shows their Buy-in record, then 在桌 (time sat, to the second) and, with wages, 计费 (time charged). The settings icon at the end of the line under the blinds opens the game's rules in brief under the header, to read only, in the order 保险, 工资, 台费: for insurance, whether tie cards count, whether a hit hands back the premium and the odds for 1, 3, 8 and 9 outs; the table fee with its minimum time; and the wage rates some player was charged at with the unit and rounding. An info icon beside the rules opens 计费规则 in words. The shared image carries those rules. |

## 3. Environment and data

### Environment

- Use the test link above. It runs the same code as `main` with its own data. The live site cannot delete games, so
  never restore sample backups there.
- Cover at least iPhone Safari, including the app added to the home screen, and Android Chrome.
- Run the UI cases once in light mode and once in dark mode.
- The preview link and the live site do not share local data, and clearing browser data removes test games.

### Suggested settings

- Wages of **¥60 an hour** (exactly ¥1 a minute), a table fee minimum of **2 minutes**, and a 1:1 chip ratio make the
  numbers easy to check by hand.
- To test two rates live, use the time-of-day rate from the current hour to the next, and let the game cross the hour.
- The after-hours rate needs at least an hour. Sample backup 06 covers it without waiting.

### Sample backup 06

The file is [`apps/web/sample-backups/06-table-fee-and-wages.json`](../../apps/web/sample-backups/06-table-fee-and-wages.json).
On the phone, open it on GitHub, tap **Download raw file**, then on the test link go to 我的 → 数据备份 → 恢复备份.
The game is dated 2026-01-06 and is already settled. The clock ran 19:00–21:00, paused for 20 minutes, then ran from
21:20 to settlement. The table fee is ¥20 after 60 minutes, and wages are ¥30 an hour, then ¥50 an hour once the clock
shows 3 hours.

| Player | Counted | Wages by rate | Table fee | Wages | Total |
| --- | --- | --- | --: | --: | --: |
| 张伟 | 4小时40分 | ¥30 × 3小时00分; ¥50 × 1小时40分 | ¥20 | ¥173.33 | +¥216.67 |
| 刘洋 | 1小时29分 | ¥30 × 1小时29分 (89 minutes 30 seconds, the part minute not charged) | ¥20 | ¥44.50 | -¥64.50 |
| 王芳 | 45分 | ¥30 × 45分 | 未满 | ¥22.50 | -¥72.50 |
| 李娜 | 2小时50分 | ¥30 × 1小时40分; ¥50 × 1小时10分 (left for 50 minutes, then 回桌) | ¥20 | ¥108.33 | -¥488.33 |
| 组织者 | — | 台费收入 ¥60 + 工资收入 ¥348.66 | — | — | +¥408.66 |

Transfers, best plan, 4 in all: 李娜 → 组织者 ¥408.66, 李娜 → 张伟 ¥79.67, 王芳 → 张伟 ¥72.50, 刘洋 → 张伟 ¥64.50.
The full expected results for every sample are in [`EXPECTED.md`](../../apps/web/sample-backups/EXPECTED.md).

## 4. Test cases

Priorities and severities are defined in the [testing README](README.md).

### A. Game setup

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| A-01 | P0 | Defaults | On a fresh test link with no earlier fees, turn on 工资 and 台费. | Wages ¥25.00/小时, 计费方式 精确到分, 取整方式 四舍五入, 分段薪资 folded. Table fee ¥100.00, 在桌满 10 分钟. Both presets show 默认配置. |
| A-02 | P0 | Last time's values | The previous game had custom fees. Start a new game. | Both switches start on, the preset shows 上次配置 with the previous values, and the preset list has 上次配置 and 默认配置. |
| A-03 | P1 | Switching presets | With 台费 on: 1. pick 默认配置 2. change any number. | 1. The defaults return. 2. The preset shows 自定义. |
| A-04 | P1 | Currency symbol | Change the currency to 澳元. | The fee and wage inputs show $. |
| A-05 | P0 | Table fee checks | Enter amounts 0, blank, -5 and 1.234, and minimums 1.5, 1441 and 0, then tap 开局. | Amounts show 必须大于 0 or 请输入有效的数字 and block the start. Minimums 1.5 and 1441 are invalid. A minimum of 0 is allowed (R3). |
| A-06 | P1 | Wage checks | Leave the hourly rate blank and start, then enter 0 and start. | Blank is invalid and blocks the start. 0 is allowed (R5). |
| A-07 | P0 | Both kinds of segment | Open 分段薪资, turn on 时段设置 and 开局时间设置, and add rows until no more can be added. | Both stay on. At most 3 rows of each kind and 4 in all. With both on, a note says the larger rate applies. |
| A-08 | P1 | Time segment checks | In 时段设置, pick hours from the lists: give the first row no end and try to add another; then chain two rows and make them cover more than 24 hours. | Only the last row may have no end, and none can follow it. Each later row starts where the one before ends. Overlap or more than 24 hours is refused. |
| A-09 | P1 | After-hours checks | Enter 0, 49, 1 and 48 hours. | 0 and 49 are invalid. 1 and 48 start. |
| A-10 | P1 | Saved configs | 1. Tap 保存当前配置 and name it. 2. On a new game, pick it in the config picker at the top right. 3. Pick 默认配置 there. | 2. The fees match what was saved. 3. 台费 and 工资 turn off (R9). |
| A-11 | P1 | Changing settings mid-game | In an open game, tap the settings icon in the header, turn off 台费, change 工资 and save. | In the header 台费 turns gray and struck through. Settlement prices the whole game with the new settings (R8). |

### B. Timing

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| B-01 | P0 | Clock not started | A game with fees and players, Start not tapped. 1. Look at the game page. 2. Wait 3 minutes and settle. | 1. The clock reads Start in gold, with no notice, and detail mode shows 在桌 0:00:00. 2. Folded cards have no fee line. Expanded, there is no wage line and the table fee shows 未满. There is no organizer card (R2). |
| B-02 | P0 | Starting the clock | As above, tap Start. | The clock turns green and each player's time ticks every second. |
| B-03 | P0 | Pause and resume | With the clock running, pause for 2 minutes, then resume. | While paused the clock is gold and times stop. On resuming it turns green, times carry on, and the 2 minutes do not count. |
| B-04 | P0 | Leaving and 回桌 | With the clock running, one player leaves and taps 回桌 3 minutes later. | Their time stops while away and carries on after 回桌. Settlement counts both stretches (R1). |
| B-05 | P1 | Joining late | After 10 minutes on the clock, add a player. | Their time starts from 0. |
| B-06 | P1 | Removing a mistake | A player with only 1 hand and nothing else, removed with −. | They are not in the settlement and are not charged. |
| B-07 | P1 | Changing hands | With the clock running, add 2 hands to a player, then remove 1. | Their time is unaffected. |
| B-08 | P2 | Older games | A game whose clock was started before #70, if any. Turn on wages and settle. | Time counts from buy-in to leaving, regardless of pauses (R2). |

### C. Detail mode during the game

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| C-01 | P0 | Default | Open a game with fees and one without. | With fees, 含费 and 详细模式 sit at the top right of 桌上玩家: 含费 starts on and 详细模式 off, and each folded card has a line with 工资, 台费 and 合计. Without fees there is no 含费 switch, and 详细模式 starts off. |
| C-02 | P0 | What it shows | A game with fees, clock running. | Each player's first row is unchanged. Below it, as on their settlement card: the Buy-in record folding from 带入, 带出 with the current time and chips, 在桌 H:MM:SS with 计费, 工资 at each rate and 台费 (the amount, or 未满 差 N 分 with a dash), each charge with a box, then 合计 with 结算并下桌 (green for a win, red for a loss). |
| C-03 | P0 | Checking the numbers | Wages ¥60 an hour, table fee ¥100 after 2 minutes, 1:1. After 3 minutes on the clock, set a player's stack 100 above their buy-in. | 台费 -¥100.00, 工资 -¥3.00, 合计 -¥3.00 (100 − 100 − 3). |
| C-04 | P1 | The switch | Turn it off and on, then leave and reopen the game. | The details hide and show without changing data, and 含费 stays as it was. Turning 含费 off takes the line of charges off the folded cards, and leaves 详细模式 as it was. Reopening the game resets both switches. |
| C-05 | P1 | Games without fees | Turn detail mode on in a game without fees. | The Buy-in record, 带出 and 合计 show, with no time or charges. |
| C-06 | P1 | The insurance seat | A game with insurance, detail mode on. | The insurance row shows no details. |
| C-07 | P1 | Waivers carry over | Waive a player's table fee at settlement, then tap 返回牌桌. | Detail mode shows the table fee struck through with its box unticked, and 合计 no longer subtracts it (R7). |
| C-08 | P0 | Settling one player | Open a player's card and tap 结算并下桌 once. Tap again while it is lit. | First tap: the button lifts, reads 确认结算 and its green fill runs out from the right over 5 seconds, and the player's Buy-in and chips blink and stay gold. Second tap: the player moves to 已离桌 with the chips on the page, and no dialog opens. |
| C-09 | P0 | The light goes out | Tap 结算并下桌 once and wait 5 seconds, then tap once more. | After 5 seconds the button reads 结算并下桌 again and nobody has left. The next tap only lights it again. |
| C-10 | P1 | A double tap | Tap 结算并下桌 twice as fast as you can. | The button is lit and the player is still at the table. |
| C-11 | P1 | Waiving from the game page | Untick a player's table fee on their open card, then settle the game. | 合计 on the card drops the fee at once, and the settlement page shows the same box unticked. |

### D. Settlement amounts

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| D-01 | P0 | Sample 06 in full | Restore sample backup 06, open the 2026-01-06 game, go to 结算 and turn on 明细. | Each player's wage lines, table fee and total, the organizer's +¥408.66 and the 4 transfers match section 3. |
| D-02 | P0 | Table fee threshold | A minimum of 2 minutes. One player leaves after 2:05 counted, another after 1:50. Settle. | The first pays the fee. The second shows 台费 ¥100/人 · 未满 2 分钟 with a dash for the amount (R3). |
| D-03 | P0 | Wage rounding | ¥25 an hour. Leave after 61:30 counted and settle. | The line reads ¥25/时 × 1小时01分 with -¥25.42 (R4). |
| D-04 | P0 | Two rates by time of day | ¥120 an hour for the current hour, ¥60 otherwise. Start the clock 5 minutes before the hour and settle 5 minutes after. | Two wage lines, one per rate, each with the right time and amount, adding up to the wages in total. |
| D-05 | P1 | Two rates after some hours | Sample 06, 张伟's details. | ¥30/时 × 3小时00分 -¥90 and ¥50/时 × 1小时40分 -¥83.33. |
| D-06 | P0 | Going to the organizer | Any game with fees, the organizer's card. | 台费收入 is the sum of table fees and 工资收入 the sum of wages. The total is the sum of its lines, and all cards' totals add up to 0 (R6). |
| D-07 | P0 | Waiving a table fee | Before settling, untick a player's table fee, then reload the page. | The line turns gray and struck through. The player's total rises by the fee, the organizer's table fee income falls, and the transfers update. The waiver survives the reload (R7). |
| D-08 | P1 | Waiving one wage rate | A player with two wage lines. Untick one. | The other is still charged, and the folded line counts only what is still charged. |
| D-09 | P0 | Locked once settled | Tap 确认结算 and try a box, then tap 修改对局结果 and try again. | After settling a box does not change: the page scrolls until 积分管理 is at the bottom and 修改对局结果 is ringed in gold. After 修改对局结果 the boxes change again. |
| D-10 | P1 | Fees and a difference | Unbalanced books, for example by recording extra chips on leaving. Try each handling. | 按比例分摊 adds 差额分摊 to the winners' cards, as the last line, under the table fee. 组织者补齐 adds 补齐差额 to the organizer's card. 不做处理 adds neither. |
| D-11 | P1 | Fees and insurance | Insurance with a result. Set the owner to the organizer, a player, then 单独列出. | The owner's card gets a 保险 line, or a separate 保险 card appears. All totals are right. |
| D-12 | P2 | Australian dollars | A game in AUD. Settle. | Every amount shows $ and is formatted correctly. |

### E. Settlement page

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| E-01 | P0 | Summary | Open any settlement. | The header is the game page's: the blinds, the currency's icon and their cash value, and under it the Buy-in in big blinds, the four option labels and the settings icon, with the emblem on the right, which is a picture only. Below, a line with the organizer's ID (guest for now) and the start date, weekday and time. Three centered tiles: 总 Buy-in · the number of Buy-ins over their cash value; 时长 (clock time, or — without a clock); and 牌桌平衡 with a green tick, or a red cross over 水上多 or 水下多 and the difference in cash. A tap on the first or the last switches its figure to chips and back, each on its own. The cards sit under 对局总览. |
| E-02 | P0 | Imbalance row | Unbalanced books, no handling chosen. 1. Look at the page. 2. Tap the row and pick one. 3. Tap it again and choose 取消. | 1. The row reads 差额 ±N 筹码（¥）· 未选择处理方式, and the results area says 选择差额处理方式后显示结果。 2. Three choices open, and picking one closes them and shows the results. 3. Nothing changes. With balanced books there is no row. |
| E-03 | P0 | Insurance owner row | A game with insurance. Tap the 保险 · 归属 row. | 组织者, 单独列出 and each player open, with a check on the current one. Picking one updates the row. |
| E-04 | P0 | Folded cards | A game with fees, as it opens. | Players' cards are folded. The amount column shows the total (green, red, or gray for 0). A small right-aligned line below lists 分摊, 保险, 工资 and 台费 in that order, where present, then 含费 or 含调整 in gray. With one item there is no sum. A group waived in full shows 已免. |
| E-05 | P0 | Opening one card | Tap a player's first row, then tap it again. | It opens: wages by rate, the table fee, the boxes and the total, with the arrow turned. The second tap folds it. |
| E-06 | P0 | The 明细 switch | 1. Open one card only. 2. Tap 明细. 3. Tap it again. | 1. The switch is off. 2. All cards open and the switch is on. 3. All fold. |
| E-07 | P1 | Games without fees | No fees, no insurance, balanced books. Settle. | Each player has a one-row card with no line below. There is no organizer card and no 明细 switch. |
| E-08 | P1 | Alignment and overflow | A very long player name and a 7-digit chip count. Settle and open the cards. | All amounts (main rows, lines and totals) share one right edge. Long names truncate without squeezing the numbers, and large amounts stay inside the card. |
| E-09 | P1 | Touch | On a phone, tap the text of a fee line, the switch and the choice rows. | Whole rows respond, without precise aiming. |
| E-10 | P1 | Themes | View settlement and detail mode in light and dark mode. | Text and chips are readable. Gray sums, gold notes and red and green amounts are easy to tell apart. |
| E-11 | P1 | The rest of the page | A game with fees. Open the transfers, make the image, then 确认结算. | Transfers match the card totals. The image shows each card's total. After confirming, the button reads 修改对局结果. |
| E-12 | P2 | Landscape and tablets | Landscape on a phone, or an iPad. | The layout holds, with no sideways scrolling. |

### F. Data and compatibility

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| F-01 | P0 | Backup round trip | A game with fees, a waiver and a paused clock. Export a backup, restore it on another browser or device on the test link, and open the settlement. | The settlement matches, waivers and times included. |
| F-02 | P1 | Older backups | Restore a backup exported before this release, or an older sample. | It restores without errors (R10). |
| F-03 | P1 | Home screen app update | An older version added to the home screen. Open it. | The update prompt appears. After updating, the new features work and existing games remain. |
| F-04 | P2 | Offline | A game with the clock running. Go offline, switch away from the app and back. | Times show the real elapsed time, not the time when the network dropped. |

### G. Regression

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| G-01 | P0 | Games without fees | Restore samples 01–05 and settle each. | Results and transfers match `EXPECTED.md`. |
| G-02 | P1 | Insurance | A game with insurance. Work through one hit and one miss with 算保险. | The flow and the table's chips behave as before. |
| G-03 | P1 | Collector | Open 积分管理, tap the plan at the top left of the section and pick a 代收人, then another. | The list reads 最优方案, 代收人：the organizer's ID, then one line for each player. One tap picks and closes the list. Transfers go through the collector with the right amounts. |
| G-04 | P1 | Settling from the table | Restore sample 07 and tap 结算 → 一键离桌并结算. | Everyone leaves and the settlement is right. |
| G-05 | P0 | The plan a game starts with | Open the settlement of a game with insurance, a table fee or wages, then of a game with none of them. | The first opens with 积分管理 expanded and the organizer collecting, named by their ID. The second starts with it closed, and a tap opens the optimal plan. |
| G-06 | P1 | The plan after settlement | On a settled game with nothing ticked, change the plan, leave the page and come back. | The plan changes without 修改对局结果 and is still the chosen one on return. Charges and the difference handling stay locked. |
| G-07 | P1 | Leaving the settlement page | On the settlement of a game being settled, tap 返回牌桌 beside 确认结算. Then tap the emblem and, in a game with insurance that goes to the organizer, the 保险 row on the organizer's card. | 返回牌桌 leads to the game page, where the game can be recorded again. The emblem and the 保险 row do nothing. On both pages the row reads a calculator icon and 保险, starting under the first letter of the organizer's ID. On the game page it opens 算保险. |
| G-08 | P0 | Ticking transfers off | Open 积分管理 on a settled game with several transfers. Tick one transfer, then the box on the plan's line, then that box again. Tick two, leave the page and come back. | Every box starts empty. A ticked transfer is dimmed and struck through. The box on the plan's line ticks them all, and clears them all when all are ticked. The line under the transfers reads 共 n 笔（已收 the number ticked / n）. A rule runs under the plan's line and another over the line with the count. Ticks are kept on return. |
| G-09 | P2 | Sharing a transfer | Tap the share icon on the plan's line and on a transfer. | Both say 这个功能还在开发中. 生成图片 still makes the image. |
| G-10 | P0 | A plan with a transfer made | Tick one transfer and tap the plan. Clear the tick and tap it again. | With a tick: a dialog says 存在已完成的转账 and the plan does not change. Without: the list of plans opens as usual. |
| G-11 | P0 | Pending until everything is in | Settle a game with several transfers, tick some and open the games list. | Under the transfers there is no 归档牌局, only a small 返回主界面 at the right, which opens the games list. The game is listed under 历史对局 with a gold 未结清 tag before its date. |
| G-12 | P0 | Complete with the last tick | Tick every transfer and open the games list. | The game stays in 历史对局 and its tag turns to a green 已结清, without any further step. Choosing 已结清 beside the title lists it. |
| G-13 | P1 | A game follows its ticks | On a game that is 已结清, clear one tick. Then tick it again. | It is 未结清 again, and then 已结清 again. |
| G-14 | P0 | Before the results are confirmed | Tap 结算 on a game and confirm. On the settlement page open 积分管理, tap a transfer's box and the box on the plan's line. Change the handling of a difference or a charge's box. | Nothing is ticked: 确认结算 comes into view with a gold ring for a moment. The results change, and the transfers follow at once. |
| G-15 | P1 | Nothing to transfer | Settle a game in which nobody won or lost. | 积分管理 says 没有输赢，不需要转账, and the game is 已结清 in 历史对局 at once. |
| G-16 | P0 | The games list | Open the games list with games at the table, one being settled, settled ones and one with everything ticked. Tap a game in each part. | From the top: 进行中 with the games at the table, 结算中 with the one being settled, then 历史对局, each with its number of games. The first two are missing while they have no game. On a first visit all three are unfolded. Folded, 历史对局 has nothing on its line but the number and the chevron. Each row shows when the game started on two lines: the day as 26/11/14, and under it the day of the week and the time as 周六·21:05. A game at the table opens on its table, and every other game on its settlement page. Fold a part, open a game and come back, then close and reopen the app: the list is as it was left, with its folds, stage, filters and order. |
| G-17 | P0 | Changing a settled result | On a settled game with nothing ticked, tap 修改对局结果. Confirm again, tick a transfer, and tap 修改对局结果 once more. Try 取消, then 确定. | The first tap goes straight back to 确认结算. With a tick, a dialog asks 已有积分转移被记录，是否删除并修改对局结果？ 取消 changes nothing. 确定 clears the ticks and the page shows 确认结算 again. |
| G-18 | P1 | Back to the table | From a game being settled tap 返回牌桌, then open the games list. Do the same from a settled game. | The first is at the table again, under 进行中, and can be recorded. The second shows its table without anything to tap, and stays in history. |
| G-19 | P0 | Narrowing and ordering history | With 历史对局 unfolded, tap the stage after the title and pick 未结清, then 已结清. Tap 对局时间 and pick 过去一周, then 过去一个月. Tap 积分类型 and pick the panda, then the kangaroo. Switch 保险 off, then tap All twice. Tap the funnel, and the order icon twice. | The heading reads 历史对局 · 全部 (n) ⌄ on one baseline, in ASCII parentheses, with the stage chosen, then the number of games listed and a chevron, newest first. The filter, order and fold icons sit close together at the right, the fold under the ones of the parts above. Every row has its stage as a tag before the date, gold 未结清 or green 已结清, and nothing under the date but the day of the week and the time. The filters are on show from the start: 对局时间 and 积分类型 on one line, each with its choice in white and a chevron, then 对局配置 with every option on in its own color and All in white. A menu lists its choices with the one in force in white, and a currency shows as its mark alone. The list keeps only the games of that stage, started in that time and in that currency, or says 没有符合条件的牌局. With 保险 off it is struck through in gray, All turns gray, and games with insurance are left out; All switches every option off, which leaves the games without any, then on again. The funnel is filled while the filters show and hides them on a tap, and is gold while any filter is set. The order icon puts the oldest first and turns gold, then the newest first again. |
| G-20 | P0 | Starting a game | Look at the navigation on a phone and on a tablet, on the games list and inside a game. Tap 开局. | The round K◇K badge with 开局 under it sits in the middle of the tabs, covers nothing on the bars above it, and opens 开局设置. The games list has no start button of its own. |
| G-21 | P1 | Menus in the page | In 开局设置 tap 积分, then 计费方式 and 取整方式 under 工资, then 翻牌 and 转牌 beside 保费上限 under 保险. Pick a choice in each, and tap outside an open one. Under 保费上限 pick 自定义, enter 60, then pick 自定义 again. | Each opens a small menu in the page right under the choice, not a dialog, with the choice in force in white and the rest in gray. 积分 lists each currency as its mark and name. A tap outside closes the menu and changes nothing. 自定义 asks for a percentage in a dialog; the line then reads 60%, the menu lists 自定义（60%）, and picking it again opens the dialog with 60. No menu runs off the screen on a phone. |

### H. Wage units, rounding and time of day

Use a base rate of ¥20, 时段设置 "0点（凌晨）" with no end at ¥30, and 精确到30分, unless a case says otherwise.
Cases around midnight need a game played across a real midnight, with the clock running.

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| H-01 | P0 | Rounding list | Turn on 工资 and tap 取整方式. Open its info button. | A menu opens in the page under the choice, with 四舍五入 (in white by default), 向上取整 and 向下取整 in gray. The info explains all three, the longer-rate rule and an example. |
| H-02 | P0 | A unit across two rates | 向上取整. A player sits at 23:16 and leaves at 0:13. Settle and open their card. | 在桌 0:57:00 or a few seconds more · 计费 1小时00分, then ¥20/时 × 30分 -¥10 and ¥30/时 × 30分 -¥15: the second unit, 23:46–0:16, has 16 minutes after midnight (R4). |
| H-03 | P0 | A tie takes the higher rate | 向上取整. A player sits at 23:45 and leaves at 0:15. | One line: ¥30/时 × 30分 -¥15. |
| H-04 | P0 | The three rounding modes | No segments, 精确到30分. Players leave after 44, 45 and 59 minutes. Settle under each 取整方式 (change it in 设置 and reopen settlement). | 四舍五入: 30分, 1小时00分, 1小时00分. 向上取整: 1小时00分 for all three. 向下取整: 30分 for all three. A player under 30 minutes with 向下取整 has no wage line and 计费 0分. |
| H-05 | P1 | Time away does not start a new unit | 向上取整, no segments. A player sits 20 minutes, leaves, taps 回桌 later and sits 40 more. | 在桌 1:00:00 or a few seconds more · 计费 1小时00分, with nothing added. |
| H-06 | P0 | Starting inside a segment | 时段设置 22点 to 6点 at ¥40, base ¥25. Start the clock at about 23:00, play an hour and settle. | All time is at ¥40 (R5). Before this build it was all at the base rate. |
| H-07 | P1 | A segment with no end | "0点" with no end. Start one game at about 1:00 and another in the afternoon. | The 1:00 game is at the segment's rate from the start. The afternoon game is at the base rate until midnight. |
| H-08 | P0 | Another time zone | A settled game with a time segment. Export a backup, restore it on a phone in another time zone, or change this phone's time zone, and open the settlement. | Every wage line and total is the same (R11). The start time in the summary shows in the phone's time. |
| H-09 | P2 | Daylight saving night | In a zone with daylight saving, a segment from 0点 to 6点 on the night the clocks change. | The segment ends when the local clock shows 6:00, an hour earlier or later than usual in real time. |
| H-10 | P0 | The game's settings | A game with insurance, wages with three time segments of which players only sat in two, and a table fee. Settle and tap the settings icon in the header. Tap the three dots, then the info icon, then 生成图片. | Plain lines open in a box under the header. 保险 has 平分牌算 or 不算 outs and 击中退 or 不退保费 on its first row, and odds such as 1赔30 3赔10 8赔3.5 9赔3 on a second row lined up under them, followed by three dots. 工资 has the base rate and the two segments used, not the third, then the unit and rounding. 台费 has the amount and minimum time. The dots open 赔率表 with every outs count. The info icon opens 计费规则 with 工资 and its rules, then 台费 and its rule, then what time counts. Tapping the settings icon again folds the lines. The image carries the rules (R12). |
| H-11 | P0 | Earlier games keep their amounts | A game with wages settled before this build, with its settlement noted down. Update the app and open it. | Every wage line and total is unchanged. |
| H-12 | P1 | Carrying a rule over | The latest game was started before this build with 向上取整 on or off. Start a new game. | 取整方式 shows 向上取整 or 向下取整 to match, and the new game is charged by R4. |
| H-13 | P0 | The organizer's card | A game with fees. Settle, then tap the organizer's first row twice. | Under 对局总览 a title row reads 组织者, Buy-in, 筹码, 水上/下 and 金额, then a folded card named by the organizer's ID (guest for now), with dashes under the first three and a line such as 工资 +¥115.00 台费 +¥200.00 with no sum. Then the players' title row and the players. Open, the card always lists 保险, 工资, 台费 and 抽水, with a dash for any the organizer does not receive, then 合计. 明细 opens and folds it with the others. A game where the organizer receives nothing has only the players' title row. |
| H-14 | P1 | Settings by what is on | Settle one game with only wages, one with only insurance, and one with none of the options. | The first shows only a 工资 line and the second only 保险. The third says 这局没有开启保险、工资或台费。 |
| H-15 | P1 | Two decimals | Settle a game with whole and fractional amounts and open the cards. | Every amount in the cards shows two decimals, such as +¥150.00 and -¥10.00: first rows, detail lines, totals and the folded line. They share one right edge, and the shared image's amounts match. |
| H-16 | P1 | Columns | A game with 12 and 25 buy-ins, four-digit chips and wins. Settle and open a player's card. | Buy-in counts sit centered under their title, and chips and 水上/下 fit with their separators. The open lines are as close together as the organizer's. |
| H-17 | P0 | The clock stops for settlement | A game with wages and the clock running. Tap 结算 and, if asked, 一键离桌并结算. Wait a few minutes on the settlement page, then tap 返回牌桌. | 时长 and every 在桌 time stay as they were on arrival. Back on the game page the clock shows the same time, paused, and can be resumed. |

## 5. Bug reports

Fill in:

- A title naming the area and the problem, for example "Settlement: organizer total unchanged after waiving a table fee".
- The case ID and the rule broken, for example D-07 / R7.
- Environment: the link, phone model, OS version, browser or home screen app, light or dark mode.
- Data: ideally a backup exported from 我的 → 数据备份 → 导出备份.
- Steps, actual result and expected result.
- A screenshot or recording. For amounts, capture the whole card.

Severity levels are in the [testing README](README.md).

## 6. Exit criteria

- Every P0 case passes, run in full at least once on iOS Safari and once on Android Chrome.
- No S1 or S2 bug is open.
- At least 95% of P1 cases pass, and each one that does not has a decision: fix, accept or defer.
- Settlements for sample backups 01–07 match `EXPECTED.md`.

## 7. Known limitations

These are not bugs:

- The host shows the placeholder {主持人} until organizers have names (M6).
- The shared image shows one total per person, without the fee lines.
- A charge can only be waived in full, not changed, and the organizer always receives the charges.
- A clock started late cannot be corrected, so time counts only from when it started.
- Time-of-day rates use the phone's local time zone.
- Rake (抽水) is not released and shows 开发中.
- The 详细模式 switch is not saved and resets each time a game opens.
