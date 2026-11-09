# Improvement log

Records discussions of feature and process improvements: what was proposed, how it was decided and why.

- When work starts, create a GitHub issue and add its number to the entry. Scheduling still follows the [roadmap](ROADMAP.md).
- Confirmed rules go in [CONTEXT](CONTEXT.md), and decisions that affect the long-term structure go in an [ADR](adr/). This file only links to them.
- Entry numbers increase and are never reused. When an entry's status changes, move it to the matching section and keep its content.

## Entry format

```markdown
### #I-001 Title

- Type: feature / process
- Date: date proposed, followed by the decision date
- Source: live game trial / everyday use / discussion
- Problem: what's wrong today and in what situation
- Proposal: what to change; list candidates if undecided
- Decision: do / don't do / defer, and why
- Tracking: issue, PR and ADR links
```

## Under discussion

### #I-019 Insurance for a preflop all-in

- Type: feature
- Date: proposed 2026-11-06
- Source: discussion
- Problem: the guided hand shows 翻牌未发出 as disabled, marked as in development, because insurance only covers the next single card.
- Proposal: to be discussed. Pricing the flop would need its own odds.
- Decision: not decided.
- Tracking: none yet

## Decided, waiting for development

(none)

## Done

### #I-001 Default game settings: CNY and a 1:1 chip ratio

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: the defaults were AUD and 100 chips = 1 unit of currency, which didn't match how games are actually run.
- Proposal:
  - A new game carries over the last game's settings. This already worked and needed no change.
  - With no previous game, default to CNY and 1 chip = 1 yuan. The rule is recorded in CONTEXT.
- Note: `DEFAULT_GAME_SETTINGS` only applies when there are no games at all. On a phone with existing games,
  new games still carry over the old settings, so CNY and 1:1 have to be selected once by hand.
- Decision: do. Released after passing a trial on a real device with the preview build.
- Tracking: issue #20, PR #23

### #I-002 Buying in by hands

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: buy-ins and rebuys both needed a typed chip count, which is slow at the table.
- Proposal:
  - Add "one buy-in = xx big blinds" to game settings. It defaults to 100 big blinds and carries over from the last game.
  - Chips per hand = multiple × big blind amount, converted with the chip ratio. If the result isn't a whole number of chips, the settings page shows an error.
  - After adding a player, choose how many hands they buy: a whole number, default 1, using +/− or by typing. The matching chips and amount are shown.
  - Ledger events still record chips. Hands are only for entry and display, so settlement doesn't change.
  - Cash-outs are still entered in chips, because a stack at the end usually isn't a whole number of hands.
  - Changing blinds mid-game follows the temporary approach in #I-004: chips per hand stop changing after the first record.
- Impact: `Game` gains optional fields and the backup format adds them too. The data model change gets an ADR, as the standards require.
  Older games without these fields keep recording chips.
- Decision: do. Released after passing a trial on a real device with the preview build.
- Tracking: issue #21, PR #23, [ADR 0010](adr/0010-buy-in-hands.md)

### #I-003 One row per seated player and quick rebuys

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: each player took a three-line card, so a full table didn't fit on one screen, and a rebuy meant opening a dialog and typing.
- Proposal:
  - One row per player, with at least 8–9 seated players on one screen.
  - Each row has the name, the hand count with − and + on either side, and cash out. Total bought in appears in small text under the name.
  - Tapping + or − changes the count by 1 hand. Tapping the count lets you type a target. Both take effect immediately with no confirmation.
  - Players who have left go at the bottom of the list in a separate section, set apart from seated players. They can still rebuy to sit back down.
  - Estimated for a 375px wide phone: about 150px for the name and a row height of about 52px, meeting the 44px touch target. Measured at 375×812: 9 players fit on one screen.
  - "Add player" moves above the list, with suggestions collapsed until the field is tapped. "Settle" moves to the top right of the page.
- Ledger rules: the ledger is append-only, so numbers can't be edited directly.
  - Increase: record a rebuy for the added hands.
  - Decrease: reverse the latest buys. If that takes off too much, record the difference again,
    and write both in the same transaction.
  - At least 1 hand always remains. To cancel a buy-in completely, undo it from the log.
- Decision: do. Released after passing a trial on a real device with the preview build.
- Depends on: #I-002
- Tracking: issue #22, PR #23, [ADR 0010](adr/0010-buy-in-hands.md)

### #I-005 Collapsible game record

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: the ledger history takes up space below the player list during a game.
- Proposal:
  - Rename 流水 to 牌局记录 (game record), collapsed by default, with a record count in the header.
  - Tap the header to expand or collapse it. A long list also gets a collapse button at the bottom, so nobody has to scroll back up.
  - Collapsing and expanding is view state only and doesn't touch the ledger.
- Decision: do. Released in PR #30.
- Tracking: issue #25, PR #30

### #I-006 Set blinds in chips

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: blinds are entered as money, but players at the table think in chips.
- Proposal:
  - Enter small and big blinds in chips, with the cash equivalent shown under the fields.
  - Store blinds as chips on `Game`. Chips per hand become multiple × big blind chips, so the "not a whole number of chips" error goes away.
  - Show blinds without a currency, for example `1 / 2`, on the game list, game page and settlement image.
- Impact: changes the data model, so it needs an ADR, a local database upgrade and a new backup version that still reads version 1 files.
  Older games are converted with their chip ratio.
- Settled details: blinds are whole chips, matching the ledger. At 1:1 a ¥0.5 small blind needs a different chip ratio.
- Decision: do. Released in PR #30.
- Tracking: issue #26, PR #30, [ADR 0011](adr/0011-chip-blinds-and-live-stacks.md)

### #I-007 Live stack and win/loss on each player row

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: the organizer can see what each player bought but not where they stand now.
- Proposal:
  - Add a chip cell to each seated player's row. It starts at the amount bought, and tapping it lets you type a new value.
  - Show win/loss as chips − bought, with a sign and a color: + in one color, − in another, and 0 neutral. It replaces the bought amount under the name.
  - Once a stack has been typed, changing hands adds or subtracts directly, with a minimum of 0.
    Example with 500 chips per hand: King is at 700, one more hand makes 1200, and one hand fewer from 700 makes 200.
- Ledger rules: a new append-only `stack_set` event records each typed value, so it can be undone like other records.
  Replaying events has to apply a reversed buy as a change to the stack at that point, or the example above would stay at 700.
- Layout: at 375px the name gets 77px (about 4–5 Chinese characters) after the stack cell, hand controls and leave button, and 9 players fit on one screen. Longer names are truncated.
- Impact: new event type in the backup format; needs an ADR.
- Settled details:
  - Win/loss and the table balance are in chips, matching the stack next to them.
  - Typed stacks appear in the game record, so they can be audited and undone. Tapping the chip cell opens a small dialog, like tapping the hand count.
  - Each player keeps one row with short names, because two rows would fit only about 6–7 players on a screen.
- Decision: do. Released in PR #30.
- Tracking: issue #27, PR #30, [ADR 0011](adr/0011-chip-blinds-and-live-stacks.md)

### #I-008 Rename cash out to leave table, with a confirmation dialog

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: leaving the table needs a final check of hands and chips, and today the dialog only asks for chips.
- Proposal:
  - Rename 兑出 to 离桌 (leave table) across the game page, game record and settlement notice.
  - The dialog shows the player's current hands and chips, both adjustable. Chips start at the current stack, and changing hands follows the #I-007 rule.
  - Confirming records the cash-out and moves the player to the left section. Cancelling changes nothing.
- Depends on: #I-007
- Decision: do. Released in PR #30.
- Tracking: issue #28, PR #30

### #I-009 Live table balance

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: mistakes in stacks only show up at settlement, after everyone has left.
- Proposal:
  - Replace the 场上 (in play) tile with a live balance: chips cashed out + seated stacks − chips bought.
  - 0 means the table balances. Any other value shows its sign in a warning color.
  - The balance stays at 0 until a stack is typed. After a win is entered, it stays off until the matching losses are entered too.
- Depends on: #I-007
- Decision: do. Released in PR #30.
- Tracking: issue #29, PR #30

### #I-010 Back button on the settlement page

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: once the books balance, the settlement page has no way back to the game except the bottom navigation.
- Proposal: add a back button to the page header that returns to the game, in every settlement state.
- Decision: do. Released after passing a trial with the preview build.
- Tracking: issue #31, PR #34

### #I-011 Results first on the settlement page

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: the organizer wants each player's outcome before anything else, and today it's below the transfers and shows only cash.
- Proposal:
  - Rename 输赢 to 结果 (results) and put it at the top.
  - Each row shows the player's name, hands bought, chips remaining, total win/loss in chips and the amount in currency.
  - Chips remaining means the total the player left with, across every time they sat down.
  - Older games without hands show a dash in that column.
  - The shared image uses the same content and order.
- Decision: do. Released after passing a trial with the preview build.
- Tracking: issue #32, PR #34

### #I-012 Collapsible transfers with a collector option

- Type: feature
- Date: proposed, decided and completed 2026-11-04
- Source: discussion
- Problem: the fewest-transfers plan is the only option, but games often run through one person who collects and pays everyone.
- Proposal:
  - Collapse the transfer plan by default, with the transfer count in the header.
  - Offer two plans: the optimal plan (today's fewest transfers), and a collector plan.
  - In the collector plan, every loser pays the collector and the collector pays every winner, so nobody else settles with each other.
  - Add the calculation to `core` with a property test that every player ends at 0.
- Settled details:
  - The collector can be any player in the game, or an organizer who isn't playing.
  - The chosen plan is saved with the game, so it survives reopening and matches the shared image.
  - The shared image always shows the chosen plan in full, without collapsing.
- Decision: do. Released after passing a trial with the preview build.
- Tracking: issue #33, PR #34, [ADR 0012](adr/0012-settlement-collector.md)

### #I-013 Balance check and leave-all when settling

- Type: feature
- Date: proposed, decided and completed 2026-11-05
- Source: discussion
- Problem: tapping settle with players still seated only shows a notice, so everyone has to leave one by one and the balance is only checked at the end.
- Proposal:
  - Tapping settle opens a dialog that says whether wins and losses balance, and by how much if not.
  - If players are still seated, offer "leave all and settle", which cashes out every seated player at their current stack in one transaction.
  - Each cash-out stays in the game record and can be undone separately.
  - If everyone has left and the books balance, go straight to the settlement page.
- Decision: do. Released after passing a trial with the preview build.
- Tracking: issue #35, PR #37

### #I-014 Settling with unbalanced chips

- Type: feature
- Date: proposed, decided and completed 2026-11-05
- Source: discussion
- Problem: settlement is blocked until the chips balance, but at a real game a difference sometimes can't be traced.
- Proposal:
  - Allow settling with a difference. Choosing that shows three options:
    - Split in proportion to win/loss.
    - The organizer tops up a shortfall, or collects an excess.
    - Leave it unhandled.
  - The difference is chips cashed out − chips bought. Above 0, players took out more than went in, so someone has to pay it. Below 0, chips are left over.
  - A split comes off the side that is too large, in proportion to each player's result, using `allocate` so the shares add up to exactly the difference.
    Example: with 200 too much on the win side, winners of 3000 and 1000 give up 150 and 50. With too much on the loss side, losers pay less in the same way.
- Impact: `netCents` currently refuses unbalanced books, so settlement calculations need to change, along with the results table and shared image. Saving the choice is a data model change and needs an ADR.
- Settled details:
  - Only players on the side that is too large share a split. Anyone who broke even isn't affected.
  - The organizer gets a 组织者 row in results and is a party in transfers under both plans.
  - When unhandled, transfers pay as far as they can and the remaining difference shows as a warning.
  - The choice is saved with the game, can be changed on the settlement page until settlement is confirmed, and appears in the shared image.
  - Unbalanced books always need a choice before settling. There's no default.
  - Results show adjusted amounts with a note explaining the split. Win/loss in chips keeps the real figures.
  - An even split between all players was tried first and replaced after review, because it charged players who broke even.
- Depends on: #I-013
- Decision: do. Released after passing a trial with the preview build.
- Tracking: issue #36, PR #37, [ADR 0013](adr/0013-unbalanced-settlement.md)

### #I-015 Return to the table instead of rebuying

- Type: feature
- Date: proposed, decided and completed 2026-11-05
- Source: discussion
- Problem: a player who left can only come back through 补码, which forces a new buy, when they usually just sit back down.
- Proposal:
  - Replace 补码 on players who have left with 返回 (return).
  - Tapping it puts them back in the seated list, and the game continues as normal: hand controls, stack and leaving all work as before.
  - Under the append-only ledger, this reverses their latest cash-out, and their stack becomes the chips they left with.
- Settled details: they come back with the chips they left with, with no confirmation, because leaving again undoes it.
- Decision: do. Released after passing a trial with the preview build.
- Tracking: issue #38, PR #41

### #I-016 Remove undo from the game record

- Type: feature
- Date: proposed, decided and completed 2026-11-05
- Source: discussion
- Problem: undoing individual records alongside hand controls, typed stacks and leaving makes the logic hard to follow.
- Proposal:
  - Remove 撤销 from the game record, which becomes read-only.
  - Corrections go through normal controls: −/+ for hands, the chip cell for stacks, and 返回 after a mistaken leave.
  - Reversals stay as an internal ledger mechanism, so the ledger is still append-only.
- Settled details: undo was the only way to remove a first buy-in, so tapping − at 1 hand offers to remove a player added by mistake. It needs a confirmation and only works when their buy-in is their only record.
- Decision: do. Released after passing a trial with the preview build.
- Tracking: issue #39, PR #41

### #I-017 Chronological game record with dates and a player filter

- Type: feature
- Date: proposed, decided and completed 2026-11-05
- Source: discussion
- Problem: the record shows newest first with only a time, and there's no way to follow one player.
- Proposal:
  - Show records from the start of the game, oldest first.
  - Add the date to each timestamp, for example 11/05 11:28.
  - Add a player filter that shows only that player's records, also in time order.
- Settled details:
  - Reversals appear as their own rows in time order, such as 减手 and 返回, rather than striking out the original. Older games show the same way.
  - The filter is a dropdown, because buttons for 9 players would take several lines.
- Decision: do. Released after passing a trial with the preview build.
- Tracking: issue #40, PR #41

### #I-018 Insurance rules and multiway calculation

- Type: feature
- Date: proposed and decided 2026-11-05, completed 2026-11-06
- Source: discussion
- Problem: M3 needs insurance that each organizer can set up their own way, works when several players are all in, and records premiums and payouts at the table.
- Proposal:
  - The host turns insurance on when starting a game, and picks last time's setup, a built-in table or a saved rule. Rules can be edited and saved under a name.
  - The rule covers odds by outs, the outs limit, whether tie cards count, whether a flop all-in can insure the turn, the pot player limit, premium caps by street, and whether a hit refunds the premium.
  - Picking cards shows every pot with its leader, each opponent's outs, equity, odds and the price of both covers. Entering an outs count gives a quick price.
- Settled details:
  - 保险 is a seat in the game, not a player: the name is reserved, it starts with one hand, shows last and cannot leave.
  - Everything is paid in chips at the table. If the seat cannot pay, it buys enough whole hands in the same step.
  - At settlement its result goes to the organizer by default, or a chosen player, or its own row, and the result is labeled either way.
  - A hit does not refund the premium by default. New games default to the table where 1 out pays 30.
- Changes from trying it at the table:
  - Each all-in is one guided hand: add players, choose how far the board is, then buy, deal and settle each street. It resumes if the page is left.
  - 保本 and 满池 leave the buyer their stake or pot share after the premium, with and without a refund. A quote locks once bought or declined.
  - A tied lead cannot be insured, unless the leaders have equal chances and another player in the pot is behind them.
  - Entered stacks update the table at once. Finishing a hand shows a summary, then updates all-in players and the seat.
  - A player who cannot pay a premium buys whole hands after a prompt. A cover is assumed to have enough behind.
  - Dialogs stay above the phone keyboard.
- Decision: do. Released after trials on a real device with the preview builds.
- Tracking: issue #42, PR #43, #44, #45, #46, #47, #48, ADRs [0014](adr/0014-insurance-seat.md), [0015](adr/0015-insurance-moves-only-the-seat.md), [0016](adr/0016-insurance-hands.md), [0017](adr/0017-finished-hand-sets-stacks.md), [0018](adr/0018-short-premium-buy-in.md), [0019](adr/0019-entered-stack-updates-table.md)

### #I-020 Games overview by role, status and game options

- Type: feature
- Date: proposed, decided and completed 2026-11-06
- Source: discussion
- Problem: the overview mixed open and settled games in one list, and each row showed blinds and status but not the game's currency or options.
- Proposal:
  - Host and Player switch at the top, leaving room for the player view. Player is a placeholder until M7.
  - 进行中 starts expanded and 历史对局 starts collapsed.
  - Each row shows currency, blinds and only the options that are on, in small colored text, plus the start time.
  - Only 保险 exists on games today. 台费, 工资 and 抽水 join the same list once games have those settings.
- Decision: do. Merged after checks at phone size in the browser preview.
- Tracking: issue #50, PR #51

### #I-021 Compact game setup with one row per setting

- Type: feature
- Date: proposed and decided 2026-11-06
- Source: discussion
- Problem: the new game form showed every input at once, so currency, chip ratio, blinds and buy-in took most of a phone screen before the insurance settings.
- Proposal:
  - The page is titled 开局设置, centered at the top.
  - 货币, 筹码, 盲注 and Buy in each take one row with the label on the left and the current value on the right.
  - Tapping a row opens a dialog for that setting, with the first input selected so a number can be typed right away, and 确定 to return.
- Settled details:
  - 修改设置 shares the form, so it gets the same rows. Locked settings show as disabled rows.
  - Each dialog validates before returning, so the rows only ever show valid settings. 取消 discards the change.
  - The new 开局设置 title applies to the page only. The home button stays 开一局.
- Decision: do.
- Tracking: issue #52, PR #53

### #I-022 Saved game configs and option switches on game setup

- Type: feature
- Date: proposed and decided 2026-11-06
- Source: discussion
- Problem: starting a game only carried over the latest game's settings, so regular setups had to be re-entered, and the options a game can have were not visible together.
- Proposal:
  - A small picker beside the 开局设置 title shows the config in use, 上次配置 by default.
  - It lists 恢复默认, 上次配置 and saved configs. Picking one asks 是否使用xxxx: confirming returns to the form, cancelling returns to the list.
  - 保险, 抽水, 台费 and 工资 follow the basic settings in that order, as switches that expand when on. All are off by default.
- Settled details:
  - Saved configs are whole setups: currency, chips, blinds, Buy in and insurance. 保存当前配置 in the picker stores one, a repeated name overwrites it, and each can be deleted.
  - Using a config only fills the form, so games keep their own copy.
  - 上次配置 stays the starting point, so insurance is on if the latest game had it. Off by default applies with no earlier game and after 恢复默认.
  - 抽水, 台费 and 工资 show 开发中 and their switches are not saved until those settings exist. 台费 and 工资 arrived in #I-029.
  - Backups include saved configs from version 5, and older backups still restore.
- Decision: do.
- Tracking: issue #54, PR #55

### #I-023 Tidier game setup and no pot player limit

- Type: feature
- Date: proposed and decided 2026-11-06
- Source: discussion
- Problem: the setup page listed every insurance rule as a button, saving a config was hidden in the picker, the Buy in row gave no cash value, and the pot player limit went unused.
- Proposal:
  - The Buy in row shows one hand in chips and cash.
  - 保存当前配置 sits beside the start button, which stays the wider of the two.
  - Insurance rules are picked from a dropdown, and picking one opens the details.
  - The pot player limit is removed.
  - A 查看demo button follows 修改赔率和规则, showing 开发中 for now.
- Settled details:
  - The limit is gone from the rules and the calculation, so a rule that set one no longer blocks a pot. This replaces the pot player limit in #I-018.
  - Picking a rule applies it at once. Unlike a whole config, it needs no confirmation.
  - The details also open when the rule has errors, so they are not hidden.
- Decision: do.
- Tracking: issue #56, PR #57

### #I-024 Game header with options and cash, and a small add-player button

- Type: feature
- Date: proposed and decided 2026-11-06
- Source: discussion
- Problem: the game page did not show which options were on or what the blinds and one hand were worth, and the add-player field took a full row above the player list.
- Proposal:
  - A reserved line under the blinds shows the same option labels as the overview.
  - The cash value of the blinds follows them in small muted text.
  - One hand shows as `1 手 100 筹码/¥100`.
  - Adding a player is a small plus under the player list and above the insurance seat, with no prompt row.
- Settled details:
  - The plus opens a dialog with the search, which keeps a short hint so pinyin search stays discoverable.
  - The overview and the game page share one component for the option labels.
  - Settled games show the same header, without the plus.
- Decision: do.
- Tracking: issue #58, PR #59

### #I-025 Seated players as a titled table

- Type: feature
- Date: proposed, decided and completed 2026-11-06
- Source: discussion
- Problem: seated players had no heading or column titles, the add button sat off to the left, and the hand step buttons outweighed the chip counts.
- Proposal:
  - Group the seated players into a 桌上玩家 section with a title row for 玩家, 筹码 and 手数.
  - Center the add button and make it about 50% smaller.
  - Make chip counts larger and the hand step buttons visually smaller.
- Settled details:
  - The add button sits at the foot of the card. Its circle is 22px, and the whole foot is the tap target.
  - Chip counts are 20px on a soft fill, or 16px from seven digits so they fit the column.
  - The hand step buttons draw a 24px circle, and every tap target stays 44px.
  - The insurance seat stays outside the card but uses the same columns.
- Decision: do.
- Tracking: PR #60

### #I-026 Calmer chip counts and table balance

- Type: feature
- Date: proposed, decided and completed 2026-11-06
- Source: real device check of #I-025
- Problem: on a phone the boxed chip counts were too heavy, the hand step buttons sat far from the count, and the highlighted balance card drew attention even when only the number mattered.
- Proposal:
  - Make chip counts smaller and drop their dark box.
  - Bring the hand step buttons closer to the count and take less width.
  - Keep the balance card plain and highlight only the number.
- Settled details:
  - Chip counts are 18px, or 14px from seven digits so they fit the narrower column.
  - The step circles sit at the inner edge of their 44px tap targets, 17px from a single-digit count.
  - The count keeps its 44px tap target, so the gap goes no lower.
- Decision: do.
- Tracking: PR #62

### #I-027 Currency in the blinds line and hands in big blinds

- Type: feature
- Date: proposed, decided and completed 2026-11-06
- Source: real device check of #I-026
- Problem: the currency name sat apart from the cash value of the blinds, and one hand showed no size in big blinds.
- Proposal:
  - Show the currency name before the cash value of the blinds, such as `人民币 ¥5/¥5`.
  - Remove the currency name from the line under the header.
  - Show one hand as `1 手 100 BB（500 筹码 / ¥500）`.
- Settled details:
  - The chip ratio stays in the line under the header.
  - Big blinds per hand use the current big blind and round to one decimal for display.
- Decision: do.
- Tracking: PR #63

### #I-028 Game clock in the header

- Type: feature
- Date: proposed, decided and completed 2026-11-06
- Source: discussion
- Problem: nothing showed how long a game had been running, and 设置 took the space next to 结算.
- Proposal:
  - Move 设置 to the right of the line under the header, at that line's size.
  - Add a clock button to the left of 结算. It shows a clock and Start, then the time with pause, then the time with play.
  - Compare layouts before building. The options were a two-line pill, a compact pill and a full single-line pill.
- Settled details:
  - The compact pill was chosen, with the time as `01:23:45`.
  - The game stores the time so far and when the current run started, so the clock survives a suspended page (ADR 0001).
  - Settlement stops the clock at the final time. Settled games show that time with no controls, and reopening leaves the clock paused.
  - There is no reset.
  - Backups move to version 6 to carry the clock. Older backups still load.
- Decision: do.
- Tracking: PR #64

### #I-029 Table fees and wages

- Type: feature
- Date: proposed and decided 2026-11-09
- Source: discussion
- Problem: 台费 and 工资 on game setup only showed 开发中, so organizers worked out table fees and hourly wages by hand after the game.
- Proposal:
  - Turning on 台费 or 工资 on game setup loads last time's values, which stay one of the presets beside the defaults.
  - 台费 defaults to 100 in the game's currency once a player has sat 30 minutes. Both numbers can change.
  - 工资 defaults to 25 an hour in the game's currency at every hour. 高级设置, collapsed, adds a different rate from one hour to another, or after some hours of play.
  - Both go to the host and show at settlement, marked apart, with room to waive or change a charge later.
- Settled details:
  - Wages are per player: the rate times their own time at the table, counted in whole minutes of the total.
  - Time at the table runs from buy-in to leaving and starts again on 返回. Pausing the game clock does not stop it.
  - The table fee is charged once per player per game. 0 minutes charges everyone.
  - Only one advanced rate can be on. The after-hours rate counts from the first player sitting down.
  - Each charged player's result shows 台费工资 and the amount, the organizer row shows the total, and a 台费和工资 section lists time, fee and wage per player.
  - Saved configs carry both. Backups move to version 7, and older backups still restore.
- Decision: do.
- Tracking: ADR [0022](adr/0022-table-fee-and-wages.md)

## Not doing or deferred

### #I-004 Hand size when blinds change mid-game

- Type: feature
- Date: proposed and deferred 2026-11-04
- Source: discussion
- Problem: after blinds change mid-game, should the chips behind "one buy-in = xx big blinds" change too?
- Proposal:
  - Temporary approach: chips per hand are fixed after the first record, and changing blinds doesn't affect hands.
    This is the smallest change and keeps "3 hands" meaning the same thing throughout a game.
  - If needed later, add "adjust chips per hand", affecting only later buy-ins and leaving existing records in chips.
  - This is close to how tournaments work: blinds rise by level, while the rebuy stack is set before the start.
    That comes from general knowledge; how other apps handle it hasn't been checked.
- Decision: defer. Blinds rarely change, so this isn't a priority for now.
- Tracking: no issue yet
