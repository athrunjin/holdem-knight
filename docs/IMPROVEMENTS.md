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

### #I-076 Accounts, players who take up their records, and namesakes

- Type: feature
- Date: proposed and decided 2026-11-20
- Source: the organizer, planning sign-in and how users' data is managed
- Problem: everything lives on one device under one guest organizer. A player is only a name in the host's list, which may not repeat, and has no way to see their own history or to be told from a namesake.
- Proposal:
  - Accounts, host spaces and player records are three things with IDs of their own. One account serves a person as host and as player; it owns one space for now. The books belong to the space ([ADR 0040](adr/0040-accounts-host-spaces-and-player-records.md)).
  - Sign-in by email and password, confirmed and reset with a code typed into the app; a second factor later ([ADR 0041](adr/0041-sign-in-by-email-and-password-with-codes.md)).
  - A player takes up a record by the host's invitation, or by a request the host places. A linked player reads their own results in the games they played in, what each game was played under, and whether its books balanced and how a difference was handled; no other player's result, and changes nothing ([ADR 0042](adr/0042-linked-players-and-claiming-records.md)).
  - Players may share a name: a game adds `_1`, `_2` to the later ones, each record has a number, and an avatar opens the player's page ([ADR 0043](adr/0043-namesakes-in-a-space.md)).
  - A host's deleted account keeps its space for 30 days.
- Decision: do, in the order the [roadmap](ROADMAP.md) gives for M6, with the namesakes first as they need no account. The organizer chose one space per account, the suffix in a game, and the 30 days, and, after first allowing a whole result, that a player reads only their own with the game's settings and its balance.
- Tracking: PR #94 for the plan, ADR 0040 to 0043

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

### #I-047 Host line, a plainer balance box, a folded Buy-in record, and one organizer card for both pages

- Type: feature
- Date: proposed and decided 2026-11-13
- Source: trying #I-046 on a phone
- Problem: the balance box said 水上多 or 水下多 in gold beside a switch mark, the middle box was two words with a slash, the host and start time showed only on the settlement page, and a card's Buy-in record opened by itself and sat looser than the lines under it. The organizer's card was built twice and read differently on the two pages, and the settlement page spent two full rows on choices that are rarely changed.
- Proposal: say the balance in plain words and colors, give the two actions icons, show the host on both pages, tighten the opened card, build the organizer's card once, and move the difference handling into small text over the balance box.
- Settled details:
  - The middle box on the game page has an icon over each action with a hairline between them, chosen from seven previews. 算保险 is the text color like Call time, no longer gold, and gray when the game has no insurance.
  - The balance box, on both pages: balanced, one centered line 筹码配平 with a tick, all green. Out, two lines, all red: 未配平 with a cross, then 多 or 少 before the difference, where it said 水上多 and 水下多. The switch mark is gone. A tap on the box when it is out still switches the difference between cash and chips.
  - The line with the organizer's ID and the start time now heads the game page too, the same on both pages. The ID is larger and white, the two end on one line at the bottom, and there is a little more room before the boxes.
  - 结算 and the clock stay side by side at the right of the header. 一键全桌结算 with the clock under it was tried on a phone and taken back. Four other places for the clock were previewed: the host line, the players' heading, a row of its own under the boxes, and a bar pinned above the navigation.
  - A card's Buy-in record starts folded however short it is, where records of up to eight lines used to start open.
  - Folded, 带出 is led by its day, as 13日, when that is not the day of the record's first line, in the room the folding arrow has above it, so the line does not move. A +n count of days was tried and dropped. Opened, a tap on 带出 folds the record; it carries no arrow of its own, and shows its day where that differs from the line before.
  - The lines under the record, time at the table and each charge, are as tall as the record's own lines, 24px where they were 28px.
  - A card's first row is 36px tall where it was 44px, on both pages. The amount at its end is plain colored text, the same weight as the other figures; the tinted, bold chip stays on 合计.
  - An organizer who is not playing shows a gray dash under Buy-in where there was a gold plus. A tap on it still seats them.
  - On the settlement page, a folded card whose result is more than its chips, with wages, a table fee or a share of a difference, keeps what the chips come to at the end of its row. The line under it lists each item and ends with 合计 and the final result as the tinted, bold chip, where it said 含费 or 含调整 with the sum of the items. The items run from the left and 合计 ends the line at the right, as large as the amount over it.
  - On the settlement page the insurance seat has its own row on the organizer's card, as on the game page, when its result is the organizer's.
  - In the balance box, 多 or 少 is set in the same type as the figure after it and shrinks with it.
  - The organizer's card on the game page is the settlement page's own card, with tappable Buy-ins and chips. It folds on its own, apart from 详细模式, and starts open when the game has wages or a table fee; on the settlement page it follows 明细.
  - On both pages the organizer's table fee line reads as the price times how many pay it, 台费 ¥100/人 × 5, and the line kept for rake is gone until rake exists.
  - The settlement page loses its two rows for who takes the insurance result and how a difference is handled. The insurance result goes to the organizer unless a game already saved another choice. While the chips are out, small gold text over the balance box names the handling, with an arrow that opens the three choices: 水上比例分摊 or 水下比例分摊, the organizer's ID with 承担 or 收取, and 不做处理. The amount stays in the box under it.
  - Opened, the organizer's card runs record, insurance seat, then wages and fees, with a faint rule between each; the record used to come after the insurance seat. Folded, a rule sets the insurance seat apart from the summary line under it.
  - The organizer's card follows the players' in its first row too: the amount there is always what their own chips come to, a dash when they do not play, and the total is on the line under it, folded or open. Folded, the row used to show the total when they did not play.
  - 明细 on the settlement page opens every card that folds. In a game with no wages, table fee or shared difference it used to skip the players' cards, which have only a Buy-in record.
- Decision: do.
- Tracking: PR #83

### #I-048 含费 on the game page, a quieter 已结算, and the order of the settle steps

- Type: feature
- Date: proposed and decided 2026-11-14
- Source: trying #I-047 on a phone
- Problem: a folded card on the game page showed only what the chips came to, so the organizer had to open cards to see who owed what. The players who had left took as much room as those playing. The settle dialog led with who was seated before the chips, and the settlement page ended with its main button under two others.
- Proposal: show charges on folded cards behind a switch, fold the players who left into a line, and put the settle steps in the order they are taken.
- Settled details:
  - Games with a table fee or wages have a 含费 switch beside 详细模式, on to begin with. On, a folded player card shows the settlement page's line under its first row: 工资 and 台费 so far, then 合计. Off, a folded card is its first row alone. Insurance takes its premiums in chips, so a game with insurance alone has no switch.
  - 详细模式 is off to begin with in every game. The two switches do not move each other.
  - The game page's player cards are now the settlement page's card, as the organizer's already was.
  - 已离桌 reads 已结算 and starts folded, one quiet line in the type of 牌局记录 under it. Its rows say 带出 for what was taken out.
  - The settle dialog starts with the chips: 「筹码配平」 with a tick in green, said even when nothing is wrong, or 「筹码未配平，多 1,000 筹码（¥100）」 with a cross in red, in the words of the balance box. The choices follow, with the organizer named by their ID, 「guest 承担 ¥100」, first and chosen to begin with. The line about who is still seated comes under them. Balanced with nobody seated and no insurance open, there is still no dialog.
  - The settlement page's 返回牌局 is replaced by the emblem, 48px tall, which keeps the header's height. The emblem is a picture only. The way back to the game is a small 返回牌桌 button in the row of 确认结算, to its right.
  - Under the cards, after a rule: 确认结算, or 修改对局结果 once settled (#I-050), with 返回牌桌 beside it. Then 生成图片 and 积分管理 (#I-049) side by side.
- Decision: do.
- Tracking: PR #84

### #I-049 积分管理: one list for the transfer plan, ticks for transfers made, and the organizer collecting where they are owed

- Type: feature
- Date: proposed and decided 2026-11-14
- Source: trying #I-048 on a phone
- Problem: the transfer plan took two buttons and a selection box to change, started on the optimal plan even in games where everyone pays the organizer, and could not be changed after 确认结算. There was nowhere to tick off who had paid, and history was one list whether or not a game's money was in. The insurance row on the settlement page opened the insurance tool, which has nothing to do there.
- Proposal: one small list for the plan, a default that follows the game, and a plan that stays open to change.
- Settled details:
  - 转账方案 on the button reads 积分管理, with no count of transfers.
  - Opened, the section starts with the plan in small text and a chevron, at the left with no title before it. A tap lists the plans and one more picks: 最优方案, then 代收人：the organizer's ID, then 代收人：each player in the order of the cards. The two buttons and the selection box are gone.
  - A game with insurance, a table fee or wages (rake too, once it exists) starts with the section open and the organizer collecting. Any other game starts with it closed, and opens on the optimal plan.
  - The plan can be changed after 确认结算 ([ADR 0029](adr/0029-default-transfer-plan.md)).
  - The organizer is named by their ID in the plan, the transfers and the image.
  - The plan's line is in 14px type. The transfers under it are set out like a bill, chosen from six layouts: 14px in rows 44px tall, with no boxes, rules or leaders between them. One rule sets the plan's line apart from the transfers, and another the transfers from the line under them.
  - The plan's line and every transfer end in two buttons, a share icon and a box to tick, set close together, each with a 44px target. The boxes start empty.
  - A tick on a transfer marks it as made, and dims and strikes through its row. The tick on the plan's line marks every transfer as received, or clears them all when all are ticked. Marks are saved on the game ([ADR 0030](adr/0030-transfers-marked-as-made.md)), and can be set once the results are confirmed (#I-050).
  - The share icons say 这个功能还在开发中 for now. 生成图片 works as before.
  - While any transfer is ticked the plan cannot be changed: a tap on it says 存在已完成的转账.
  - Under the transfers: 「共 4 笔（已收 1 / 4）」, the transfers ticked off over all of them, and at the right a small link, 返回主界面, to the games list. A 归档牌局 button stood there first and was dropped once the stages made it one step too many (#I-050).
  - On the games list 历史对局 loses its count and shows two parts, 积分待处理 and 完成 (#I-050).
  - Backups move to version 12 for the marks.
  - The insurance row on the organizer's card reads the same on both pages, a calculator icon and 保险, starting where the organizer's ID starts. On the game page it opens 算保险. On the settlement page it leads nowhere.
- Decision: do.
- Tracking: PR #84

### #I-050 The four stages of a game: 进行中, 结算中, 积分待处理, 已完成

- Type: feature
- Date: proposed and decided 2026-11-14
- Source: trying #I-049 on a phone
- Problem: a game was either open or settled. Transfers could be ticked while the results could still change, the button that undid a settlement spoke of reopening the game when the organizer wanted to correct a result, and a tap on a locked result did nothing and said nothing.
- Proposal: name the stages and let each one say what it allows.
- Settled details:
  - A game is 进行中 at the table. 结算 on the game page, once confirmed, makes it 结算中 and opens the settlement page. 确认结算 makes it 积分待处理. With every transfer ticked it is 已完成, and pending again if one is cleared: nothing has to be archived ([ADR 0031](adr/0031-game-stages.md)). A game with nothing to transfer is 已完成 as soon as it is settled.
  - 结算中: the results can still change, and the transfers under 积分管理 follow at once. No transfer can be ticked: a tap on a box brings 确认结算 into view and rings it in gold for a moment.
  - 积分待处理 and 已完成: the results are locked. A tap on a charge's box or on the handling of a difference scrolls the page until 积分管理 sits at the bottom, and rings 修改对局结果 over it.
  - 重新打开牌局 reads 修改对局结果, in the same colors. It takes the game back to 结算中. With transfers already ticked it asks first, 「已有积分转移被记录，是否删除并修改对局结果？」, and on 确定 clears them.
  - 返回牌桌 from a game in 结算中 puts it back to 进行中, where recording can continue. From a settled game the table is only shown.
  - On the games list 进行中 holds games at the table and games being settled, the latter labeled 结算中 and opening on their settlement page. 历史对局 has 积分待处理, where a game goes as soon as it is settled, and 完成, where it goes with its last tick.
- Decision: do.
- Tracking: PR #84

### #I-051 Start button in the navigation, a history that can be narrowed and ordered, and menus in the page

- Type: feature
- Date: proposed and decided 2026-11-14, completed 2026-11-15
- Source: discussion
- Problem: the chip-shaped 开一局 button took the top of the games list on every visit, games being settled sat among the games at the table, and history could only be read in two fixed groups.
- Proposal:
  - 开局 moves to the middle of the navigation: the K◇K mark on a round felt-green badge with 开局 under it, on the tabs' line. On a phone the badge rises 8px over the bar. It is on every page, and the side navigation on a tablet has it in the same place.
  - The list reads 进行中, 结算中, 历史对局 from the top. The first two are left out while they have no game. Only a game at the table opens on its table; every other game opens on its settlement page.
  - 历史对局 starts unfolded. Folded, it shows only its number of games, like the other two. Unfolded, its heading reads 「历史对局 · 全部 (3) ⌄」 with the number of games listed: the stage (全部, 未结清, 已结清) is text with the number and a chevron after it that opens a small menu, on one baseline with the title. The menu lists each stage with the number of games it would show under the filters in force. The filter and order icons are at the right, close together and next to the fold. The numbers of games are in ASCII parentheses, whatever the language.
  - The filters are on show from the start, in two lines under the heading. The funnel icon folds them away: it is filled while they show, and gold while any filter is set.
    - 对局时间 (全部, 过去一周, 过去一个月) and 积分类型 (全部, then each currency by its mark alone) share the first line. Each is its name, the choice in white and a chevron, and opens a menu in which the choice in force is the one in white.
    - 对局配置: 保险, 工资, 台费, 抽水, all on at first, each in the color it has on a game's row. A tap switches one off, which shows it struck through in gray. All at the right, in white while every one is on, switches them all on or off.
  - A game's row is 48px tall and shows when it started on two lines: the day as 26/11/14, and under it the day of the week and the time as 周六·21:05.
  - On the list the last two stages of #I-050 are named 未结清 (积分待处理) and 已结清 (已完成). A settled game still owed transfers has a small gold 未结清 tag before its date. A game that is 已结清 has none.
  - In the game settings the hint under Buy-in, also in its dialog, reads 「:100筹码/¥100.00」 without brackets.
  - The page comes back the way it was left: the three folds, whether the filters show, the stage, the filters and the order are kept in this browser (`localStorage`).
  - Short lists elsewhere open the same way, as a menu in the page under the choice instead of a dialog, with the choice in force in white: 积分 in the game settings, 计费方式 and 取整方式 under 工资, and 保费上限 for 翻牌 and 转牌 under 保险. 自定义 under 保费上限 still asks for its percentage in a dialog. Lists that can be long or deleted from, such as saved configurations, stay dialogs.
  - The order icon switches between newest first, the default, and oldest first, by when each game started.
- Settled details:
  - The label stays outside the badge, which keeps the mark's clear space (`docs/brand/README.md`).
  - Switching an option off leaves out the games that have it on, so with every option off only games without any are listed. 抽水 changes nothing until games can have rake (M4).
  - A week is the last 7 days and a month the last 30, counted from when the game started.
- Decision: do. Checked in the browser preview in dark mode at 360, 412 and 440px; not yet tried on a phone.
- Tracking: PR #85

### #I-052 Player library in the picker's style, tools as buttons, and no start button inside a game

- Type: feature
- Date: proposed, decided and completed 2026-11-15
- Source: discussion
- Problem: the player library and the tools page were plain lists from before the player picker's design, and 开局 stayed in the navigation while a game was already being set up, played or settled.
- Proposal:
  - The player library (玩家) is laid out like 选择玩家 without 最近玩家: the search field that also adds a player, the 全部玩家 heading with its group, filter and order placeholders, and everyone under their initial letter with the letters down the right edge. A row has a chevron where the picker has a tick box, and opens that player.
  - The tools page (工具) is three buttons on one line, each an icon over its name: 保险计算, Call Time and 抽水计算. 保险计算 opens the calculator. The other two say they are in development. 荷官费 is no longer listed.
  - 开局 is left out of the navigation on every page of a game: 开局设置, 选择玩家, the game at the table and its settlement, with the insurance and settings pages under a game.
- Settled details:
  - Without the button the four tabs share the navigation evenly. Keeping its place empty, so that the tabs stay where they are, was tried first and turned down.
  - The player library keeps its title at the left like the other tabs, not centered as on 选择玩家.
  - The picker and the library share the search field, the heading and the grouped list (`components/players/PlayerList.tsx`).
- Decision: do. Checked in the browser preview in dark mode at 360, 412 and 440px; not yet tried on a phone.
- Tracking: PR #86

### #I-053 Call Time: a countdown from the tools and from a game, which floats over the other pages

- Type: feature
- Date: proposed, decided and completed 2026-11-16
- Source: discussion
- Problem: Call Time was a button that said it was in development, on the game page and on the tools page.
- Proposal:
  - Call Time opens from the tools page and from the middle tile of a game at the table. Both open the same page: the title, a dial with the seconds, the lengths, and one main button.
  - The length is set by 30s, 60s, 90s or 120s in one tap, and by −10s and +10s at either side of the dial, so 90s then +10s gives 100. A tap on the seconds in the dial selects them, and a length can be typed over them: a whole number from 1 to 999. Only digits can be typed. Nothing is said while typing: only a number out of range, a zero or one over 999, turns the 秒 under the field into 范围 1–999 秒, and the length stays what it was. A step is not offered where it would leave that range. The last length is kept for the next time.
  - 开始 starts the countdown: a gold ring empties around the seconds left. −10s and +10s keep working on a countdown under way, moving its end, and nothing is taken off that would end it. 结束 clears the countdown and leaves the page open.
  - Through the last 10 seconds the time shows two decimals, as 8.46 with the decimals smaller, and the ring and the time are red and blink once a second. When time runs out the dial fills red, reads 时间到 and blinks faster, the phone buzzes where it can, and the main button is 退出. After 3 seconds the countdown clears itself and the page is ready for the next one.
  - A gold cross at the top right leaves the page. While a countdown is under way a round button with the shrink icon and no label sits over 结束, the size of +10s and under it, from the tools as from a game. It goes back to the page Call Time was opened from, with the countdown as a round clock floating at the lower right: the time left with the same ring, decimals and red blink. Leaving the page any other way, such as by a tab of the navigation, leaves the same clock floating. It stays over every page and can be dragged out of the way.
  - A tap on the floating clock opens the full page again. The cross, the shrink button and 退出 then go back to the page the clock was tapped on, wherever that is, not to where the countdown was first started. The cross and 退出 clear the countdown; shrinking keeps it.
  - Left alone, the floating clock blinks for 3 seconds after time runs out, then clears the countdown and goes, the same 3 seconds as on the full page.
- Settled details:
  - There is one countdown in the browser. It keeps the moment it ends (ADR 0001) in `localStorage`, so it survives a reload or a suspended page.
  - Going back is a step back in the browser's history, so the page comes back as it was left. Opened by its address with no page before it, Call Time goes back to the tools page or to its game.
  - From a page of a game the floating clock opens Call Time as that game's page, which keeps the game's navigation. From any other page it opens the one under the tools.
  - The screen is kept on while a countdown is under way, where the browser allows it.
  - The rules are in `packages/core/src/call-time`. There is no sound.
- Decision: do. Checked in the browser preview in dark mode at 360 and 412px; not yet tried on a phone, where the buzz, the screen staying on and typing a length with the phone's keyboard still need a look.
- Tracking: PR #86

### #I-054 Insurance tool: the two ways of working as its title, and its configuration and odds table on the page

- Type: feature
- Date: proposed, decided and completed 2026-11-16
- Source: discussion
- Problem: the standalone calculator had a title that said nothing new, two wide buttons under it for the way of working, a native list named 赔率规则 that mixed odds tables with saved rules, and no way to reach the other settings of a rule.
- Proposal:
  - The title line reads 「选牌计算 ⇄ Outs数速算」. The way in use is in the title's font; the other is the same size, gray and not bold. A tap on a name picks it, and the arrows between them switch. Each name keeps the width it has in bold, so nothing moves on a switch. The two buttons under the title are gone from this page.
  - At the right a gold cross replaces 返回工具, like the one on Call Time.
  - The line under the title has two menus in the page, each a name and a chevron with no caption. At the left the configuration, 「默认配置 ⌄」: the default and the saved ones, and 自定义 for settings changed by hand. Picking one takes its settings and keeps the odds, as in a game. At the right the odds table, 「1 赔 30 ⌄」: the two built in and the saved ones.
  - In the odds table's menu each saved table has a pencil and a bin after its name, to edit and to delete it. Each of the two built in has an eye where the bin would be, to look at it. A small plus on a last line under the tables makes a new one.
  - All three open the same dialog. Its top line is the table's name, a little larger than the text, with a pen at its right: a tap on the pen or on the name selects the name for typing a new one. A saved table also has a bin there, which deletes it after asking. Under the name are the odds for each number of outs, as under 赔率表 in 开局设置: a cell that does not read as odds is outlined, the last cell can be removed and one more added.
  - A new table starts from 1 赔 30 under the dated name a saved table gets by default, such as 赔率表_11-16, and 确认 saves it as it is, with no second dialog for the name. A saved table's 确认 is lit only once its name or its odds have changed, so an untouched table cannot be saved again. Where the odds are the same as another table's, built in or saved, 确认 first asks 「当前赔率和「…」相同，是否保存？」.
  - A table built in opens with its name and odds only: nothing can be changed, and the one button is 关闭.
  - The configuration's settings are on show under that line, as in 开局设置: 命中退还保费, 平分牌算 outs, and 保费上限 for 翻牌 and 转牌, with 保存配置 once they differ from every configuration on offer.
- Settled details:
  - The calculator's settings are kept in this browser (`localStorage`), so they are there on the next visit.
  - A gear that opened these settings in a dialog was tried first, at the title and then on the line under it, and turned down for settings on the page. With it went deleting a saved configuration from this page, which stays in 开局设置.
  - A new table is put in use once saved. An edited table's new odds are put in use if it was the one in use. Deleting the table in use leaves its odds in use, shown as 自定义.
  - A table cannot take the name of another saved table or of one built in; the dialog says so under the name. A name left empty goes back to what it was.
  - The dialog has no 查看demo button, which is still a placeholder in 开局设置.
  - 开局设置 and a game's settings pick their odds table from the same menu, at the right of the 赔率表 line, in place of the dialog that listed the tables: the same pencil, bin, eye and plus, and the same dialog. The cells under 赔率表 still edit the odds of that game and offer to save them as a table.
  - The settings are always on show, with no fold.
  - The insurance page of a game kept its own look at first, with two buttons, a 平分牌算 outs switch and 返回牌局. It took this one in #I-055.
  - Fixed after a first try on a phone: a saved table with the same odds as 1 赔 30 was shown as 1 赔 30 once picked, because the menu named the first table holding the odds in use. A rule now keeps the table its odds were taken from (`oddsTableId`), which names the table for as long as it still holds those odds; odds from no table, or from one since edited or deleted, fall back to the first table holding them (`oddsTableInUse`, with unit tests). It is kept in the tool's settings, in a game's rule and in backups. On a game's page, switching between two tables with the same odds changes no price and does not ask.
- Decision: do. Checked in the browser preview in dark mode at 360 and 412px, the menu in 开局设置 at 412px; not yet tried on a phone.
- Tracking: PR #86

### #I-055 选牌计算: the pot and the players entered on the page, and the insurance shown at once

- Type: feature
- Date: proposed, decided and completed 2026-11-16
- Source: discussion
- Problem: a hand was entered through a chain of dialogs, for the seat, the chips, the cards and whether there was another player, and the insurance showed only after 计算保险. Chips already counted at the table had to be typed again.
- Proposal:
  - The page has three sections, 底池信息, 池内玩家 and 保险信息. Each title is a little larger than the text and sits in the middle of the page, with a line at either side on the title's own middle that fades out toward the edge. A line under a title at the left was tried first.
  - 底池信息 is one line in the middle of the page: the flop, the turn, a hairline, then dead money, framed like a street with the chip stack over its name. A small arrow by the left edge of the page, between the title's line and the flop, puts the board and the dead money back as they started; nothing else moves for it. It was in the title first, at the right edge and then right after the name, and then level with the flop. Dead money still opens its dialog, and its name gives the amount. A hand starts with 1,000 of it, from a game as from the tools, framed in dashed light green until the organizer confirms an amount in the dialog; from then on it is framed like the flop.
  - 池内玩家 always has two rows, which cannot be removed, since a hand needs two players. From a game they are the first two players of the table, an organizer who plays first, with the chips each has there. From the tools they are 玩家 1 and 玩家 2 with 1,000 each, as is every player added there; they started at 0 first.
  - The plus under the rows adds the next player of the table, in the table's order. With nobody left it says so under the plus. Rows after the second have a small cross before the name, which removes them. The first two have a small arrow there instead, which clears that player's cards and cover and keeps the player and the chips. An arrow in the title that put both rows back was there first.
  - A row is the name, the chips, a small C and the two cards. The name has a chevron and opens a menu in the page with the table in its order; one tap picks, and players already in another row are gray and cannot be picked. The chips are typed in place: a tap selects them, with no dialog and no frame of their own, and there is room for six digits. The C marks the player as covering the others: the chips read Cover in green, and a tap on the C takes it back. The cards open the card picker.
  - 保险信息 shows the insurance as soon as the flop, two players' cards and their chips are in, with nothing to confirm. Until then it names what is still missing, such as 「还差：翻牌、王五（手牌）」.
- Settled details:
  - Chips typed from a game go to the table once the field is left, as the player's counted stack. A cover leaves the table alone, and the number under it comes back when the cover is taken off. Only one player covers at a time, so a second C moves the cover.
  - The chips are read from the table when a player enters a row, by the default, the plus or the menu. They are not read again while the hand is open.
  - From a game, changing a row's player starts the row again: the new player's chips at the table, no cover and no cards. From the tools the name is only a label, and the chips, cover and cards entered stay.
  - The first two rows are kept only once something is changed, so opening the page leaves no hand behind.
  - The rows, the plus and the arrows work until something is bought in the hand, as the players did before.
  - The dead money a hand starts with counts in the pots like any other, so a hand finished without setting it is settled with 1,000 of dead money. The dashed frame is the only warning. A hand already open when this came in keeps the dead money it had.
  - Outs数速算 is unchanged and still asks for its two players in dialogs.
  - The insurance page of a game looks the same as the tool: 「选牌计算 ⇄ Outs数速算」 as its title, a gold cross back to the game, the configuration and the odds table in menus, and the settings on show. Only the players and their chips differ, which come from the table and go back to it. The insurance seat's chips and result are a line under the title.
  - On a game's page those settings are the game's own, so a change there asks first: 「这个修改会应用到本局，之后的保险都按新设置计算。继续？」. Answered no, nothing changes. Saving the settings under a name changes nothing in the game and does not ask.
- Decision: do. Checked in the browser preview in dark mode at 360 and 412px, from the tools and from a game of four players: default rows, typing chips and their arrival at the table, cover, the menu, adding and removing, both arrows, and a hand through the turn. An organizer who plays was not tried. Not yet tried on a phone.
- Tracking: PR #86

### #I-056 Pot columns that lost parts of a pot off the bottom

- Type: fix
- Date: reported and fixed 2026-11-17
- Source: tried on a phone, two screenshots
- Problem: with side pots, a column of 总底池 could show fewer parts than its pot holds, so the parts on show did not add up to the chips above it. A main pot of 1,250 beside a side pot of 3,000 showed its leader and one player, half of a third, and no dead money. A side pot of 100 beside a main pot of 21,000 showed its leader alone.
- Cause: the pots themselves were right. Both hands were dealt again in the core: the amounts, who leads each pot, the chances and the outs all agreed with the page. The fault was in the drawing. A column was given a fixed height by its pot's size, a fifth of the tallest at least, while each part keeps a least height for its text, 40px for the leader and 20px for the others. Where the parts needed more than the column's height, the column cut the rest off: 106px of parts in 75px, and 62px in 36px. The least height of a column, 36px, was below what a leader alone needs, so the smallest column of any hand was always at risk.
- Proposal:
  - The pot's size sets the least a column is tall, never the most. A pot with many parts for its size grows past the scale, and every part stays on show, so the parts of a column always add up to the chips above it.
  - Within a column the parts still share the height by their chips, each never under the height of its text.
- Settled details:
  - A column can now be taller than its pot's share of the scale, and taller than the largest pot's 180px with enough players: nine players in one pot draw at 238px.
  - The parts are a list for a screen reader, named after the pot.
  - A component test draws both reported hands and checks that a column has a least height and no fixed one, and that its parts account for every chip of the pot.
  - How dead money is shared between the pots was looked at and left as it is, by the rules of the game: each line of the dead money dialog is taken as one folded player's chips, layered over the pots like a player's.
- Decision: do. Checked in the browser preview in dark mode at 360 and 412px with seven hands: the two reported, three pots, tied leaders, a cover, nine players, and five-digit chips at 360px. Each was checked by script for parts inside their column and sums equal to the pot.
- Tracking: PR #86

### #I-057 No payout above the pot, a cover picked on arrival, and a plainer cover table and ring

- Type: feature
- Date: proposed, decided and completed 2026-11-17
- Source: discussion
- Problem: 满池 was priced so that a hit left the whole pot share after the premium, which made its payout the share plus the premium, more than the pot. The insurance block opened with nothing picked, the custom premium sat in a dark box of its own, and the ring's inner track showed only how much a hit would leave, in gold with round ends.
- Proposal:
  - No cover pays more than the pot share it insures. 满池 is the largest whole premium whose payout, any refunded premium included, is no more than the share: on a pot of 1,000 at 3.5, a premium of 285 pays 997, where 286 would pay 1,001. With chips being whole the payout can fall a little short of the pot and is never above it.
  - The same holds for every cover and for a custom premium. A cover that would need a larger premium, such as 保本 at low odds, is held at that premium and marked 已到上限 as it is by the rule's own limit.
  - A pot share so small that one chip of premium would already pay more than it has no insurance: 「底池太小，1 个筹码的保费赔付就超过底池，不能投保」.
  - 保本 is picked when the insurance shows, so the block opens on a price. Nothing was picked before.
  - The custom row's premium has no box: the row's background, and a dash like the cells after it. A tap on the row puts a selected 0 in place of the dash, for typing over it in place with no dialog. Left without a premium, the cell goes back to its dash. Only whole chips from 1 to the most on sale can be typed, and a larger number stops at the most. A line under the row that said the range was tried and taken out.
  - The ring's inner arc is as long as what the cover pays against the pot share, in a clear light green, with the premium laid over its start in dark red: a cover that pays half the pot for a tenth of it is half a turn, its first tenth red. A full pot is the whole turn. Both end cut square, not rounded, and the part of the turn a cover does not reach is not drawn at all. The word in the middle is the cover picked, 保本, 半池, 满池 or 自定义, over the payout's share of the pot, so 满池 reads 100%. Two earlier drawings were turned down: the premium and what a hit leaves after it one after the other, and an arc as long as what a hit leaves after the premium, which made a full pot read 71%.
  - The plus under 池内玩家 is a small ring in the middle of the page, not a line across it.
  - The pot's ring reads clockwise from the top: the dead money, whoever leads, then the players behind. The legend beside it keeps its order, leader first and dead money last, and each part keeps its color.
  - The line under the pot reads 「反超 2 张 · 赔 15.0」 at the left, with the cards that overtake under it, at the left too. It read 赔 15 倍 at the left and 反超牌 2 张 at the right. Tie cards are counted on their own line under it.
  - At the right of that line is 分开购买 with a small switch, ending under the chips of the legend above. It is gray while off, which it starts as, and white while on. It changes nothing yet: what it does is for a later round.
- Settled details:
  - The cap is the buyer's share of the pot, which is the whole pot for a lone leader and their part of it for tied leaders who may insure.
  - 中了到手 for 满池 is now the pot share less the premium, where it was the pot share.
  - How dead money is shared between the pots stays as it is, by the rules of the game: each line is one folded player's chips. Only what was drawn wrong was changed in #I-056.
  - A payout is never less than its premium at odds of 1 or more, so the red never passes the end of the arc.
  - All three covers are priced by what they pay, as most games do: 保本 pays the stake, 半池 half the pot share and 满池 all of it ([ADR 0032](adr/0032-insurance-covers-priced-by-payout.md)). 保本 and 半池 were priced by what a hit leaves after the premium, which made 半池 pay 70% of the pot at 3.5.
  - The payout is settled first and the premium rounded to it. 保本 and 半池 pay at least the stake and half the pot, with the smallest whole premium that does; 满池 pays no more than the pot, with the largest that stays within it. On a pot of 3,000 at 3.5 with a stake of 1,000 the premiums are 286, 429 and 857, paying 1,001, 1,501 and 2,999, where the first two premiums were 400 and 600. A first version rounded all three down, which left 保本 paying 997.
  - Under 保本 a hit therefore leaves the stake less the premium, 715 in that example, not the stake. The table says so in red under 中了到手 while that cover is picked.
  - The rule's limit on a street is measured the same way: the most a cover may pay, the stake or a part of the pot share.
  - A target under what one chip of premium pays, such as a small stake at long odds, still sells that one chip, the least there is.
  - The common practice was looked up before the change. The write-ups found, among them one app's own notes on insurance as quoted in search results, agree that 保本 means the payout equals what the player put in and 满池 that the premium is the pot divided by the odds. 半池 was not found as a usual name; apps offer 保本 and 满池 with a slider between. The app's notes could not be opened to read them first hand.
  - The dark red is the loss color taken darker, and the green is the win color at part strength, so no new color is added. Five other colorings of the inner track were drawn side by side, and this one was kept.
  - The table that priced covers the old way, with its dialog for a custom premium, could no longer be reached and was removed (`QuotePanel`, `PremiumDialog`). What is left of it, the line that says why a pot has no insurance and the bar for a decision made, is `QuoteDecision`.
- Decision: do. Checked in the browser preview in dark mode at 412px: the three covers and their payouts, the custom premium typed and stopped at the most, the ring for each cover, a pot with no insurance to sell, and the plus. Not yet tried on a phone.
- Tracking: PR #86

### #I-058 Outs数速算 on the same page as 选牌计算, at both entries

- Type: feature
- Date: proposed, decided and completed 2026-11-17
- Source: discussion
- Problem: The changes of #I-055 to #I-057 were to reach every way into insurance: the tools page and a game, and both ways of working, 选牌计算 and Outs数速算. A check of the code found the prices and the insurance block already shared: every cover is priced by `quoteInsurance`, and both ways draw the same block. What lagged was the part of Outs数速算 above the block. It still had two wide buttons 保转牌 and 保河牌, a left-aligned 底池信息, a gold line 「死钱 · 请确认」 with no amount to start from, and two cards side by side that asked for the player and the chips in dialogs, starting from nothing. In a game it read no chips from the table and wrote none back. Its block was headed 「6 outs」 where the other reads 「反超 6 张」.
- Proposal:
  - Outs数速算 is laid out as 选牌计算 is: 底池信息, 池内玩家 and 保险信息 under the same centered titles, with the same arrow by the edge that clears the pot.
  - 底池信息 holds the card the insurance is on, 转牌 or 河牌, in a frame like a street of the board, then the same dead money: 1,000 to start with in dashed light green, framed like the flop once the organizer sets it.
  - 池内玩家 is the same two rows: the name as a menu of the table, the chips typed in place, the small C for a cover. Where 选牌计算 has a player's two cards, the leader's row says 领先 and the other row has the Outs to tap, in a place as wide as the two cards. The small ring under the rows, a plus in 选牌计算, switches who leads here.
  - The rows start as they do in 选牌计算: the first two players of the table with the chips they have there, the organizer first if they play, and 玩家 1 and 玩家 2 with 1,000 each from the tools page. In a game, chips typed go to the table once the field is left, and another player picked in a row brings their own chips, with no cover and no outs. From the tools page a name is only a label.
  - Under each name is where the player stands, as in 选牌计算: the leader's chance to win, and 「Outs 6+1 · 13.3%」 for the player behind. Chances read to one decimal in both.
  - 保险信息 shows as soon as there is enough to price, and until then says what is missing: 「还差：玩家 2（Outs）。填好后这里直接显示保险。」. The block is headed 「反超 7 张 · 赔 4.0」, with tie cards on their own line.
- Settled details:
  - No price changed. The numbers come from the same functions as before; only what is entered above them and how it is laid out did.
  - The count of outs and tie cards is still entered in its dialog, as cards are picked in theirs.
  - The pot's ring shows with the insurance and not before it, as in 选牌计算.
  - Both ways of working stay on the page while the other is looked at, so a pot entered in Outs数速算 is still there after a look at 选牌计算. It was lost before.
  - The shared parts are in one place (`HandSections`), and the row of a player takes what ends it, the cards or the outs. The dialogs that picked a seat and typed chips for the old layout are gone (`SeatPicker`, `PlayerChipsDialog`).
- Decision: do. Checked in the browser preview in dark mode at 412px and 360px, from the tools page and in a game: the defaults, the outs and tie cards, the lead switched, a cover, dead money set, another player picked, chips typed and written to the table, and the prices against the rule. 选牌计算 was opened at both entries after the change. Not yet tried on a phone.
- Tracking: PR #86

### #I-059 Tie cards bought apart from the cards that overtake

- Type: feature
- Date: proposed, decided and completed 2026-11-17
- Source: discussion
- Problem: With 平分牌算 outs on, tie cards were added to the cards that overtake and sold as one cover at the odds for the sum. They could not be bought on their own, and a line under the heading only said they were counted in. On the custom row, a tap anywhere went into the premium, even to pick a premium already typed.
- Proposal:
  - With 平分牌算 outs on and tie cards in the pot, the pot's block has two tables under the one ring: 「反超 6 张 · 赔 5.0」 first, then 「平分 2 张 · 赔 15.0」. Each is priced by its own count of cards. With no card that overtakes, only the tie table shows.
  - The tie table has the same columns as the other, and the rows 保本, 半池, 封顶 and 自定义. A tie cover pays no more than a tie can cost the buyer: of a pot of 300, 150 between two players, and 200 where three would split it. 封顶 is that most, and is a row only where it is more than 半池, so between two players there is none. It has no 分开购买 switch, which is kept for splitting the cards that overtake later.
  - Each table has its own 确认投保 and 不购买. The next card can be picked once both are decided, and each is settled on its own cards.
  - The ring's inner arc shows the row picked last, in either table. With two tables its middle says which: 反超保本, 平分满池. Before anything is picked it shows the first table's 保本.
  - 中了到手 in the tie table counts the part of the split pot the buyer still wins: on a pot of 3,000 with a tie cover that pays 1,005 for 67, a tie leaves 1,500 + 1,005 − 67 = 2,438. It never comes to more than the pot.
  - The custom row: with no premium typed, a tap anywhere on it goes into the premium with the 0 selected, as before. With a premium typed, a tap on the premium goes into it with all of it selected, and a tap anywhere else on the row only picks the row.
  - A purchase on tie cards reads 「平分 4 张」 in the settlement of a street and in 保险记录, where one on the other cards reads 「2 outs」.
- Settled details:
  - Both ways of working and both entries use it, as they share the block. In Outs数速算 the outs and the tie cards typed are the two counts, and a tie leaves each of the two players half the pot.
  - In Outs数速算 each count may now be as large as the odds table, since each is priced on its own. Together they were held to the table's length.
  - With 平分牌算 outs off, nothing changes: the tie cards are named under the heading as not counted.
  - A tied lead that cannot be insured, or a pot with no cards to sell, says so once and not once per table.
  - A first version gave the tie table the other's rows, 满池 included, which paid the whole pot while half of it was still the buyer's: 4,300 from a pot of 3,000. The organizer then set the limit at what a tie can cost ([ADR 0033](adr/0033-tie-cards-sold-as-their-own-cover.md)).
  - What a tie can cost is worked out from the cards: the smallest share any tie card leaves the buyer. Three players in a pot do not make it two thirds if no card splits it three ways. In Outs数速算 there are two players, so it is half.
  - How tie cards are insured elsewhere was looked up. The one platform whose rules could be read first hand does not count cards that split the pot as outs at all, and two write-ups say the same. No rule for a cover on tie cards was found, so this one is the game's own.
- Decision: do. Checked in the browser preview in dark mode at 412px: both tables in Outs数速算 from the tools page, tie cards only, the switch off, the ring after a pick in each table, the custom row with and without a premium, and in a game a hand from the cards where one cover was bought and the other turned down, a tie card dealt and settled, and a tie purchase from Outs数速算 in 保险记录. The limit was checked at 393px with a tie between two and a tie among three. Not yet tried on a phone.
- Tracking: PR #87

### #I-060 Dead money typed in place, a larger pot ring, and smaller figures in the cover table

- Type: feature
- Date: proposed, decided and completed 2026-11-17
- Source: discussion
- Problem: A tap on dead money opened a dialog with a line for each pool to add up. The pot's ring was small beside its legend, and the figures in the cover table were as large as the text, so five digits were crowded and six ran into the next column.
- Proposal:
  - A tap on dead money goes into the amount in its frame, with all of it selected, to type over in place. No dialog. A tap on dead money in a pot's legend lands in the same field.
  - The ring is 144px across, from 112px, with thinner strokes: the outer ring and the inner arc are each about a third thinner than at first. In the legend beside it a name and its chips share a line, with the chances on a line of their own under the name, and the dot of color before each name is 10px, from 12px.
  - A box about a pot is headed by its name at the left, at 17px, a little under a section's title, and its chips at the right. This holds for a pot's insurance block, 主池 or 边池, and for the two overviews, 有效总底池 and 总底池, which had the name small and gray over the chips. In 有效总底池 the switch between ring and bar is a small icon straight after the name.
  - The figures of the cover table are 14px, a size under the text. The names of the rows keep the size of the text.
- Settled details:
  - The limit is an iPhone 16, 393px wide. There a name of six characters and chips of six digits share a line of the legend without wrapping, five digits sit easily in a column of the table, and six just fill it without touching the next.
  - The chances moved under the name because a name, the chances and the chips do not fit on one line beside a larger ring. On a narrower phone a long name is cut short, as before.
  - Dead money is one amount now. It is kept as one folded player's chips, as the amount a pot starts with always was: with side pots it fills the main pot up to the smallest stake and the rest goes on to the side pots. Dead money from several folded players can no longer be entered a player at a time. A hand kept with several pools shows their sum, and typing replaces them.
  - Typing an amount, or Enter on the amount a pot starts with, makes it the organizer's own, and the frame turns from dashed green to that of the flop. Leaving the field untouched leaves it as it was.
  - The amount is 16px, as is the custom premium, which is drawn at the size of the figures around it: under 16px a phone zooms the page when a field takes the focus.
  - Dead money's frame has the stack, the name and the amount one under the other. Side by side, name and amount pushed the frame off the board's line once the river was on it.
  - `DeadMoneyDialog` is removed.
- Decision: do. Checked in the browser preview in dark mode at 393px with names of six characters, stakes of 250,000 and dead money of 100,000: nothing in the pot's block was wider than its place, and the page did not scroll sideways. The board's line was checked with the river on it, and the three headings in a hand with a side pot and in one dealt to the river. Not yet tried on a phone, where the keyboard and the zoom on focus matter.
- Tracking: PR #87

### #I-061 A pot drawn as three rings

- Type: feature
- Date: proposed, decided and completed 2026-11-17
- Source: discussion
- Problem: The pot's ring had one arc inside it for a cover: as long as the payout, with the premium laid over its start. The two could not be read apart where they overlapped, and nothing tied the premium to the dead money it is usually paid out of.
- Proposal:
  - The outer ring reads clockwise from the top: the leaders, then the players behind, then the dead money, which so ends at the top. It read dead money, leaders, players.
  - A middle ring is what the cover picked pays, clockwise from the top, as long as its part of the pot share: half a turn for half the pot, the whole turn for a full pot. It is a little wider than the ring inside it.
  - The inner ring is the premium. Where the pot has dead money it runs back from the top first, under the dead money of the outer ring, until it is as long as that. Only what is more than the dead money goes on clockwise from the top. With no dead money it is all clockwise.
- Settled details:
  - The payout's ring is a bright green at full strength (`#45e06a`), so it stands clear of the leader's green in the ring around it. It was first the win color at part strength, which read too dull, then a neon green (`#39ff14`), which was harsh. The premium is a dark red at full strength (`#c8423a`), a little brighter than the darkened loss color it had.
  - Four other colorings were drawn at the size of an iPhone 16 first, three at half strength and one at 85%. Half strength over the dark page came out darker than the leader's own green, whatever the hue, so a bright color at half strength was not to be had. The colors in use were kept.
  - The legend beside the ring was already in the order the outer ring now has.
- Decision: do. Checked in the browser preview at 393px by the arcs drawn: dead money larger than the premium, a premium larger than the dead money, and no dead money. Not yet looked at on a phone.
- Tracking: PR #87

### #I-062 Outs given up, in a dialog that manages an offer's cards

- Type: feature
- Date: proposed, decided and completed 2026-11-18
- Source: discussion
- Problem: An offer was sold on all of its cards or not at all. A buyer who did not want to pay for some of them, or whose outs ran past the odds table, had no way to leave cards out. Under the heading, the cards that overtake were listed a line for each opponent, which repeated cards good for more than one.
- Proposal:
  - Under an offer's heading the cards it is bought on are one line, whoever they are good for.
  - After the heading 「反超 2 张 · 赔 15.0」 is a pen that opens 「主池 反超 Outs 管理」, or 平分 for tie cards. It is there in 选牌计算 only, as Outs数速算 knows no cards. It is dimmed for an offer of one card, where there is nothing to choose, and for an offer already bought or turned down.
  - The dialog has two parts. The first is headed 「反超 3 / 5 · 赔 6.0」, the cards bought of all the cards, with the total in gray and the odds for the cards bought, then those cards, then 弃买 at the right under them. The second is headed 「弃买 · 2 / 5」, then the cards given up, then 购买. Under both are 取消 and 确认.
  - A tap picks a card out, any number of them, and another tap lets it go. 弃买 lights once a card bought is picked and moves the cards picked to the second part; 购买 does the same the other way.
  - At least one card stays bought. Moving the last says 「最少保留一张 Outs，如不想购买可在保险主界面选择」.
  - 确认 keeps the change and closes, with nothing asked. 取消 asks 「取消本次修改？」 only if something was changed.
  - With cards given up, the offer's heading on the page reads 「反超 3 / 5 · 赔 6.0」, the cards bought on the first line under it and 「弃买 : 7♠ 7♥」 on the second. The covers are priced on the cards bought, and a purchase pays on those only.
- Settled details:
  - The cards given up are kept on the hand by offer (`skippedOuts`), and an offer leaves them out: `handOffers` gives each offer the cards it sells, all its cards, and those given up. A card no longer among the outs is ignored, and giving up every card gives up none.
  - A change to the pot or the players, which already opened every decision again, also takes back the cards given up.
  - An offer with more outs than the odds table keeps its heading and pen, so it can be brought within the table by giving cards up.
  - Buying some of the cards apart from the rest followed in #I-063.
  - Closing the dialog with the Escape key drops the change without asking.
- Decision: do. Checked in the browser preview in dark mode at 393px in 选牌计算 from the tools page: cards given up and bought back, the last card refused, 确认 and both ways of 取消, and the heading, lines and prices on the page after. Not yet tried on a phone or in a game.
- Tracking: PR #87

### #I-063 Outs sold as two covers, and an outs dialog that sorts and picks by the part

- Type: feature
- Date: proposed, decided and completed 2026-11-18
- Source: discussion
- Problem: The outs dialog of #I-062 could only give cards up. A card picked out was shown by a ring that faded in, which did not show at all on a phone set to reduce motion. With many cards there was no way to pick them all or to see them by suit. The 分开购买 switch on the page still did nothing.
- Proposal:
  - A card picked out is framed in green with a tick on its top right corner. Neither fades in, so both show whatever the system does about motion.
  - Each part's heading ends in a button that switches the order of its cards between 大小, the highest first, which it starts as, and 花色, suit by suit.
  - Under each part's cards, at the left, are 全选, which picks every card of the part, or none if all are picked, and 反选, which turns the pick round and can be pressed while some but not all are picked.
  - Left of 弃买 in the first part is 分开买. It can be pressed while some but not all of the part's cards are picked, and makes them a second cover: the first part is then 反超 I and the new one 反超 II, or 平分 I and 平分 II, each with its own count and odds.
  - With two covers, the button in that place reads 池 II in the first and 池 I in the second, and moves the cards picked to the other. The second has a bin at the end of its first line of cards, which gives all its cards up. A second cover left without cards goes, and the first is 反超 again.
  - 购买 looks like 弃买: it had a filled look of its own.
  - On the page the 分开购买 switch is gone. With two covers, the second has its own heading, table and decision under the first: 「平分 I 3 / 4 · 赔 10.0」, then 「平分 II 1 / 4 · 赔 30.0」.
- Settled details:
  - Each cover is priced on its own cards, with the same targets and the same limit as one cover would have, and pays on its own cards only. Four tie cards at 8.0 become three at 10.0 and one at 30.0.
  - With two covers, the part of cards given up has 池 I and 池 II in place of 购买, to say which cover a card goes back to.
  - Moving every card of the first cover to the second leaves one cover, which is then the first.
  - At least one card stays bought across the two covers. A cover may be emptied by giving its cards up as long as the other holds some.
  - The cards of the second cover are kept on the hand by the kind's key (`splitOuts`), beside the cards given up. The second cover's own key ends in `-2`, and every offer of a kind carries the key they share (`baseKey`). Both are optional in backups.
  - The pen is dimmed once either cover of a kind is bought or turned down.
  - The ring's middle names the cover its arcs are for with its part: 平分I保本.
  - The switch is gone from Outs数速算 too, which shares the block and has no cards to split.
- Decision: do. Checked in the browser preview in dark mode at 393px in 选牌计算 from the tools page: each button in each state, a split made, cards moved both ways, a card given up from the second cover, the second cover binned, emptied and made again, the order switched, and the two tables on the page after 确认. The look of a card picked out was checked by its styles, which have no transition. Not yet tried on a phone or in a game.
- Tracking: PR #87

### #I-064 Pot columns on one line, a pot's ring pinned over its tables, and one heading for every table

- Type: feature
- Date: proposed, decided and completed 2026-11-18
- Source: discussion
- Problem: In 总底池 a pot with a second line about its outs stood higher than the pot beside it, so neither the columns nor the names 主池 and 边池 lined up. Scrolling through a pot's tables took its ring off the page, and with it what the arcs in it stood for. The headings of the tables read differently with and without cards given up, in two sizes, with the pen straight after the text.
- Proposal:
  - The columns of 总底池 stand on one line, and the names under them sit on one line. A pot with tie outs has one more line under its name, and the others do not move for it. The columns have square corners.
  - While a pot's tables scroll, its name, chips, ring and legend stay at the top of the page. They let go once the heading of the pot's last table has gone under them.
  - Every table is headed the same way, at one size: 「反超 · 3 / 5 张 | 赔 15.0」. The first part is 反超 or 平分, with I or II where the cards are sold as two covers. The total stays gray. The pen is at the right end of the line.
  - The cards given up are named under each of the two covers, not only the first.
- Settled details:
  - The total is always there in 选牌计算, also when nothing is given up: 「反超 · 4 / 4 张」. Outs数速算 has no cards, so it reads 「反超 · 7 张 | 赔 4.0」 and has no pen.
  - The stretch the ring is pinned over ends with the last table's heading, so that table's own rows scroll past with nothing over them.
- Decision: do. Checked in the browser preview in dark mode at 393px with a hand of three players and a side pot: the columns' bottoms and the names' tops at the same height, the corners square, the headings' text, and the pinned ring's place at six points of the scroll. Not yet tried on a phone.
- Tracking: PR #87

### #I-065 One card picker for the whole hand, kept as it is tapped

- Type: feature
- Date: proposed, decided and completed 2026-11-18
- Source: discussion
- Problem: The flop, the turn and each player's cards each opened a picker of their own, which kept nothing until 确认 and had to be closed before the next could be opened. A card taken elsewhere was only grayed, with nothing to say by whom. The arrow that cleared the board also put dead money back to what a pot starts with.
- Proposal:
  - The arrow moves to the right of the flop's name, and clears the flop and the turn only. Dead money is left as it is.
  - The picker's title is a menu: 翻牌, 转牌 and each player in the pot, each with the cards it has of the cards it takes at the end of its line, 「(2/3)」. A tap on a line picks for that one, without leaving. 转牌 is gray, and cannot be picked for while the flop is short.
  - At the right of the title an arrow takes back every card picked here: the board and every player's cards.
  - A card taken is framed and carries a very small mark of whose it is: 翻, 转, or the first character of a player's name, its first two letters for a name in letters. Players who would share a mark are numbered, 王1 王2 or Ki1 Ki2. Board cards are in the chip gold and players' in green. Cards of the one being picked for are bright; the others are dimmed, with their mark, and cannot be tapped.
  - A tap is the pick and is kept at once, so going to another line or leaving loses nothing. A hand may be left short of cards, and reads as not yet filled in. 确认 only closes.
  - A tap on one of a player's two cards on the page opens the picker with that card let go and the other still picked. The next tap picks its replacement; a tap on the other card lets that one go too.
- Settled details:
  - The flop works as before: a card is let go by a tap, and a fourth is not picked until one is. The turn is one card, which the next pick replaces.
  - While a flop card is being changed the flop is short, and a turn already picked is set aside. It comes back with the third flop card, unless it was taken in between.
  - 取消 is gone from the picker, as there is nothing to take back.
  - The card dealt through a hand first kept the old picker, and moved to this one in #I-066.
  - The arrow by the flop's name is 32px, under the 44px kept elsewhere, as it sits inside the board's line.
- Decision: do. Checked in the browser preview in dark mode at 393px from the tools page: a flop of two kept when moving to a player, the lines of the menu and the turn refused, a third card for a player ignored, the turn replaced, the turn set aside and back again, and the picker opened from a player's card. Not yet tried on a phone or in a game.
- Tracking: PR #87

### #I-066 A sliver on the pot ring, cards dealt in the hand's picker, and Outs数速算 recorded to the card

- Type: bug, feature
- Date: reported, decided and completed 2026-11-18
- Source: trial on a phone, discussion
- Problem: On a phone, a pot of 7,560 with 600 of dead money drew a gold sliver at the top of the ring, running from the dead money into the leader's part. Other amounts of dead money, or a cover, did not. Apart from that, the card dealt through a hand still had the old picker, and Outs数速算 had no pen on its tables, kept the pot open to change after a cover was bought, and had no way to say whether the card came.
- Proposal:
  - Every arc of the ring is drawn as one dash that begins where the circle's outline begins, turned into its place, with a gap two turns long after it. This holds wherever the ring is used: the insurance block of both ways of working, at both entries, and the overview.
  - 记录转牌 or 记录河牌, by what the board needs, stands under the insurance in both ways of working. It cannot be pressed until every offer is bought or turned down. It was 选择转牌 in 选牌计算, and missing in Outs数速算.
  - In 选牌计算 it opens the hand's picker for that card alone: the title does not open, there is no arrow to clear, the cards already in show whose they are and cannot be changed, and 取消 stands beside 确认, which waits for a card. The river is picked nowhere else.
  - In Outs数速算 it asks 「转牌击中保险？」 with 击中 and 未击中. With covers on both kinds of card it asks which came: 击中反超, 击中平分 or 未击中.
  - Outs数速算 has the pen at the right of each table's heading, as 选牌计算 has. For now it says 功能开发中.
  - Once a cover is bought in Outs数速算, the card insured, the dead money, the players, their chips and outs and who leads can no longer be changed.
  - The line under a cover bought reads 「已投保 · 保费 25」, without the payout under it, which is on the row above.
- Settled details:
  - The cause of the sliver: an arc was a dash pushed along the outline by an offset, with a gap of just the rest of the turn. For the last arc, which ends at the top, the pattern then began exactly on the edge between its dash and its gap. Whether a renderer drew a hair of the dash there depended on the rounding of those exact lengths, which is why one amount of dead money showed it and others did not. It could not be made to show in the desktop browser, so the fix rests on the reasoning, and on no arc beginning on an edge any more.
  - Answering in Outs数速算 settles the covers bought in the game, each as hit or missed, and clears the outs for the next pot. From the tools page, where nothing is recorded, it only clears them.
  - A cover turned down does not close the pot to change; only one bought does.
  - The old picker, with nothing left to use it, is removed (`CardPicker`).
- Decision: do. Checked in the browser preview in dark mode at 393px. In a game, Outs数速算: the pen and its notice, the button waiting for both offers, the pot closed after a purchase, the question with both kinds, and a hit settled in the records with the seat's chips. From the tools page, 选牌计算 with the reported hand and chips: the arcs as drawn, and a turn dealt in the picker with the title shut and the other cards closed. Not yet tried on a phone, where the sliver showed.
- Tracking: PR #87

### #I-067 Quick picks and lined-up figures in the basic setup rows

- Type: feature
- Date: proposed and decided 2026-11-19
- Source: discussion
- Problem: The ratio, blinds and Buy-in rows could only be changed through a dialog, though most games use a few common values, and their numbers sat at different places from row to row.
- Proposal:
  - The 积分 list names the two as 袋鼠分 and 熊猫分.
  - 筹码 is renamed 比例 and reads `chips [chip mark] = points [points mark]`.
  - 比例, 盲注 and Buy-in each end in a chevron listing common values, which fill the row at once: 1:1, 5:1, 10:1, 20:1; 1/1, 1/2, 5/5, 5/10, 10/10, 10/20; 50BB, 100BB, 200BB.
  - Every figure is typed in place: a tap selects it and typing replaces it, with no dialog. The ratio, blind and Buy-in dialogs are gone.
  - 盲注 reads `small SB / big BB`, with each blind in points in small type above it, updated as it is typed.
  - Buy-in reads `big blinds BB ⇔ chips [chip mark]`. A mark after its title switches the right-hand figure between chips, the default, and points.
  - Options below run 保险, 工资, 台费, 抽水.
- Settled details:
  - Every figure is centered in a slot that holds 3 digits on the left and 4 on the right, so figures and marks line up across rows; a longer number widens only its own row. The last mark of each row sits under the 积分 mark.
  - Points show no decimals when they have none: 1 for 1.00, 2.50 for 2.5.
  - The Buy-in switch only changes what is shown and is not saved.
  - Buy-in works both ways: typing the hand's chips, or its points, sets the big blinds per buy-in whenever it comes to a whole number of them, and the nearest on leaving the field. The ratio and the blinds never change from it.
  - The old line under Buy-in, 1 手 = … 筹码 = …, is gone, as the row now says it.
- Decision: do. Checked at 360 and 393 wide in the browser preview, dark mode.
- Tracking: PR #90

### #I-068 Rake rules, records of each pot, and 抽水计算 on the tools page

- Type: feature
- Date: proposed and decided 2026-11-19
- Source: discussion
- Problem: rake was fixed at 10% of the pot, rounded down, with no cap and no way to change it; only the total was kept; and 抽水计算 on the tools page was a placeholder.
- Proposal:
  - Game setup has rake in the same style as the other options: its config on the switch row, 保存配置 for a valid new config, and last time's values carried over.
  - 比例 takes decimals, with quick picks of 2.5%, 3%, 5% and 10%, default 5%, shown without decimals it does not need.
  - 封顶 has a switch, off by default, which fades and strikes through its title. On, it reads `单笔最多收：2 BB ⇔ 4 [chip]`: either figure can be typed and the other follows, and a tap on the chip mark shows points. A line under it reads `等值最大底池：400 [chip]`, the cap over the rate, always in chips with its mark under the one above; typing a pot sets the cap to that pot's rate in the cap's unit, so the pot comes back as typed.
  - On a narrow card (under 320px) the cap and rounding rows put their figures on a line of their own, decided by the width so typing never moves them between lines (by the screen's width since #I-069). A figure keeps one width whether it is being typed or not.
  - Fixed from trying the preview: two fields tapped in quick succession took focus back from each other without end, as the delayed select-all also focuses a field; it now selects only a field that still has focus. The max pot no longer drops below what was typed: it was the pot where the rounded rake first reached the cap.
  - 取整 has a switch, on by default, then 四舍五入 (default), 向下取整 or 向上取整, and the smallest chip as `最小筹码面值: 1 SB ⇔ chips` in the same way, lined up under the cap, with `超出部分: 四舍五入` on the line under it. The default is 1 SB.
  - The cap and rounding share one grid: the colons of 单笔最多收, 等值最大底池, 最小筹码面值 and 超出部分 line up, as do the figures, and the rounding chevron sits under the chip marks above.
  - 保险报价先扣除抽水 is kept as a switch, off by default, marked 开发中.
  - The rake dialog keeps each rake with its time and, when worked out from a pot, the pot, and lists them under 记录.
  - 抽水计算 on the tools page opens the same dialog with the default rule, reading and saving nothing, under the icon the rake seat has on the game page.
- Settled details:
  - No flop no drop, a minimum pot and rake per side pot are not done. Rake goes only to the host.
  - The cap is rounded down to the smallest chip, and the rake after rounding never passes it. An amount in big blinds uses the game's big blind; the unit last typed is the one kept.
  - The default cap of 2 BB follows live rooms, which cap at about $4–6, a couple of big blinds at $1/$2.
  - With rounding off, the rake rounds down to whole chips.
  - Wages at setup in the same round: 基础薪资 for 基础时薪, figures centered with no underline in a slot for 00.00, 精确到 每分钟 / 每15分 / 每30分 / 每小时, 超出部分 with its info mark before the rounding, and 根据时间 and 根据时长 for the two kinds of segment. The 精确到 row sits closer under 基础薪资, and the info mark before 超出部分 is the size of that text and explains only the rounding and the stretches of time.
  - The table fee in the same style: 基础台费 with its amount at the right as `¥ 100.00 /人/台`, centered in a slot for 000.00, and 在桌满 5 分钟收 as a switch at the right, on by default, with 防止误添加玩家产生台费 under it. The minutes are fixed at 5; a game set up with another time keeps it while the switch is on. With the switch off, 上桌就收 shows in small gold type after 基础台费, and the amount reads `/ 人 / 台`.
  - Games with the older rule keep 10% rounded down, and carry it over that way.
  - Online rooms take rake off the pot before pricing an all-in cash-out; nothing was found for live games, so the insurance switch waits for a decision.
  - Settlement is unchanged, apart from its rule line naming the new settings. Backups move to version 14.
- Decision: do. Checked at 393 wide in the browser preview, dark mode.
- Tracking: PR #90, ADR [0036](adr/0036-rake-rules-and-pot-records.md)

### #I-069 Insurance prices rounded to the smallest chip, and info on 超出部分

- Type: feature
- Date: proposed and decided 2026-11-20
- Source: discussion
- Problem: insurance priced in whole chips, so at a table whose smallest chip is 5 the organizer rounded premiums by hand. Rake's 超出部分 had no explanation.
- Proposal:
  - Insurance gets 取整 laid out as rake's: a switch, on by default, `最小筹码面值: 1 SB ⇔ chips`, and `超出部分: 四舍五入` with 向下取整 and 向上取整. It sits above the odds table at setup, and under the settings at the top of both insurance tools.
  - The rounding takes the place of the whole-chip edges of ADR 0032: premium and payout both round by the mode, and the premium is at least one smallest chip.
  - In the tools, with no small blind, the smallest chip is typed in chips, 1 by default, and its chevron in place of the chip mark offers 1, 5, 10 and 20.
  - A saved insurance config keeps the mode and the number of small blinds, never the chips. Changing only the chips in the tools keeps the config's name.
  - Rake's and insurance's 超出部分 each get an info mark before them explaining their rounding.
  - On the insurance pages the 取整 switch ends the 保费上限 line, and when on, the smallest chip and 超出部分 share the line under it, each figure only as wide as its digits; under 386px they wrap. 保存配置 moves under the rounding, at setup and on the pages.
  - Fixed from trying the preview: a list opened in the insurance or rake card at setup showed under the next card, and taps beside it went through to that card. The cards were containers for the narrow layout, which shuts in what opens from them; the narrow layout now goes by the screen's width instead (under 386px, where a card's content is under 320px). Every list at setup and on the insurance tool was checked to be on top.
- Decision: do. Checked at 393 and 360 wide in the browser preview, dark mode.
- Tracking: PR #90, ADR [0037](adr/0037-insurance-prices-rounded-to-the-smallest-chip.md)

### #I-070 抽水计算 shows and changes the rake settings, and the insurance rounding line at setup

- Type: feature
- Date: proposed and decided 2026-11-20
- Source: discussion
- Problem: 抽水计算 showed the rule only as text behind a gear, to be changed in 开局设置, and the tools' copy always used the default. At setup, insurance's rounding was still laid out in rake's grid, unlike the insurance pages.
- Proposal:
  - At setup, insurance's 取整 switch ends the 保费上限 line too, with the smallest chip and 超出部分 on the line under it, as on the insurance pages. To fit a phone's card, the chips after ⇔ have no mark and each figure is only as wide as its digits.
  - 抽水计算's title reads `抽水计算 · preset ⇅`: a tap on the preset lists the others in the dialog, with no dialog of its own, and one more switches to it. A chevron at the end of the line opens the same fields as 开局设置 (比例, 封顶, 取整, 保险报价先扣除抽水, 保存配置), and switching preset opens them. The fields' titles take lines of their own there, as the dialog is narrower than a setup card.
  - From a game it starts closed, and its settings are the game's own: a change asks 「这个修改会应用到本局，之后的抽水都按新设置计算。继续？」, is saved with the game, and goes back if turned down. A number being typed asks once, when its field is left; taps on switches and lists ask at once. The game's insurance page now asks the same way, where it asked at every key of the smallest chip.
  - From the tools it starts open, in chips alone: the cap and the smallest chip have no blinds to go by, the smallest chip has 1, 5, 10 and 20 under a chevron, and the settings are kept in this browser. A preset in blinds is shown as the tool prices it: a smallest chip in blinds as 1 chip, and a cap in blinds switched off.
- Decision: do. Checked at 393 wide in the browser preview, dark mode, with a test game on an isolated preview origin.
- Tracking: PR #90

### #I-071 基础设置 as a card with its own configs, and a fuller 抽水计算 record

- Type: feature
- Date: proposed and decided 2026-11-20
- Source: discussion
- Problem: the four basic rows at setup had no title and no configs of their own, unlike the options under them. 抽水计算's record named only the pot or 手动输入, with no running total.
- Proposal:
  - The 积分, 比例, 盲注 and Buy-in rows sit in one card titled 基础设置, always open, with no switch and no lines between the rows, so they read as one, like the cards under it. Its config sits at the right of the title, where the other cards have theirs: 上次配置 (本局配置 in a game's settings), 默认配置 and saved ones. 保存配置 shows under the rows for a valid change that matches none of them. Configs are kept with the table fee, wage and rake configs, as `SavedChargeRule` of kind `basics`. With ledger records, a config picked in a game's settings changes only the blinds, as the rest is locked.
  - 抽水计算's 记录 is a table of 时间, 输入 (底池, 增量 or 修改), 底池, 变化 and 总抽水, latest first. The pot of an 增量 is the smallest pot that gives it under the rule now in use, shown faintly; a 修改 has N/A. 变化 is green for a rise and red for a fall, and 总抽水 is the total after it.
  - The record sits under 撤销 and 返回, with the latest 3. Its line reads `记录 (N)` with the total count, after a record mark, in gold, and stays with the table's head before there are any records. A tap on it opens every record in a dialog of its own; there is no scrolling window.
  - Fixed on the way: closing a dialog opened from 抽水计算, such as all the records, 保存配置 or an info mark, closed 抽水计算 too, as React passes a dialog's close on to the one it was opened from. 抽水计算 and the shared modal now act only on their own.
  - A rake event keeps `typedOver` when the total so far was typed over. Rakes from before count a fall as 修改. Backups stay at version 14.
- Decision: do. Checked at 393 wide in the browser preview, dark mode, on an isolated preview origin.
- Tracking: PR #90

### #I-072 Pages that would not open after a release

- Type: bug
- Date: found and fixed 2026-11-20
- Source: the organizer, after #91 went live: 开局设置 and 工具 showed 「Something went wrong!」 with `Failed to fetch dynamically imported module` for their own files, on desktop Chrome
- Problem: the files were on the host and the host was fine. Cloudflare Pages answers a file it does not have with the app's page and status 200, as single-page apps need, and the offline cache keeps whatever it gets. A file not there while the offline cache filled in a new version was kept as that page under the script's name, so the page failed on every visit, and refreshing did not help. The same broken entry was made in the preview by hiding a file, and a refresh after putting it back still failed.
- Proposal:
  - When a page's files cannot be loaded, the app drops scripts and styles the offline cache holds as HTML, fetches them again and keeps them where the host has them, then reloads once. A second failure within 10 seconds is left to show, so the page never reloads without end. Only the offline cache is touched; games and players live in IndexedDB.
  - A page that fails shows 页面没能打开 with a 刷新 button that does the same repair, in place of the router's English message.
- Decision: do. Checked on a production build in the preview: with the setup page's file held as HTML in the offline cache, tapping 开局 reloaded once and opened the page, with the real file back in the offline cache; with the file missing, it reloaded once and then showed the new page. Not tried on the device where it happened.
- Tracking: PR #92

### #I-073 Game configs that follow their sections' saved configs, updated in place

- Type: feature
- Date: proposed and decided 2026-11-20
- Source: discussion, on how saved settings should be kept so they are easy to use in each game and to look after later
- Problem: a game config and the configs of its sections were separate copies. After a wage config was changed, the game config that used it still filled the next game with the old rate. A section's name on the setup page came from comparing values, so settings changed from a config read 自定义 and could only be saved back by typing the config's name again. The game config's name at the top right stayed after the settings were changed. Table fee and wage configs carried no currency.
- Proposal:
  - Each section of a game config names the saved config it was taken from and keeps the values too. Using the game config takes each named config's values as they are then; the kept values hold once that config is gone. Games keep their own copy as before, and also name the configs, so of two with the same values the one used shows at the next setup.
  - Values changed from a saved config stay with it: the section reads `name · 已修改`, with 更新「name」 to save them into it and, when they match no other config, 另存为 for a new one. This holds at setup, in a game's settings, on the insurance pages and in 抽水计算.
  - The game config at the top right has 已修改 under its name once the settings differ from what it would fill in now. 保存全局设置 (保存当前配置 until #I-075) offers that name, so 保存 updates it and another name keeps a new one.
  - Saving new values into a config, or new odds into an odds table, that game configs follow asks first and says how many follow it. Deleting one says so too, and those game configs keep the values it had.
  - Table fee and wage configs keep the currency they were set in, shown by its mark before the name in the list, with those of another currency last.
  - Backups are at version 15: the configs named, when each config was last saved, and the currency. Earlier backups read as before.
  - Fixed on the way: a long name beside the 开局设置 title ran under the title on a narrow screen. The side columns now keep to their share and the name is cut short.
- Decision: do, with game configs that follow rather than ones that stay as saved, as the organizer chose. One table for all saved configs, a page to manage them, and a restore that takes the newer of two are left for later. Checked in the browser preview at 393 and 360 wide, dark mode, on an isolated preview origin: a wage config saved and used in a game config, changed and updated, the game config then filling in the new rate, and the config deleted with the game config keeping it.
- Tracking: PR #93, [ADR 0038](adr/0038-game-configs-follow-saved-configs.md)

### #I-074 Rake configs with amounts in blinds only

- Type: feature
- Date: proposed and decided 2026-11-20
- Source: the organizer, on why a rake config in blinds could not be updated from the tools in #I-073
- Problem: a rake config kept its cap and smallest chip in chips or in blinds, whichever box was typed in last, and the tools saved configs in chips. Insurance keeps only small blinds and works the chips out at each game, which is what the organizer expected of rake too. Updating a config from the tools would have rewritten its blinds as chips.
- Proposal:
  - At setup and in a game, chips or points typed for 封顶 or 最小筹码面值 are kept as the blinds they come to, so the amount follows the game's blinds. The chips box shows whole chips as the rule uses them, and is closed while the blind is not known. 等值最大底池 sets the cap in big blinds.
  - A rake config saved or updated there keeps blinds only. One from before, with chips, shows and counts in blinds once picked at a game, when its chips come out the same.
  - 抽水计算 in the tools stays in chips, kept in the browser. Picking a config brings its 比例, 取整 and switches and leaves the chips typed there. Saving or updating a config from the tools keeps those and the config's own cap and smallest chip in blinds; the name dialog says so. Changing only the chips there leaves the config's name, with nothing to save. 更新 now works there for every config.
- Decision: do. How rake is worked out is unchanged, and so are backups. Checked in the browser preview at 393 wide, dark mode, on an isolated preview origin: a cap of 25 chips typed at blinds of 5/10 kept as 2.5 BB; in the tools, chips typed left the name alone, a config picked kept them, and 更新 after a new rate kept the cap at 2.5 BB; a config made in chips showed as 3 BB and 1 SB at setup, unchanged.
- Tracking: PR #93, [ADR 0039](adr/0039-rake-configs-keep-amounts-in-blinds.md)

### #I-075 设置 for every saved config, switched in place, and checks on what setup takes

- Type: feature
- Date: proposed and decided 2026-11-20
- Source: the organizer, on the setup page after #I-073
- Problem: saved setups were called 配置 beside pages and cards called 设置, and the whole setup had no name of its own. Switching one took a dialog, and the whole setup a second one to confirm. The page's title sat in the middle, with the picker squeezed beside it. Number fields took letters and minus signs, a start that was refused said nothing, and a rake cap under the smallest chip quietly took no rake.
- Proposal:
  - Wording: 配置 reads 设置 everywhere, in names offered for saving too (`工资设置_11-20`, and `基础设置_11-20` for the basic settings). The whole setup is 全局设置: the button under the form reads 保存全局设置, and the questions asked before a change name it so. Its picker beside the title shows only the name of the one in use, as where it sits says what it is. 对局配置 on the games page reads 对局设置.
  - The default, last time's and the save button carry what they belong to, so none reads like another's: 默认全局设置 and 上次全局设置 for the whole setup, 默认工资设置, 上次工资设置 and 保存工资设置 for wages, and so for 基础设置, 保险, 台费 and 抽水. In a game's settings the game's own values read 本局工资设置 and the like.
  - Saving the whole setup under a name already in use says under the field, in gold, that it replaces that one, with nothing to confirm.
  - 保险报价先扣除抽水 is held off and cannot be switched for now, as it has no effect yet.
  - 开局设置's title is at the left, as on every page, with the picker at the right, reading `name · 已修改` once the settings are changed, like each section's.
  - Switching takes one tap and nothing to confirm, for the whole setup and for every section: the list hangs under the name, each saved one with a bin. With more than five saved ones, not counting 上次设置 and 默认设置, the list opens as a dialog instead. One component does this at setup, in a game's settings, on the insurance pages and in 抽水计算.
  - 上次设置 is listed only when last time's values are neither a saved one nor the default; otherwise they go by that name. This now holds for the whole setup too, which also starts on 默认设置 with no game before it.
  - Lists read in one order: 上次设置, 默认设置, then the saved ones, oldest first. 超出部分 reads 四舍五入, 向下取整, 向上取整 for wages as it does for rake and insurance.
  - Number fields at setup let through digits, and a decimal point where decimals are allowed, so no minus sign or letter gets in. A start or a save refused for an invalid value says so above the buttons, until every value is valid. An invalid rake percentage says what it may be. A cap under one smallest chip, which takes no rake at all, says so.
- Decision: do. 保存全局设置 was first written as 保存全局配置 in the same note; the organizer confirmed 设置 throughout. Saved ones keep the names they were given. Checked in the browser preview at 393 and 360 wide, dark mode, on an isolated preview origin.
- Tracking: PR #93, [ADR 0038](adr/0038-game-configs-follow-saved-configs.md)

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
