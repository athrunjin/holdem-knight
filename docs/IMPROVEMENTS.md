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

### #I-030 Time at the table follows the game clock

- Type: feature
- Date: proposed and decided 2026-11-09
- Source: discussion after #I-029
- Problem: players' time for the table fee and wages counted from buy-in even when the game clock had not started or was paused.
- Proposal: a clock that is not started means the game has not started, and a paused clock means it is paused. Nobody's time counts then.
- Settled details:
  - Each player's time is their time at the table while the clock ran. A game whose clock never ran charges nothing.
  - The after-hours wage rate starts once the clock shows those hours, skipping pauses.
  - A clock started before this change has no history, so its game counts as before.
  - The game page says 对局计时器未开始 or 已暂停 when a game with a table fee or wages is not being timed.
  - Sample backup 06 has a clock with a 20-minute pause, with its results worked out again by hand.
- Decision: do.
- Tracking: ADR [0023](adr/0023-seat-time-follows-game-clock.md)

### #I-031 Detail mode for seated players

- Type: feature
- Date: proposed and decided 2026-11-09
- Source: discussion
- Problem: during a game with a table fee or wages, the organizer could not see what each player owed so far, or how long they had been counted, until settlement.
- Proposal:
  - A 详细模式 switch at the top right of 桌上玩家. It is on by default in games with a table fee or wages, and a tap turns it on or off.
  - When on, each seated player's first row stays the same, with small lines under it.
  - Three layouts were compared as previews: one compact line, two lines of labels, and a small aligned table. The two lines of labels were chosen.
- Settled details:
  - The lines show 在局 (counted time, ticking while the clock runs), 台费, 工资 and 含费水上/水下, the cash result so far less the fee and wages so far.
  - 台费 shows 未满 差 N 分 in gold until the player has sat long enough.
  - Games without a table fee or wages can turn it on too, and show 在局 and the cash result.
  - The switch is not saved, so it starts from the default each time the game opens.
- Decision: do.
- Tracking: none yet

### #I-032 Itemized fees and waivers at settlement

- Type: feature
- Date: proposed and decided 2026-11-09
- Source: discussion
- Problem: settlement showed each player's table fee and wages as one label and a separate section, the rates and times were not with the amounts, and a single charge could not be let off.
- Proposal:
  - Under each player's name, wages first with the rate and the time at it, one line per rate, then the table fee, with the amounts in the amount column.
  - A box on each charge, ticked by default. Unticking it lets that player off that charge and updates every total.
- Settled details:
  - Several layouts were compared as previews. The chosen one is a bill: the result from the chips, then each charge, then a total.
  - The total sits under a solid line with 合计 on the left and the amount in a colored chip. Every amount shares one right edge.
  - Each person is a card whose first row has a tinted background, so players stand apart.
  - Games without a table fee or wages use the same cards. A person with no adjustments shows only the first row, with the total in it. A share of a difference and insurance given to a person are detail lines too.
  - The organizer's card lists a covered difference, insurance and the table fee and wage income.
  - Wages at each rate round on their own, so the lines add up to the total. The separate 台费和工资 section is gone.
  - Waivers are saved on the game and locked once it is settled. Backups move to version 8.
- Decision: do.
- Tracking: ADR [0024](adr/0024-itemized-charges-and-waivers.md)

### #I-033 Settlement summary, compact choices and folding cards

- Type: feature
- Date: proposed and decided 2026-11-09
- Source: discussion after #I-032
- Problem: the imbalance choices took a large card at the top of settlement, the insurance owner was a full-width select, the results had a small title with no overview of the game, and itemized cards made the page long.
- Proposal:
  - A larger 结果 title with the blinds, start date and host, then tiles for the total buy-in, the game clock and the balance.
  - The imbalance handling and the insurance owner each take one row showing the current choice, which opens the choices when tapped.
  - Players' cards fold, and a 明细 switch opens them all.
- Settled details:
  - Several layouts were compared as previews. The tiles were chosen for the overview.
  - The host shows a placeholder until organizers have names (M6).
  - A folded card keeps its first row, with the total in the amount column, and one small right-aligned line: 分摊, 保险, 工资 and 台费 where present, then their sum in gray. With one item, that item takes the sum's place. A waived group shows 已免.
  - Tapping a card's first row folds or opens it. The 明细 switch is on only when all are open: it opens all when any is folded, and folds all when all are open. Cards start folded.
  - The organizer's card lists 台费收入, 工资收入, 保险 and a covered difference apart, adding up to its total.
  - The notes under the results are gone from the page. The shared image still carries them.
  - The switch matches the 详细模式 switch on the game page.
- Decision: do.
- Tracking: none yet

### #I-034 Pick the starting players after game setup

- Type: feature
- Date: proposed, decided and completed 2026-11-09
- Source: discussion
- Problem: after 开局 on 开局设置, the organizer lands in an empty game and adds each player one by one, even though most games bring back the same faces.
- Proposal:
  - Tapping 开局 opens a 选择玩家 step before the game starts.
  - Three layouts were compared as previews: pills, tiles and a compact list. The tiles were chosen.
- Settled details:
  - 最近玩家 at the top: the people from recent games, as tiles with the first character in a circle, four to a row and at most three rows (12 people). A tap lights a tile and a second tap clears it.
  - 全部玩家 below holds every player, recent ones included, sorted by pinyin initials and grouped by their first letter. A letter gets a heading only when someone falls under it. Each row has a tick box on the right.
  - A letter index down the right edge highlights the current letter while scrolling. A tap jumps to that letter. Holding it enlarges the index and shows the letter in a large bubble, and sliding up or down jumps as the finger passes each letter.
  - To the right of 全部玩家 sit a group choice (全部 by default), a filter button and a sort button. For now each shows a 开发中 notice.
  - One search box filters both sections by name or pinyin initials. When nothing matches, 新建「name」并选中 adds the player and picks them.
  - Each picked player buys in 1 hand. The number of hands can't be changed here.
  - Starting with nobody picked is allowed.
  - The bottom bar takes one row: a 开局后直接开始计时 tick box, unticked by default and not remembered, and the start button. The button reads 开局 with nobody picked and 开局 · N 人 otherwise.
  - Picked names sit above it in pick order, wrapping onto up to three rows and then scrolling. Tapping a name unpicks it.
  - The layout was checked on a phone with a preview build that used sample players.
  - The settings button now reads 下一步：选择玩家 and sits on the right, with 保存当前配置 on the left. 设置 at the top right goes back to the settings as they were typed.
  - Both steps end with the same pair: a narrow item on the left and a wide button on the right, both 48px tall.
  - On 开局设置, 保险, 台费 and 工资 no longer show their description under the name. An info button next to the name shows it in a dialog.
  - Recent players come from the latest 20 games: the newest game's players first, and players from the same game in alphabetical order. Each player appears once, at their newest game. The insurance seat and players taken back out are left out.
  - Starting saves the game, then the insurance seat and the starting buy-ins in one ledger write, all timed at the moment of starting. A ticked clock starts at that moment too.
- Decision: do. Recent players come from past games, so this needs no sign-in and does not wait for M6. Released after a trial on a real device with the preview build.
- Tracking: PR [#74](https://github.com/athrunjin/holdem-knight/pull/74)

### #I-035 Outs数速算: a two-player quick insurance price

- Type: feature
- Date: proposed, decided and completed 2026-11-10
- Source: discussion
- Problem: 填 outs priced a pot from three bare numbers (pot, stake, outs) and a buyer picker. It did not show who leads, what the pot is made of, or how likely the next card is to turn it.
- Proposal:
  - Rename the mode Outs数速算 and replace the buyer picker with 底池信息: dead money, two player cards and the pot, with the quote below.
  - Two looks for the pot were compared as previews: a bar and a ring. The ring was chosen, with the bar one tap away.
- Settled details:
  - The street starts on 保转牌.
  - Dead money sits at the top of 底池信息, 0 by default and lit in gold until it is confirmed, even as zero.
  - Each player card has a name row (tap to pick or change the player, who keeps the chips), a chips row (tap to enter chips or Cover), and either the lit 领先 badge with the chance of being caught, or the Outs box with a 切换领先 button on the same row. Exactly one side leads, the left by default. Switching the lead changes nothing else.
  - Players are picked as in 选牌计算: seat, then chips, with at most one Cover. Entering the trailing side's chips goes straight on to its outs.
  - The outs dialog starts at 4 outs (selected) and 0 tie cards, each with minus and plus buttons that dim at their limits. Outs and ties together stay within the odds table and the unseen cards (45 on the turn, 44 on the river).
  - Tie cards are sold with the outs, whatever the rule says about tie cards, and shown as outs+ties: 6+2 is priced as eight cards. Tie cards alone can be bought on (0+2).
  - Once both players are in, 有效总底池 shows below them as a ring beside its legend, split into leader, trailer and dead money with the leader picked out. Each row shows chips over its share of the pot, and on the name's line, smaller: the leader's chance to win, 反超Outs x / xx.xx%, and 平分Outs x / xx.xx% when there are tie cards. Dead money stays listed at zero.
  - Tapping a pot row is a quick edit: the leader's chips, the trailer's chips then outs, or the dead money.
  - Once the outs are in and the quote opens, the page scrolls to put dead money at the top, so it never moves under a dialog.
  - Quotes add a 半池 cover in both modes. When the stake already is half the pot, 保本 says 即半池 instead.
  - The pot rows are about 37px tall to match the ring's height, below the usual 44px.
- Decision: do. The in-game entry comes first; the standalone tool page keeps its rule picker and will be adjusted from this one later. Checked on a phone with the preview build.
- Tracking: PR [#76](https://github.com/athrunjin/holdem-knight/pull/76)

### #I-036 Insurance page: one calculator for the game and the tool, and a quieter page

- Type: feature
- Date: proposed and decided 2026-11-10
- Source: discussion
- Problem: the calculator is reached from a game and from 工具, and the two had drifted. The tool asked for a seat it has no use for, Outs数速算 sold tie cards whatever the rule said, and in a game the records and the insurance seat's line took room from the calculation.
- Proposal: keep one calculator and settle what differs between the two entries. This entry covers the base; further changes to the page's layout and flow will be added to it.
- Settled details:
  - Players: a game picks who is all-in from the seated players. The tool never asks: it hands out 玩家 1, 玩家 2 and so on in order, and Outs数速算 names its two sides from the start.
  - Rules: a game uses its own insurance rule, the tool the rule picked on its page.
  - Tie cards: both modes follow the rule. This replaces the #I-035 detail that Outs数速算 always sells them. When they are not sold, the outs dialog marks them 平分牌（不算 outs）, they still show in the pot's chances, and the quote prices the outs alone.
  - Tie cards count as outs by default: both built-in rules (1 赔 30 and 1 赔 32) now have 平分牌算 outs on, so a new game and the tool start with it on. Games and saved rules keep what they were saved with.
  - A 平分牌算 outs switch sits under the mode tabs. In a game it is the game's setting: flipping it asks first, then saves the game's rule, so the rest of the game follows it. In the tool it lasts for the visit and goes back to the rule when another rule is picked.
  - Records: only in a game. They fold into one small line, 保险记录（n） with a chevron, pinned to the foot of the screen above the navigation. It is always folded on arrival and opens upwards to at most 40% of the screen. Since it no longer opens by itself for a purchase waiting on its card, the line says n 笔待开奖.
  - The insurance seat's chips and result move onto the title's line, to the right of 保险, in the same size and color.
  - 选牌计算 player rows: the 修改 button is gone. A row reads name, chips, hole cards, and each part is tapped to change that part alone: the chips dialog, or the card picker. In a game the name carries a chevron and opens the seat picker, which seats another player with the chips and cards already entered. The tool's names are given, so they are not tappable.
  - Changing a hole card: the picker opens on the card tapped. From the first card, the next pick replaces it and the pick after that replaces the second. From the second card, picks replace only the second; the first changes only after it is tapped off. Cards held by other players or on the board stay unavailable.
  - Rows can be changed on the players step, the street step and the buying step, until something is bought in the hand. After that they are read-only, as every price sold depends on who is in the pot. A change clears offers already turned down.
  - Each row shows where the player stands as soon as two players have their cards, before the flop too, and follows every change to the hands and the board. Whoever holds the best hand so far is lit with an accent border, every one of them when they are level, and shows only the chance to win. A player behind shows Outs n · chance: n is the next cards that put them ahead, written n+m when m more would only bring them level.
  - The rows compare all the players as one showdown, whatever each put in. Which pot each player leads stays in the pot cards below.
  - The chance is the chance to win by the river, with a split counted as a share, so it matches the pot card when there is one pot. From the flop on every runout is dealt and it shows one decimal. Before the flop there are 1.7 million runouts, so 20,000 are sampled, the same ones for the same cards, and it shows whole points.
  - 选牌计算 opens with 底池信息 above the players. The flop is three cards in a solid frame named 翻牌. A plus joins it to the turn, one card in a dashed frame named 转牌 · 可不选, which turns solid once it has its card and can be cleared again with 不选 in its picker. A river dealt later joins the row in its own frame.
  - This replaces the step that asked which street the hand had reached. The flop and turn are tapped to pick or change them for as long as the rows can change, so 重选公共牌 is gone. On the buying step 返回增减玩家 goes back to add or remove players, keeping the board.
  - Dead money is a stack of three chips under the board: outlines while empty, gold with its amount once some is entered. Tapping it opens the dead money dialog.
  - Once at least two players have chips and cards and the flop is in, 有效总底池 appears below the players in the same ring and legend as Outs数速算, and the main button reads 计算保险. Each player's part is what they have in the contested pots; the leaders take the accent color and players behind are told apart by shades of gray. With more than three players it starts as the bar. A row is tapped to change that player's chips or the dead money.
- Decision: do. Built and checked at phone size in the browser preview, then merged for trial on a phone.
- Tracking: PR [#78](https://github.com/athrunjin/holdem-knight/pull/78)

### #I-037 One block for the pot and its insurance

- Type: feature
- Date: proposed and decided 2026-11-11
- Source: discussion
- Problem: on the buying step of 选牌计算, 有效总底池 and the pot's insurance card sat one above the other and repeated each other: the chances to win, what the leader put in and what they stand to win were all shown twice, under a 转牌保险 heading.
- Proposal: when the hand has one pot with one leader, draw the two as a single block.
  - Four layouts were compared as previews: the ring over the table, an inner ring for the cover, three option cards, and a slider for the premium. The ring over the table was chosen, with the inner ring taken from the second.
- Settled details:
  - The block is headed 主池 with the pot's size. The street's heading and the note on uncalled chips are gone from this step, and so are the lines repeating the chances, the stake and the share.
  - The ring shows who put what in. Its legend lists the leader first, lit, with their chance to win after the name; then the players behind with Outs n · chance; then the dead money. Each line ends in chips only.
  - Under a divider: the odds on the left, the outs sold on the right, and the cards under them, by opponent when there is more than one.
  - The table keeps 保本, 半池 and 满池. Nothing is picked on arrival. Picking a cover lights the ring's inner track for the share of the pot a hit would still leave, with 保住 n% in the middle, and shows under 中了到手 and 没中到手 what each leaves the buyer up or down on their stake: green up, red down, gray level.
  - A 自定义 row always sits under 满池. Tapping it puts the cursor in its premium, with no dialog; the payout, both results, the inner ring and the button follow as it is typed. A premium above the full-pot one is refused with a line under the table.
  - Once bought, the cover taken stays picked out in full color, the others fade, and the bar with 修改 shows as before. A custom premium that was bought shows in its row.
  - Every pot uses this block, side pots too: one block for each leader of each pot, headed with the pot's name, its ring showing that pot alone and its legend the chances to win that pot. The main pot always lists dead money, even at zero; a side pot lists it only when it holds some. Tied leaders each get their own block, marked 并列领先. The older card per pot is gone.
  - A hand with side pots shows 总底池 above the pot cards as columns, main pot first, left to right. Bars, a table, a staircase by player, blocks sized by pot and nested rings were compared as previews; upright columns with each part's player and chips written inside it were chosen. A slimmer column with the names beside it was tried on a phone and found too thin.
  - Each column is as tall as its pot is large and has the pot's chips above it and its name below. From the top down: whoever leads that pot, in the accent color, however small their part; the other players as they were entered; then dead money in gold. Each part is named with its chips, and keeps room for that line even when it is small.
  - In a column every part reads the player at its left and the chips at its right. The leader's part has a second line: 领先 at the left, their chance to win that pot at the right. The pot's chips above the column and its name below are the same size.
  - Under the pot's name is what the next card can do: n Outs / chance of one coming. When the rule sells tie cards and the pot has some, a second line reads m Outs / chance（平分）.
  - A column is never drawn at less than a fifth of the tallest one's height, however small its pot.
  - The note on chips nobody called is gone from the page.
  - Outs数速算 uses the same block once both players and the outs are in, in place of its overview and its separate quote. Its legend reads Outs n · chance for the player behind.
  - A lone side pot is called 边池. With more than one they are 边池 1, 边池 2 and so on, on the columns and on the pot cards alike.
- Decision: do. Built over several rounds; all but the last were checked on a phone with the preview build.
- Tracking: PR [#79](https://github.com/athrunjin/holdem-knight/pull/79)

### #I-038 Insurance setup: cover limits, odds tables and saved settings

- Type: feature
- Date: proposed and decided 2026-11-11
- Source: discussion
- Problem: insurance at game setup listed every rule as a choice, capped premiums as a percentage of the pot, which no one used, had a turn switch nobody turned off, and edited the odds in a full grid of fields that changed the game as they were typed.
- Proposal:
  - Options at game setup run 工资, 台费, 保险, 抽水.
  - Turning insurance on shows its config in a dropdown on the same row: 上次配置, or the saved name when last time used one.
  - 命中退还保费 and 平分牌算 outs share one row of small switches. Last time's values carry over; with none, refund is off and tie cards count.
  - 翻牌全下可保转牌 is gone: the next card can always be insured, and the river always.
  - 保费上限 for 翻牌 and 转牌 sit on one row as dropdowns: 保本, 半池, 3/4池, 满池 (default) or a percentage up to 100%.
  - The odds table is folded under these. Its row expands it, and the name beside it picks a built-in or saved table. Four fields a row, 15 by default, a small plus in the next place and a small delete on the last.
  - 确认 lights only for a valid change. It asks 是否应用到本局？, then offers to save the table as 赔率表_日期, without opening the keyboard; a tap selects the name.
- Settled details:
  - The limits mean how much a hit may give back, like the calculator's covers, not a share of the pot paid as premium. Rules with premium caps or the turn closed insure the full pot and the turn from now on.
  - 保存配置 at the right of the limits row saves the settings other than the odds, and shows only for a valid change unlike every config on offer. Picking a config keeps the game's odds.
  - The 保存为规则 field and the built-in tables in the config dropdown are gone; built-in tables are in the odds dropdown. 查看demo moved beside 确认.
  - Saved odds tables are kept on their own and backed up. Backups move to version 9.
  - Dialogs opened inside the setup form render outside it, so Enter in them never starts the game.
  - Odds fields select their value on a tap and show at least one decimal once left: 30 reads 30.0.
- Decision: do. Checked at phone size in the browser preview, dark mode, then on a phone with the preview build.
- Tracking: PR #80, ADR [0026](adr/0026-insurance-cover-limits-and-odds-tables.md)

### #I-039 Wage and table fee setup: segments, billing units and saved configs

- Type: feature
- Date: proposed and decided 2026-11-11
- Source: discussion
- Problem: wages allowed only one advanced rate, charged only by the minute, and the base rate sat in a full-width field; table fee and wage presets could not be saved.
- Proposal:
  - Both options show their config in a dropdown on the switch row, like insurance, with 保存配置 at the foot.
  - 基础时薪 25.00 sits on one row and is edited in place: a tap selects the number.
  - 计费方式 picks 精确到分 (default), 精确到15分, 精确到30分 or 每小时, with 向上取整 on the same row, on by default, and an info button.
  - 高级设置 becomes 分段薪资, where 时段设置 and 开局时间设置 can both be on.
  - 时段设置 picks whole hours from dropdowns, 0点 marked 凌晨 and 12点 中午. A new list starts from 0点 with no end at 30; only the last segment may have no end, and then no segment can follow. A small plus adds one from the last end; all but the first can be deleted.
  - 开局时间设置 starts at 6 hours, takes whole hours only, and can add and delete rows.
  - Up to 3 of each and 4 in all. With both on, a note says the larger rate that came first applies.
  - 台费 defaults to 10 minutes, with an info button by 在桌满 on why to keep some time.
- Settled details:
  - Time segments run on the game's timeline from the first time their hour comes round after the game starts, so "from 0点 with no end" means after midnight, not all day. Overlap and more than 24 hours together are refused.
  - The total time is rounded to the unit, and the minutes rounding adds or takes away go to the rate the player sat at last.
  - Older games keep charging as before. A wage rule carried over from one keeps its by-the-minute, round-down charging.
  - 保存配置 shows only for a valid change unlike every config on offer, for wages, table fees and insurance alike.
  - Every setting carries over from the latest game. An option it had off starts off, and when turned on takes the last game that had it, or the defaults.
  - From trying the preview: every typed field in game setup selects its value on a tap. Money shows two decimals once left, so 30 reads 30.00 and 36.5 reads 36.50, and segment rates show /小时, lined up on the right with 基础时薪 and with the delete button before them. 货币 is picked from a list with no 确定 and keeps a down arrow; the 筹码, 盲注 and Buy in rows lose theirs.
- Decision: do. Checked at phone size in the browser preview, dark mode, then on a phone with the preview build.
- Tracking: PR #80, ADR [0025](adr/0025-wage-segments-and-billing-units.md)

### #I-040 Wage units at the longer rate, rounding modes and the game's time zone

- Type: feature
- Date: proposed and decided 2026-11-12
- Source: review of wages and table fees on the latest build
- Problem: a night rate never began when the game started after its hour, segment ends were an hour off on daylight saving nights, the same game priced differently on a phone in another time zone, and minutes added by rounding all went to the last rate without the player seeing why.
- Proposal:
  - Charge each billing unit at the rate that covers more of it, the higher on a tie. A part unit that counts runs on past the moment the player left.
  - 取整方式 becomes a list: 四舍五入 (default), 向上取整 and 向下取整, with the info text explaining all three and the longer-rate rule.
  - A game that starts inside a time segment begins in it; a segment with no end counts as begun for 12 hours.
  - Each game keeps its time zone, and segments switch on the real local clock.
- Settled details:
  - Units run along the player's counted time from sitting down, so pauses and time away do not start a new unit.
  - With ¥20 before midnight, ¥30 after, 30-minute units and rounding up, 23:16 to 0:13 is 23:16–23:46 at ¥20 and 23:46–0:16 at ¥30, as 16 of its minutes are after midnight.
  - Earlier games keep their charging and, with no zone kept, the viewing device's time. A rule carried over from one reads as 向上取整 or 向下取整.
  - The page does not say which time zone the rates follow, and dates show in the device's time. Naming the zone was tried and removed.
  - Going to settlement from the game page pauses a running game clock, so no more time is charged while the results are read. 返回牌局 leaves it paused.
  - Amounts are not saved at settlement.
  - Backups move to version 10. Sample backups are marked as Beijing time, and sample 08 covers wage units across midnight.
- Decision: do. Checked at phone size in the browser preview, dark mode, then on a phone with the preview build.
- Tracking: PR #81, ADR [0027](adr/0027-wage-units-rounding-and-game-time-zone.md)

### #I-041 Settlement page: game header, organizer first and the game's settings

- Type: feature
- Date: proposed and decided 2026-11-12
- Source: trying #I-040 in the preview
- Problem: players could not see from the settlement page how they were charged, the organizer's card sat last, and the page opened with a title that said nothing about the game.
- Proposal:
  - Use the game page's header, put the organizer first, and show the game's rules on request.
  - Show each player the time they sat and the time they were charged.
- Settled details:
  - The header is the game page's: the blinds, currency and their cash value, with the option labels under it. The line below reads the organizer's ID, which stands in until organizers have names, then the start time.
  - The heading over the cards reads 对局总览. A small 设置 button beside it, shown when the game has insurance, a table fee or wages, opens the game's rules in plain lines with no box, in the order 保险, 台费, 工资. It does not depend on the 明细 switch.
  - 保险 shows whether tie cards count as outs and whether a hit hands back the premium, then on a second row the odds for 1, 3, 8 and 9 outs where the table has them, as 1赔30. Three dots after them open the whole table.
  - 台费 shows the amount and minimum time. 工资 shows only the rates some player was charged at, so a segment the game never reached is left out, then the unit and rounding.
  - An info icon beside 设置, sized to the text, opens 计费规则: the table fee's rules, then the wages', each under its name, then what time counts. The shared image carries those rules.
  - An organizer with anything to receive, insurance included, comes first under a title row of their own, with every column and dashes for an organizer who is not playing. The card is named by the organizer's ID and folds like the players'. Open, it always lists 保险, 工资, 台费 and 抽水, with a dash for any not received. The players' title row follows before the players.
  - The columns read Buy-in, 筹码, 水上/下 and 金额. Buy-in is centered and sized for two digits, and chips and the win or loss for four.
  - Each card with wages shows 在桌 and 计费 times before the wage lines.
  - A player's open lines are as close together as the organizer's. The charge lines are 28px tall, under the 44px the project asks of touch targets, as the user chose.
  - Every amount in the cards shows two decimals, so ¥150 reads ¥150.00. The shared image's amounts match.
- Decision: do. Checked at phone size in the browser preview, dark mode, then on a phone with the preview build.
- Tracking: PR #81, ADR [0027](adr/0027-wage-units-rounding-and-game-time-zone.md)

### #I-042 Game page in the settlement page's style

- Type: feature
- Date: proposed and decided 2026-11-12
- Source: comparing the game page with the settlement page from #I-041, then trying the preview
- Problem: the game page in play looked different from the settlement page, the organizer's insurance, table fees and wages were spread around or hidden, and the hand steppers and leave buttons took room.
- Proposal:
  - Move what the organizer has so far above the seated players, folding open and closed.
  - Give the seated players the settlement page's columns, sizes and spacing, without the − and + on Buy-in.
  - Turn 离桌 into an icon before the name, where the settlement page has its fold arrow.
  - Make the game record smaller, like the insurance records, and let the players who left fold away and come back in one tap.
- Settled details:
  - The organizer comes first under its own title row, as one card named by the organizer's ID. It shows in every open game. The insurance seat is a line of its own that never folds away, with its Buy-in and chips open to change. Folded, the card shows the total and a line with 工资 and 台费. Open, it lists wages and table fees so far, then 合计.
  - A first try folded the insurance seat into the card. On the preview that read as the seat not having bought in, so it stays in view.
  - A game with insurance but no seat in the ledger shows a + on the seat's Buy-in. A seat that left at a settle attempt shows 回桌 in place of its hands and chips.
  - Wages and table fees so far count every player, those who left included, and keep counting while the clock runs. Their lines show before anyone has sat down.
  - The insurance line's label, with a calculator icon, opens 算保险.
  - Each seated player is a card with the settlement page's five columns. 金额 always shows what the chips come to, on the organizer's row too. Charges only count in 合计.
  - Each card folds from an arrow before the name, as on the settlement page. Open, it shows time seated, table fee and wages where the game has them, then 合计. Closed cards have no summary line, so a full table stays short.
  - The 详细模式 switch opens every card, or closes them once all are open. It starts on in games with a table fee or wages. A first try named it 明细 and put a leave icon before the name.
  - Leaving is a 结算并下桌 button on the 合计 line, before the amount, for players and for an organizer who plays. It opened a leave dialog, described in the lines below. #I-044 replaced the dialog with the open card itself.
  - The leave dialog, titled 结算并下桌, is the player's settlement card: the title row and the tinted row with their name, Buy-ins, chips, 水上/下 and cash, then the record, the time sat and charged, wages at each rate and the table fee with their boxes to waive, and 合计. It has no fields: the Buy-ins and chips are the ones on the game page.
  - The record folds from a gray line in the card, with its arrow in the column of the waiver boxes: 「共 4 次」, a green 「带入」, then the Buy-ins, the chips bought and their cash value under the card's Buy-in, 筹码 and 金额 columns. It starts open up to 8 lines.
  - Each record line sits in the same columns. The day takes the arrow's place, on the first line and on the first line of each later day. Then the time as 17:37, what happened and how many Buy-ins it moved, and under Buy-in the Buy-ins held after it. 上桌 is gold, 补码 green and 退码 red. 离桌 and 回桌 are gray, and a 离桌 shows only when a 回桌 follows it.
  - Under the record is a gold 「带出」 line that stays in view when the record is folded: the time of leaving, the Buy-ins, the chips taken out and their value. A faint rule under it sets the record apart from the time sat, shown to the second as on the game page, and the charges. The chips and cash on the 带入 line carry a small green "in" mark and those on the 带出 line a gold "out" mark, so the two read as a pair.
  - The text under the name starts on two lines. 「共 4 次」, the times, the time sat and the charges start where the waiver boxes end. 带入, 带出 and what happened on each record line start one time's width further in.
  - The Buy-in column sits two digits' width further left, away from the chips, on the game page, the settlement page and in the dialog. Phones under 384 wide keep it where it was: the record has no room to give there.
  - The time fits before the Buy-in column in the dialog from 412 wide, the user's phone, and on the settlement page from 412 too. On narrower ones the time and 「共 4 次」 move to the 水上/下 column, which these lines leave empty. The dialog is almost as wide as the screen to give the first column room. Layouts were compared over several rounds, the last ones at the widths of current Galaxy and iPhone models.
  - The 筹码 column is centered, title and figures, in the dialog and on the game and settlement pages. 水上/下 and 金额 still end at the right.
  - The figure columns are sized by a stress test on the narrowest iPhone in use, the 393 wide iPhone 16: four digits sit easily, five are close and six touch, in chips, 水上/下 and 金额 at once. That leaves the name what it can have. Seven digits wrap after a thousands separator in a card's first row, and a long name takes two lines there before it is cut short, so nothing runs into the next column. On a 360 wide phone six digits already touch the Buy-ins.
  - The settlement page's cards are the same card: each person's record, 带出 with the time they left, the rule, the time sat and the charges. What changes the result after the charges, a share of a difference or the insurance result, comes last, under the table fee. The dialog and the page share one card, one record and one set of charge lines in the code.
  - The dialog's charges are worked out for the moment it opened and stay still while it is open. Confirming records the player as leaving at that moment. Closing it without leaving records nothing, so the time goes on counting as if it had never opened, as the user confirmed.
  - Since the dialog has no fields, 结算并下桌 reminds first. If the player's chips and Buy-ins have not changed in the last 5 minutes and the button has not lit in that time, the first tap lights it for 5 seconds and blinks the player's Buy-in and chips, which stay gold while it is lit. A second tap while it is lit opens the dialog, as does any tap in the 5 minutes after. A change counts whatever made it: chips typed, Buy-ins, insurance, leaving and returning.
  - Tapping Buy-in opens the hand dialog with nothing selected. 确定 lights once the count differs, and leads to a second step titled 「张伟 增加 2 个 Buy-in」 with the old and new counts either side of an arrow carrying the change, green for more and red for fewer, and one line with only that change: 「筹码量 +400（+¥400.00）」. 确认 applies it and 返回 goes back a step. Adding a player from the + keeps one step.
  - 买入 reads Buy-in across the app, and hands bought read 「x 个 Buy-in」. The game's line reads 「Buy-in 100 BB（200 筹码 / ¥200）」. In setup the row is Buy-in, with 「200 筹码（¥200.00）」 under the big blinds, and the blinds' cash value shows two decimals. The unit 手 stays on the settlement tile and in the shared image's column.
  - A player at one hand with nothing else recorded can be taken out of the game from that dialog, where the − used to do it.
  - 已离桌 folds from an arrow after its title, open by default. Open, a small 一键回桌 on the right brings everyone back after a confirm, the organizer and the insurance seat included. Each row's button reads 回桌, and the record says 回桌.
  - 牌局记录 is one quiet line at the foot of the page, folded by default, with smaller rows that scroll inside 40% of the screen. It stays in the page instead of being pinned over it.
- Decision: do.
- Tracking: PR #82

### #I-043 The organizer plays in their own game

- Type: feature
- Date: proposed and decided 2026-11-12
- Source: trying #I-042 in the preview
- Problem: an organizer who plays had to add themselves as a player, was charged their own table fee and wages, and had their chips apart from what they received as organizer.
- Proposal: tapping Buy-in on the organizer's own row opens the buy-in dialog, and confirming seats the organizer, who stays on that row.
- Settled details:
  - A + shows on the organizer's Buy-in until they join. After that the row shows their hands, chips and result, open to change like a player's.
  - The organizer stays on the organizer's card, apart from the insurance line, and only 合计 adds the two with the charges. 桌上玩家 counts them as one more.
  - No table fee or wages apply to the organizer.
  - 结算并下桌 and 回桌 for the organizer are on the open card's 合计 line. Taking the organizer out of a game they joined by mistake is in the hand dialog, as for a player.
  - On the settlement page the organizer's card shows their hands, chips and result, and they are not listed among the players.
- Decision: do.
- Tracking: PR #82, ADR [0028](adr/0028-organizer-seat.md)

### #I-044 Settle from the open card on the game page

- Type: feature
- Date: proposed and decided 2026-11-13
- Source: trying #I-042 on a phone
- Problem: the leave dialog showed a card the game page could show itself, so leaving took a tap, a dialog and a confirm, and the reminder before it depended on when the figures last changed, which nobody could see.
- Proposal: an open card on the game page is the leave dialog's card, and 结算并下桌 settles from it with a second tap.
- Settled details:
  - A seated player's open card, from its arrow or 详细模式, is their settlement card as it would be if they left now: the Buy-in record, 带出 with the current time and chips, the rule, the time sat to the second with the time charged, wages at each rate and the table fee with their boxes to waive, and 合计 with the button. A table fee not yet due reads 「未满 差 12 分」. A waiver made here holds at settlement.
  - 结算并下桌 always takes two taps. The first lights the button for 5 seconds and blinks the player's Buy-in and chips, which stay gold while it is lit. Lit, the button lifts and grows a little, reads 确认结算 and is filled with green that runs out from the right, with the label dark over the green and green where it has gone. A tap while it is lit settles the player at once, with the chips on the page, and no dialog. When it goes out the button is as before, and the next tap only lights it again.
  - The rule of #I-042 that let a tap go straight through within 5 minutes of a change or of the last reminder is gone.
  - Two taps within a third of a second count as one, so a double tap does not settle by accident. This was added in building it, not asked for.
  - The organizer's card keeps its own lines. Its 结算并下桌, for an organizer who plays, works the same way.
  - The leave dialog is removed, and with it the wide dialog layout and leaving at an earlier moment.
  - 带入 on the folding line starts exactly where 上桌, 补码 and 带出 do: the count before it has a fixed width, where ten or more times bought used to push it right.
- Decision: do.
- Tracking: PR #83

### #I-045 Game page header: Buy-in in big blinds, every option and a settings icon

- Type: feature
- Date: proposed and decided 2026-11-13
- Source: trying #I-044 on a phone
- Problem: the game page spent a gray line on the chip ratio and the Buy-in, the header only named the options that were on, so it changed shape from game to game, and 设置 sat in a different place on the game page and the settlement page.
- Proposal: one header for both pages, with the Buy-in, all the options and the settings in the line under the blinds.
- Settled details:
  - The line under the blinds starts with the Buy-in in big blinds, small and bold: 「100BB」. Then 保险, 工资, 台费 and 抽水, always all four and in that order. One the game does not use is gray and struck through. 抽水 is always so until rake exists.
  - A settings icon ends the line. On the game page it opens the settings page, where they can be changed. On the settlement page it shows the game's rules under the header, to read only, with the 计费规则 icon beside them. The 设置 link on the game page and the 设置 button beside 对局总览 are gone.
  - The gray line 「10 筹码 = ¥1 · Buy-in 100 BB（…）」 is removed from the game page.
  - The currency beside the blinds is an icon where it has one: a panda for 人民币. 澳元 keeps its name for now. The blinds' cash value shows two decimals: 「¥0.50/¥1.00」.
  - Wages come before the table fee wherever the two are listed: this line, the rules it opens, the 计费规则 text and the shared image, as on the cards.
  - The line fits on one row from 393 wide on the game page, beside the clock and 结算. Narrower, its parts wrap and never overlap. 「100BB」 ends under the second blind's first digit: lining its end up with the blinds' end would push the options onto a second row on a 393 wide phone.
  - A tap on a card's 水上/下 or 金额 on the game page folds the card open and closed, as the name does. Buy-in and chips still open their dialogs.
- Decision: do.
- Tracking: PR #83

### #I-046 Currency marks, a clock that shows its state, and tiles that switch between cash and chips

- Type: feature
- Date: proposed and decided 2026-11-13
- Source: trying #I-045 on a phone
- Problem: the app named currencies in words, the paused clock put a notice in the page, and the three tiles under the header were laid out differently on the game page and the settlement page, with 已离桌 taking a tile nobody read.
- Proposal: marks for the currencies, a clock whose color is its state, and one set of tiles for both pages.
- Settled details:
  - 人民币 is a sitting panda, chosen from several marks, and 澳元 a kangaroo. The panda was drawn for the app, since no open icon set has a whole panda in solid shapes. It uses two strengths of one color, because a panda in a single flat color reads as a bear. The kangaroo is from Material Design Icons (Apache 2.0). The marks stand in for the names beside the blinds, in the game list and in game setup.
  - Setup says 积分 where it said 货币, on the row, in its list and in the note about what can no longer change. The list still names 人民币 and 澳元 beside their marks.
  - The clock is green while it runs and gold while it is paused or not yet started. The notice 「对局计时器已暂停，台费和工资暂不计时」 is gone. The display stops at 99:59:59. Time goes on being counted from the timestamps past that.
  - The three tiles are centered. The first reads 「总 Buy-in · 15」 over the cash value with two decimals. The last reads 牌桌平衡 with a thin green tick, or a red cross over 水上多 or 水下多 and the difference in cash. A tap anywhere on either switches its figure to chips and back, each on its own, and a small switch mark after the label says so.
  - On the game page the middle tile is two actions, 「算保险 / Call time」. 算保险 opens the insurance page. Call time says it is in development. 已离桌 no longer has a tile. On the settlement page the middle tile is still 时长.
  - Figures fit one line at any length: the type shrinks with the figure's length against the tile's width, and the last tile is a little wider than the others. Six digits with cents were checked at 393 wide.
  - The user wrote 水下少 for the second label. The app says 水下多, as the settlement page's difference line already does, since 水下少 would mean the same as 水上多.
- Decision: do.
- Tracking: PR #83

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
