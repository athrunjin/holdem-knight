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
| Blinds        | Set in whole chips, with the cash equivalent shown                                       |
| Live stacks   | Each seated player has a stack and win/loss in chips, plus a table balance in chips      |
| Leaving       | 离桌 (leave table) confirms hands and chips. Settlement still needs everyone to leave    |
| Corrections   | The game record is read-only. Fix mistakes with hand controls, stacks and 返回            |
| Imbalance     | Settling is allowed: split by win/loss, organizer covers or collects, or leave unhandled |
| Rake          | A percentage of the pot with a cap                                                       |
| Wages (工资)  | Each player pays an hourly rate for their own time at the table. Default 25 an hour in the game's currency, by the minute; billing can be by 15, 30 or 60 minutes. A part unit is rounded to the nearest (default), up or down. A unit across two rates is charged at the one that covers more of it, or the higher on a tie. Rates by time of day and by game time can both be on, up to 3 of each and 4 in all; where both apply the higher rate wins (ADR 0025, ADR 0027) |
| Time of day   | Each game keeps the time zone it was started in, and rates by time of day follow it on every device. A game that starts inside a time segment begins in it, and segments switch when the local clock shows their hours (ADR 0027) |
| Table fee     | Once per player per game, after a minimum time at the table. Default 100 after 10 minutes |
| Time at table | From buy-in to leaving, starting again on 返回, counted only while the game clock runs. A clock not started or paused means the game has not started or is paused (ADR 0023) |
| Fees at settlement | Table fees and wages go to the host by default. Each player's card lists the time sat and charged, wages per rate and the table fee, each of which can be waived until the game is settled. The organizer's card leads and folds. With 明细 on, the wages and table fee the game charged show in brief above the cards, with the charging rules behind an info icon (ADR 0022, ADR 0024, ADR 0027) |
| Insurance     | Chosen per game. Two built-in odds tables, default 1 pays 30. Tie cards count by default. Cover limits per street: the stake, half, three quarters or the full pot share (default), or a percentage. Odds tables and the other settings are saved and picked apart (ADR 0026) |
| Starting values | Game setup carries over the latest game. An option the latest game had off starts off, and when turned on uses the last game that had it; with none, the defaults |
| Break-even    | Shows both "recover your own stake" and "recover the whole pot"                          |
| Insurance seat| 保险 is a reserved seat with one hand, always last, and cannot leave. Short of chips, it buys whole hands to pay |
| Insurance result | Goes to the organizer by default, or a chosen player, or its own row                  |
| Premium       | Not refunded on a hit by default. The rule can change this                               |
| Insurance chips | An all-in player's entered chips update the table at once. Insurance itself moves nothing until the hand is finished |
| Insurance hand | One all-in from flop or turn to the river. Resumes if the page is left, and is recorded as one entry |
| Short premium | A player who cannot pay a premium buys whole hands, after the organizer confirms a prompt |
| Cover        | The deepest of the hand's players, at most one, who matches the next deepest |
| Insured card  | The next card only. Each pot is priced apart, and tie cards are outs by default          |
| Multi-device  | No need for several devices on one game. M1 is guest mode, Supabase arrives in M6        |
| Workflow      | From M1 on: branch → PR → CI → merge                                                     |

"Hand" (手) here means one buy-in unit, not a hand of cards.

## Open questions

- The rake percentage, the cap, and whether there's "no flop, no drop" (M4)
- Trademark check and a permanent domain. Deployment uses a free `*.pages.dev` subdomain for now, see issue #9

## Known pitfalls

- **Paths must not contain quotes or spaces.** vite-plugin-pwa (workbox) writes absolute dependency paths into `sw.js` in single quotes,
  so a `'` in a path produces invalid code. Use only lowercase letters, digits and hyphens in directory names.
- **Commit `routeTree.gen.ts`.** It regenerates when routes change. Without it, type checks fail on a clean checkout.
- **`node` or `pnpm` not found:** run `source ~/.bashrc` or open a new terminal.
- **Docker** is only needed to run Supabase locally in M6. Expand the VM's disk first if it's tight.
- **Access from mainland China:** the official Supabase and Cloudflare services can both be unreliable there, so the China version is deployed separately.
- **Supabase free tier pausing:** a project pauses after a week without traffic. That's fine in development, but production needs the Pro plan.
