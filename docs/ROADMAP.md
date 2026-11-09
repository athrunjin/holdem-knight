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

- Game setup: blinds, chip-to-cash ratio, currency
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

A preflop all-in is not covered yet, see #I-019 in the [improvement log](IMPROVEMENTS.md).

## M4 Rake

- Rake rules: percentage, cap, no flop no drop
- Per-pot records and rake totals

## M5 Player reports

- Statistics by period: games played, total buy-ins, wins and losses, total time, profit per hour
- Export as image / CSV

## M6 Accounts and cloud

- Supabase: sign-in, cloud storage for the player list and past games, multi-device sync
- One-tap import of guest data into an account
- Leave room for plans and entitlements (monthly / per game), no payments yet

## M7 and beyond

- Player app: players view their own records through a link or by signing in
- Capacitor packaging for iOS / Android
- China version: Supabase instance and CDN in China (requires ICP filing), phone number / WeChat sign-in
- Payments: Stripe (Australia), WeChat Pay / Alipay (China)
