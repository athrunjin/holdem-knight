<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/05-lockup/lockup-appicon-on-dark.svg" />
    <img src="docs/brand/05-lockup/lockup-appicon-on-light.svg" alt="Hold’em Knight · Tablebook" width="480" />
  </picture>
</h1>

An assistant for organizers of live Texas Hold'em games. It handles these jobs at the table:

- **Buy-in ledger and settlement**: records each player's buy-ins, rebuys and cash-outs, checks the balance when the game ends, and works out the fewest transfers
- **Insurance calculator**: odds, payout and break-even amounts from the number of outs
- **Timing and dealer fees**: charges by each player's time at the table
- **Rake**: calculates the rake for each pot according to your rules
- **Regular player list**: pick a player quickly by name or pinyin initials
- **Player reports**: games played, winnings and losses, and time played over a period

It works on phones, tablets and computers, and can be added to the home screen to open like an app. The app's interface is in Simplified Chinese.

> Live site: <https://holdem-knight.pages.dev/>. The project is in the **M1 core ledger** phase; see the [roadmap](docs/ROADMAP.md).

## Tech stack

| Layer         | Choice                                                                    |
| ------------- | ------------------------------------------------------------------------- |
| Form          | PWA (packaged with Capacitor for the app stores later)                    |
| Front end     | React 19 + TypeScript + Vite + TanStack Router                            |
| UI            | Tailwind CSS v4 (components owned in the repo, in the style of shadcn/ui) |
| State         | Zustand (UI state) + TanStack Query (remote data)                         |
| Local storage | Dexie / IndexedDB (guest mode)                                            |
| Back end      | Supabase (from M6; can be deployed per region)                            |
| Tooling       | pnpm monorepo · Biome · Vitest + fast-check · Playwright · GitHub Actions |

The reasons behind each choice are in the [architecture decision records (ADRs)](docs/adr/).

## Project structure

```
apps/
  web/                # PWA front end: UI, routing, interaction
packages/
  core/               # Business core: money, settlement, insurance, rake, timing (pure functions, no UI or database)
docs/
  ROADMAP.md          # Roadmap and milestones
  adr/                # Architecture decision records
.github/workflows/    # Continuous integration
```

Dependencies only point from `apps` to `packages`, and `packages/core` depends on no other package.
All money logic lives in `core`, so a future server, player app or native app can reuse it.

## Local development

Requires Node.js 22+ and pnpm 10 (run `corepack enable` to get it).

```bash
pnpm install       # Install dependencies
pnpm dev           # Start the dev server (phones on the same Wi-Fi can use the LAN address)
pnpm test          # Run unit tests
pnpm check         # Full pre-commit check: lint + types + tests + build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch names, commit message format and coding standards.

## Copyright

Copyright © 2026 Cheng Jin. All rights reserved.

This repository is public only so that the development process can be viewed. **No license is granted to use, copy, modify or distribute it.** See [LICENSE](LICENSE).
