# Test plan: table fee, wages and settlement UI

- Build: `main` `eeaf651` (2026-11-09)
- Pull requests: #68, #70, #71, #72
- Test link: <https://feat-settlement-summary.holdem-knight.pages.dev> (the same code as `main`, with its own data)
- Live site, final check only: <https://holdem-knight.pages.dev>
- Decisions: ADR [0022](../adr/0022-table-fee-and-wages.md), [0023](../adr/0023-seat-time-follows-game-clock.md),
  [0024](../adr/0024-itemized-charges-and-waivers.md); improvement log #I-029 to #I-033

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
- In a game with fees, the game page says 对局计时器未开始 or 已暂停，台费和工资暂不计时 while the clock is not running.

### #71 Detail mode and itemized settlement

- 桌上玩家 has a 详细模式 switch, on by default in games with fees. It shows each player's counted time (live), table
  fee, wages so far, and cash result less those charges.
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
| R1 | Time at the table starts at buy-in, stops on leaving, and starts again on 返回. Time away does not count. Changing hands does not affect it. |
| R2 | Only time while the game clock runs counts. In a game whose clock was never started, everyone's time is 0 and no table fee or wages are charged. A game whose clock was started before #70 has no pause history, so it counts from buy-in to leaving. |
| R3 | Table fee: at most once per player per game, charged once their counted time reaches the minimum in minutes. A minimum of 0 charges everyone. The amount must be above 0, and the minimum a whole number from 0 to 1440. |
| R4 | Wages: each player pays for their own counted time. Each rate counts whole minutes, a part minute is not charged, and the amount rounds half up to the cent. Example: ¥25 an hour for 61 minutes 30 seconds charges 61 minutes, ¥25.42. |
| R5 | One advanced rate at a time. By time of day: local phone time, whole hours 0–23, start and end differ, and the range may cross midnight (22 to 2). After some hours: a whole number of hours from 1 to 48, applying once the clock shows that long. Rates may be 0. |
| R6 | Table fees and wages change only cash results and go to the organizer. Chips and the table balance are unaffected. All cards' totals, the organizer's included, add up to 0, unless the difference is left unhandled (不做处理). |
| R7 | Waivers apply to one charge: a player's table fee, or a player's wages at one rate. They lock once the game is settled and can change again after reopening it. A waived charge also drops out of detail mode. |
| R8 | Fees are worked out for the whole game from the settings at settlement. Changing a rate during the game reprices all counted time, not only the time after the change. |
| R9 | Last time's values: turning a switch on loads the latest game that had that option. With no earlier game, or after choosing 默认配置 in the config picker at the top right of game setup, the switches start off. Changing any number shows 自定义. |
| R10 | Backups are version 8. Backups from versions 1–7 still restore. An older app refuses a version 8 backup as newer. |

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
| 李娜 | 2小时50分 | ¥30 × 1小时40分; ¥50 × 1小时10分 (left for 50 minutes, then 返回) | ¥20 | ¥108.33 | -¥488.33 |
| 组织者 | — | 台费收入 ¥60 + 工资收入 ¥348.66 | — | — | +¥408.66 |

Transfers, best plan, 4 in all: 李娜 → 组织者 ¥408.66, 李娜 → 张伟 ¥79.67, 王芳 → 张伟 ¥72.50, 刘洋 → 张伟 ¥64.50.
The full expected results for every sample are in [`EXPECTED.md`](../../apps/web/sample-backups/EXPECTED.md).

## 4. Test cases

Priorities and severities are defined in the [testing README](README.md).

### A. Game setup

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| A-01 | P0 | Defaults | On a fresh test link with no earlier fees, turn on 台费 and 工资. | Table fee ¥100, 在桌满 30 分钟才收. Wages ¥25/小时 (全天). The preset shows 默认配置. Advanced settings are collapsed. |
| A-02 | P0 | Last time's values | The previous game had custom fees. Start a new game. | Both switches start on, the preset shows 上次配置 with the previous values, and the preset list has 上次配置 and 默认配置. |
| A-03 | P1 | Switching presets | With 台费 on: 1. pick 默认配置 2. change any number. | 1. The defaults return. 2. The preset shows 自定义. |
| A-04 | P1 | Currency symbol | Change the currency to 澳元. | The fee and wage inputs show $. |
| A-05 | P0 | Table fee checks | Enter amounts 0, blank, -5 and 1.234, and minimums 1.5, 1441 and 0, then tap 开局. | Amounts show 必须大于 0 or 请输入有效的数字 and block the start. Minimums 1.5 and 1441 are invalid. A minimum of 0 is allowed (R3). |
| A-06 | P1 | Wage checks | Leave the hourly rate blank and start, then enter 0 and start. | Blank is invalid and blocks the start. 0 is allowed (R5). |
| A-07 | P0 | One advanced rate | Open the advanced settings, turn on 按时段设置时薪, then 开局一段时间后改时薪. | The first turns off. Only one is on at a time, and the inputs follow. |
| A-08 | P1 | Time-of-day checks | Set both hours to 5, then the start to 24, then turn the option off with the wrong value left and start. | 开始和结束不能相同. 24 is invalid. An option that is off does not block the start. |
| A-09 | P1 | After-hours checks | Enter 0, 49, 1 and 48 hours. | 0 and 49 are invalid. 1 and 48 start. |
| A-10 | P1 | Saved configs | 1. Tap 保存当前配置 and name it. 2. On a new game, pick it in the config picker at the top right. 3. Pick 默认配置 there. | 2. The fees match what was saved. 3. 台费 and 工资 turn off (R9). |
| A-11 | P1 | Changing settings mid-game | In an open game, tap 设置, turn off 台费, change 工资 and save. | The header labels update. Settlement prices the whole game with the new settings (R8). |

### B. Timing

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| B-01 | P0 | Clock not started | A game with fees and players, Start not tapped. 1. Look at the game page. 2. Wait 3 minutes and settle. | 1. 对局计时器未开始，台费和工资暂不计时。 shows, and detail mode shows 在局 0:00:00. 2. Folded cards have no fee line. Expanded, there is no wage line and the table fee shows 未满. There is no organizer card (R2). |
| B-02 | P0 | Starting the clock | As above, tap Start. | The notice goes away and each player's time ticks every second. |
| B-03 | P0 | Pause and resume | With the clock running, pause for 2 minutes, then resume. | While paused the notice says 已暂停 and times stop. They carry on after resuming, and the 2 minutes do not count. |
| B-04 | P0 | Leaving and 返回 | With the clock running, one player leaves and taps 返回 3 minutes later. | Their time stops while away and carries on after 返回. Settlement counts both stretches (R1). |
| B-05 | P1 | Joining late | After 10 minutes on the clock, add a player. | Their time starts from 0. |
| B-06 | P1 | Removing a mistake | A player with only 1 hand and nothing else, removed with −. | They are not in the settlement and are not charged. |
| B-07 | P1 | Changing hands | With the clock running, add 2 hands to a player, then remove 1. | Their time is unaffected. |
| B-08 | P2 | Older games | A game whose clock was started before #70, if any. Turn on wages and settle. | Time counts from buy-in to leaving, regardless of pauses (R2). |

### C. Detail mode during the game

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| C-01 | P0 | Default | Open a game with fees and one without. | With fees, 详细模式 at the top right of 桌上玩家 starts on. Without fees, it starts off. |
| C-02 | P0 | What it shows | A game with fees, clock running. | Each player's first row is unchanged. Below it, two columns: 在局 H:MM:SS, 台费 (the amount, or 未满 差 N 分 in gold), 工资, and 含费水上 or 含费水下 (green for a win, red for a loss). |
| C-03 | P0 | Checking the numbers | Wages ¥60 an hour, table fee ¥100 after 2 minutes, 1:1. After 3 minutes on the clock, set a player's stack 100 above their buy-in. | 台费 ¥100, 工资 ¥3, 含费水下 -¥3 (100 − 100 − 3). |
| C-04 | P1 | The switch | Turn it off and on, then leave and reopen the game. | The details hide and show without changing data. Reopening the game resets the switch to its default. |
| C-05 | P1 | Games without fees | Turn detail mode on in a game without fees. | Only 在局 and 水上 or 水下 show. |
| C-06 | P1 | The insurance seat | A game with insurance, detail mode on. | The insurance row shows no details. |
| C-07 | P1 | Waivers carry over | Waive a player's table fee at settlement, then reopen the game. | Detail mode shows 台费 ¥0, and the result no longer subtracts it (R7). |

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
| D-09 | P0 | Locked once settled | Tap 确认结算 and try a box, then tap 重新打开牌局 and try again. | The boxes cannot change after settling, and can after reopening. |
| D-10 | P1 | Fees and a difference | Unbalanced books, for example by recording extra chips on leaving. Try each handling. | 按比例分摊 adds 差额分摊 to the winners' cards. 组织者补齐 adds 补齐差额 to the organizer's card. 不做处理 adds neither. |
| D-11 | P1 | Fees and insurance | Insurance with a result. Set the owner to the organizer, a player, then 单独列出. | The owner's card gets a 保险 line, or a separate 保险 card appears. All totals are right. |
| D-12 | P2 | Australian dollars | A game in AUD. Settle. | Every amount shows $ and is formatted correctly. |

### E. Settlement page

| ID | Priority | Case | Preconditions and steps | Expected |
| --- | --- | --- | --- | --- |
| E-01 | P0 | Summary | Open any settlement. | A large 结果 title. A small line with the blinds and currency, the date with weekday and time, and Host：{主持人}. Tiles for 总买入 (amount · hands), 时长 (clock time, or — without a clock) and 平衡 (✓ 平衡, or 不平衡 ±N). |
| E-02 | P0 | Imbalance row | Unbalanced books, no handling chosen. 1. Look at the page. 2. Tap the row and pick one. 3. Tap it again and choose 取消. | 1. The row reads 差额 ±N 筹码（¥）· 未选择处理方式, and the results area says 选择差额处理方式后显示结果。 2. Three choices open, and picking one closes them and shows the results. 3. Nothing changes. With balanced books there is no row. |
| E-03 | P0 | Insurance owner row | A game with insurance. Tap the 保险 · 归属 row. | 组织者, 单独列出 and each player open, with a check on the current one. Picking one updates the row. |
| E-04 | P0 | Folded cards | A game with fees, as it opens. | Players' cards are folded. The amount column shows the total (green, red, or gray for 0). A small right-aligned line below lists 分摊, 保险, 工资 and 台费 in that order, where present, then 含费 or 含调整 in gray. With one item there is no sum. A group waived in full shows 已免. |
| E-05 | P0 | Opening one card | Tap a player's first row, then tap it again. | It opens: wages by rate, the table fee, the boxes and the total, with the arrow turned. The second tap folds it. |
| E-06 | P0 | The 明细 switch | 1. Open one card only. 2. Tap 明细. 3. Tap it again. | 1. The switch is off. 2. All cards open and the switch is on. 3. All fold. |
| E-07 | P1 | Games without fees | No fees, no insurance, balanced books. Settle. | Each player has a one-row card with no line below. There is no organizer card and no 明细 switch. |
| E-08 | P1 | Alignment and overflow | A very long player name and a 7-digit chip count. Settle and open the cards. | All amounts (main rows, lines and totals) share one right edge. Long names truncate without squeezing the numbers, and large amounts stay inside the card. |
| E-09 | P1 | Touch | On a phone, tap the text of a fee line, the switch and the choice rows. | Whole rows respond, without precise aiming. |
| E-10 | P1 | Themes | View settlement and detail mode in light and dark mode. | Text and chips are readable. Gray sums, gold notes and red and green amounts are easy to tell apart. |
| E-11 | P1 | The rest of the page | A game with fees. Open the transfers, make the image, then 确认结算. | Transfers match the card totals. The image shows each card's total. After confirming, the button reads 重新打开牌局. |
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
| G-03 | P1 | Collector | Choose 代收人 in the transfer plan and change who collects. | Transfers go through the collector with the right amounts. |
| G-04 | P1 | Settling from the table | Restore sample 07 and tap 结算 → 一键离桌并结算. | Everyone leaves and the settlement is right. |

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
