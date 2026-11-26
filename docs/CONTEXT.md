# Project background and confirmed decisions

This file records the product background that ADRs don't cover: the original requirements, rules the user has settled, open questions and known pitfalls.
For technology comparisons see the [ADRs](adr/), and for scheduling see the [roadmap](ROADMAP.md).

## Working together

- Discussions with the user and interface text are in Simplified Chinese. Everything in the repository and on GitHub is in English.
- The user makes the big decisions: list the options, their trade-offs and a recommendation, and don't decide for them.
- This GitHub repository is the source of truth. The two development machines only sync through GitHub: run `git pull` before starting and push when done.

## Product name

The English name leads for now, including on the home screen. The Chinese names are on record only and aren't shown in the app yet. See [ADR 0020](adr/0020-holdem-knight-naming.md) and [ADR 0021](adr/0021-brand-identity.md).

| Where | English | Chinese |
| --- | --- | --- |
| Brand (everyday name, logo) | Hold’em Knight | 有局 |
| Full name (app stores, page title) | Hold’em Knight · Tablebook | 有局·德州账本 |
| Home screen icon | Holdem Knight | 有局 |
| Slogan (optional) | — | 你的守局骑士 |
| Code, domain, packages | `holdem-knight` (no apostrophe) | — |
| Visual identity | See [docs/brand/README.md](brand/README.md) | — |

## Original requirements

The user is an **organizer (the game host)**, not a player. The app assists with live Texas Hold'em games:

- Recording chip buy-ins and the final settlement
- Calculating Hold'em "insurance"
- Tracking session time for each player, to work out dealer pay
- Calculating each pot in raked games
- A list of regular players, for entering names quickly
- A simple report for each player: total games, wins and losses, and time played over a period

It should work on phones and tablets and be quick to open. The code should be extensible and tidy, so that player-side records and other features can be added later.

## What the user said on key topics

| Topic         | Position                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Front end     | "Long-term extensibility comes first, so React it is"                                                        |
| Offline       | Almost never without a network. Offline or signed out, a plain ledger and calculator is enough               |
| Monetization  | Likely, probably a monthly plan for all features or a per-game fee, but not a priority. Prepare, don't build |
| Mainland China | Likely. The China version is deployed separately, see ADR 0003                                              |
| Repository    | Public with all rights reserved: others can look but not use                                                 |

## Confirmed rules (2026-11-04)

These are the product defaults. Rules are configurable by design, so organizers set the actual numbers and they aren't hard-coded.

| Topic         | Decision                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------- |
| Currency      | Chosen when starting a game, carried over from the last game. Defaults to CNY if none    |
| Chip ratio    | Set per game, carried over from the last game. Defaults to 1 chip = 1 yuan if none       |
| Buy-in        | One buy-in defaults to 100 big blinds. Buy-ins and rebuys are recorded in whole hands    |
| Blinds        | Set in whole chips, with the cash equivalent shown. Fixed once the game has records, like the currency, the ratio and the Buy-in |
| Live stacks   | Each seated player has a stack and win/loss in chips, plus a table balance in chips      |
| Leaving       | 离桌 (leave table) confirms hands and chips. Settlement still needs everyone to leave    |
| Corrections   | The game record is read-only. Fix mistakes with hand controls, stacks and 返回            |
| Imbalance     | Settling is allowed: split by win/loss, organizer covers or collects, or leave unhandled |
| Rake          | A percentage of each pot, two decimals allowed, default 5%. An optional cap per pot, 2 BB when first switched on. Rounded to the smallest chip in play, by default to the nearest small blind. The cap and the smallest chip are kept in blinds, with chips typed turned into blinds; the tools take them in chips, which no config keeps (ADR 0039). Each rake keeps its time, its pot when typed, and whether the total was typed over; 抽水计算 lists them as 底池, 增量 or 修改 with the total after each. The rake is a seat on the organizer's card with no Buy-in, and goes only to the host (ADR 0034, ADR 0036) |
| Wages (工资)  | Each player pays an hourly rate for their own time at the table. Default 25 an hour in the game's currency, by the minute; billing can be by 15, 30 or 60 minutes. A part unit is rounded to the nearest (default), up or down. A unit across two rates is charged at the one that covers more of it, or the higher on a tie. Rates by time of day and by game time can both be on, up to 3 of each and 4 in all; where both apply the higher rate wins (ADR 0025, ADR 0027) |
| Time of day   | Each game keeps the time zone it was started in, and rates by time of day follow it on every device. A game that starts inside a time segment with an end begins in it; one with no end, such as a rate from midnight, applies only once the game crosses that hour. Segments switch when the local clock shows their hours (ADR 0027) |
| Table fee     | Once per player per game. Default 100, after 5 minutes at the table to keep a player added by mistake from paying; a switch charges from the first minute instead |
| Time at table | From buy-in to leaving, starting again on 回桌, counted only while the game clock runs. A clock not started or paused means the game has not started or is paused (ADR 0023) |
| Organizer playing | The organizer joins from their own row with a buy-in and stays on the organizer's card, counted among the seated. No table fee or wages apply to them, and their chips, insurance and charges add up on one row (ADR 0028) |
| Fees at settlement | Table fees and wages go to the host by default. Each player's card lists the time sat and charged, wages per rate and the table fee, each of which can be waived until the game is settled. The organizer's card leads and folds. A 设置 button opens the game's insurance, table fee and wages in brief, with the charging rules behind an info icon. Going to settlement pauses the game clock (ADR 0022, ADR 0024, ADR 0027, #I-041) |
| Insurance     | Chosen per game. Two built-in odds tables, default 1 pays 30. Tie cards count by default, and are then sold as a cover of their own, apart from the cards that overtake (ADR 0033). Covers are named for what they pay: 保本 the stake, 半池 half the pot share, 满池 all of it and never more (ADR 0032). Premiums and payouts are rounded to the smallest chip, by default to the nearest small blind; the tools take the smallest chip in chips (ADR 0037). Cover limits per street: the stake, half, three quarters or the full pot share (default), or a percentage. Odds tables and the other settings are saved and picked apart (ADR 0026) |
| Saved configs | Each section of a game's settings (基础设置, 保险, 工资, 台费, 抽水) is saved on its own, and the whole setup as a game config. A game config follows its sections' saved configs: used, it takes their values as they are then. A game keeps its own copy and never changes with them. Values changed from a saved config read 已修改 and go back into it with 更新, or under a new name with 另存为 (ADR 0038) |
| Starting values | Game setup carries over the latest game. An option the latest game had off starts off, and when turned on uses the last game that had it; with none, the defaults |
| Break-even    | Shows both "recover your own stake" and "recover the whole pot"                          |
| Insurance seat| 保险 is a reserved seat with one hand, always last, and cannot leave. Short of chips, it buys whole hands to pay |
| Insurance result | Goes to the organizer by default, or a chosen player, or its own row                  |
| Premium       | Not refunded on a hit by default. The rule can change this                               |
| Insurance chips | An all-in player's entered chips update the table at once. Insurance itself moves nothing until the hand is finished |
| Insurance hand | One all-in from flop or turn to the river. Resumes if the page is left, and is recorded as one entry |
| Short premium | A player who cannot pay a premium buys whole hands, after the organizer confirms a prompt |
| Cover        | The deepest of the hand's players, at most one, who matches the next deepest |
| Insured card  | The next card only. Each pot is priced apart. Tie cards are sold by default, apart from the outs. The buyer may give up some cards of a kind, or have some sold as a second cover priced on its own cards         |
| Multi-device  | No need for several devices on one game. M1 is guest mode, Supabase arrives in M6        |
| Accounts (M6) | One account per person, as host and as player. An account owns one host space for now; the books belong to the space. Sign-in by email and password, confirmed with codes; a second factor later (ADR 0040, ADR 0041). A password is 8 to 72 characters with a letter and a digit. A name an account shows is 1 to 30 characters with no marks but `-`, `.` and `_`, nothing unseen, and not 保险, 抽水 or 组织者; it need not be unique |
| Signed in     | An account's games, players and saved settings are read from and written to its space in Supabase, and need a network. The records a guest made on the device stay there, are not brought into the account for now, and show again after signing out. With no network an account is told so; it is not shown the guest's records instead (ADR 0046) |
| Players' rights | A player linked to a record reads, for the games they played in, their own results, what the game was played under, and whether the books balanced and how a difference was handled. They read no other player's result and change nothing; only the host changes the books. Records are taken up by an invitation from the host or a request the host places (ADR 0042) |
| Namesakes     | Several players may carry the same name; 保险 and 抽水 stay reserved. In a game the players with a buy-in or rebuy in effect are taken in the order of their earliest buy-in or rebuy, reversed or not: among those whose names match, ignoring case and spaces, the first keeps the name and each later one reads `name_1`, `name_2`, skipping a label that is a real name in the game or already given. Nothing is stored. Across games, as on 转账, there is no order, so a name more than one record carries reads with its number, `小王 #0003`. Each record has a number, and a player's page tells them apart (ADR 0043) |
| Leaving       | A host's account that is deleted keeps its space for 30 days, then the books go with it. A player's account that is deleted only unlinks (ADR 0040) |
| Workflow      | From M1 on: branch → PR → CI → merge                                                     |

"Hand" (手) here means one buy-in unit, not a hand of cards.

## Open questions

- Whether insurance quotes take the rake out of the pot first: the switch exists, off by default, with no effect yet (ADR 0036)
- Trademark check and a permanent domain. Deployment uses a free `*.pages.dev` subdomain for now, see issue #9. Sign-in needs a domain to send mail from (ADR 0041)

## Known pitfalls

- **Paths must not contain quotes or spaces.** vite-plugin-pwa (workbox) writes absolute dependency paths into `sw.js` in single quotes,
  so a `'` in a path produces invalid code. Use only lowercase letters, digits and hyphens in directory names.
- **Commit `routeTree.gen.ts`.** It regenerates when routes change. Without it, type checks fail on a clean checkout.
- **`node` or `pnpm` not found:** run `source ~/.bashrc` or open a new terminal.
- **Docker** runs the local Supabase (`pnpm db:start`), which the repository and sign-in are built against. The database's own tests need none (ADR 0044). The images take about 4 GB.
- **Access from mainland China:** the official Supabase and Cloudflare services can both be unreliable there, so the China version is deployed separately.
- **The sign-in service says when an address is taken.** Asked to sign up with one that has an account, it answers `user_already_exists`. The app's pages do not pass that on (ADR 0041), but the service can be asked directly.
- **Supabase free tier pausing:** a project pauses after a week without traffic. That's fine in development, but production needs the Pro plan.
