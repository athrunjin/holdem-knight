# Roadmap

Each milestone maps to a GitHub Milestone, and each feature in it maps to an issue.

## M0 Project start (done)

- [x] Choose the tech stack (see [ADRs 0001–0006](adr/))
- [x] pnpm monorepo: `apps/web` + `packages/core`
- [x] Engineering standards: TypeScript strict mode, Biome, Vitest + fast-check
- [x] Money utilities (integer cents) with tests
- [x] PWA shell: bottom/side navigation, installable, offline cache, new-version prompt
- [x] GitHub Actions: lint, type check, tests, build
- [x] Deploy to Cloudflare Pages, with a preview link for every PR

## M1 Core ledger (MVP: usable at a real game)

- Game setup: blinds, chip-to-cash ratio, currency, in one 基础设置 card with configs of its own
- Game configs that follow the saved configs of their sections, which can be updated in place ([ADR 0038](adr/0038-game-configs-follow-saved-configs.md))
- Player list (stored locally in guest mode): add, search (name / pinyin initials)
- Ledger: buy-ins, rebuys and cash-outs in an append-only ledger, with undo
- Buying in by hands: one buy-in = xx big blinds, one row per seated player, quick hand adjustments
- Settlement: balance check (all wins and losses + rake + insurance = 0), results first, fewest transfers or a collector plan, leave-all, and options for settling a chip difference
- Settlement results as an image, for sharing to a group chat
- Data export / import (JSON) as a backup

## M2 Timing, wages and table fees

- [x] Each player's time at the table (including leaving and coming back)
- [x] Wage rules: hourly rate by the minute, with a time-of-day or after-some-hours rate
- [x] Table fee: once per player after a minimum time
- [x] Shown apart at settlement and given to the host
- [x] Call Time: a countdown from the tools page and from a game, which floats over the other pages
- Waive or change a single charge, and choose who receives them

## M3 Insurance calculator (done)

- [x] Insurance chosen per game, with saved rules and last-used settings
- [x] Configurable odds table (by number of outs) and limits
- [x] Multiway pots: side pots, outs for each opponent, equity
- [x] Payout and break-even calculations
- [x] Insurance as a seat in the game ledger, with its result assigned at settlement
- [x] A standalone calculator on the tools page
- [x] A guided hand from the players to the river, which resumes if the page is left
- [x] A summary of each finished hand, which updates the table
- [x] A hand entered on the page: the pot, the players with their chips from the table, and the insurance shown at once
- [x] Covers priced by what they pay, with no payout above the pot ([ADR 0032](adr/0032-insurance-covers-priced-by-payout.md))
- [x] Tie cards sold as a cover of their own, up to what a tie can cost ([ADR 0033](adr/0033-tie-cards-sold-as-their-own-cover.md))
- [x] Outs given up or sold as two covers, managed card by card
- [x] One card picker for the whole hand, kept as it is tapped, and the card dealt recorded in both ways of working
- [x] Odds tables made, renamed, edited and deleted from the calculator and from a game's settings
- [x] Premiums and payouts rounded to the smallest chip, by default the nearest small blind; the tools take it in chips ([ADR 0037](adr/0037-insurance-prices-rounded-to-the-smallest-chip.md))

A preflop all-in is not covered yet, see #I-019 in the [improvement log](IMPROVEMENTS.md).

## M4 Rake

- [x] A rake seat on the organizer's card, with a dialog that works out a pot's rake and adds it, and undo ([ADR 0034](adr/0034-rake-as-a-seat-with-no-buy-in.md)). The rule is fixed at 10% of the pot for now
- [x] Rake rules: a percentage with decimals, a cap in chips or big blinds, and rounding to the smallest chip, saved and carried over like the other options ([ADR 0036](adr/0036-rake-rules-and-pot-records.md)). No flop no drop was left out
- [x] Each rake recorded with its time and pot, listed in the dialog; 抽水计算 on the tools page
- [x] 抽水计算 shows and changes the rule: in a game, asked about before it applies; in the tools, in chips alone. Its record lists each rake's input, pot, change and running total
- Insurance quotes after rake: a switch kept, off, to be decided

## M5 Player reports

- Statistics by period: games played, total buy-ins, wins and losses, total time, profit per hour
- Export as image / CSV

## M6 Accounts and cloud

In four steps, each usable on its own:

1. Accounts (the tables and their row-level security are in `packages/db`, [ADR 0044](adr/0044-books-in-postgres-as-documents.md); the repository on Supabase passes the same tests as the device's, [ADR 0045](adr/0045-one-contract-for-both-repositories.md)): sign-in by email and password with codes ([ADR 0041](adr/0041-sign-in-by-email-and-password-with-codes.md)), one host space per account ([ADR 0040](adr/0040-accounts-host-spaces-and-player-records.md)), and the books of the account's space in use once it signs in, read and written online ([ADR 0046](adr/0046-the-books-in-use-follow-who-is-signed-in.md)). Still to come: one-tap import of guest data, left until there are released records to bring over, and the first hosted project with its sending domain, human check and terms
2. Sync: last-changed times and deletion marks on records that change, a restore that takes the newer of two, the ledger written locally first and sent when online, and several devices kept in step
3. Linked players: invitations and requests to take up a player record, unlinking and merging, and a read-only page of a player's own results in the games they took part in ([ADR 0042](adr/0042-linked-players-and-claiming-records.md))
4. More rights: assistants who record for a host, a second factor for hosts, signing out everywhere, and deleting an account with its 30 days of grace

Ahead of accounts, in guest mode: players who share a name, numbered records, avatars and a player's page ([ADR 0043](adr/0043-namesakes-in-a-space.md)).

- Leave room for plans and entitlements (monthly / per game), no payments yet

## Before a first release

The first hosted project and its sending domain wait until these are done, in the organizer's order of 2026-11-21:

- [x] Dark whatever the device is set to
- [x] The interface in English as well as Chinese, with a language setting on 我的 ([ADR 0047](adr/0047-interface-text-in-typed-catalogs.md))
- Sharing: an image of a game's whole result, and one for each player's own
- Insurance: how it ties into the game, its flow, and its settlement screen, once the organizer has thought them through
- The host's pages, the figures above all: earnings by kind, transfers received or not, a player's history

## M7 and beyond

- Player app: a link to a game's result for players without an account. Signed-in players are covered by M6
- Capacitor packaging for iOS / Android
- China version: Supabase instance and CDN in China (requires ICP filing), phone number / WeChat sign-in
- Payments: Stripe (Australia), WeChat Pay / Alipay (China)
