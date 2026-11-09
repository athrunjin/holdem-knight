# CLAUDE.md

Project notes for AI coding assistants (Claude Code and others). Human developers should start with README.md and CONTRIBUTING.md.

## Project

An assistant (PWA) for organizers of live Texas Hold'em games: buy-in ledger, settlement, insurance, rake, timing and player reports.
The product name is Hold’em Knight (Chinese name, on record only: 有局). It is built for organizers, phone and tablet first. Interface text is in Simplified Chinese.
The roadmap is in docs/ROADMAP.md, confirmed rules and background are in docs/CONTEXT.md,
discussions of feature and process improvements are in docs/IMPROVEMENTS.md,
and manual test plans handed to testers are in docs/testing/.

## Common commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start the dev server (apps/web)
pnpm test             # All unit tests
pnpm typecheck        # Type check
pnpm lint             # Biome check; pnpm format fixes issues
pnpm check            # Full pre-commit check: lint + typecheck + test + build
```

## Structure and layers

- `packages/core`: pure business logic (money, settlement, insurance, rake, timing). Pure functions and types only,
  with no network, database or DOM access and no dependency on other packages. All money rules live here.
- `apps/web`: React 19 + Vite + TanStack Router (file routes in `src/routes/`;
  `routeTree.gen.ts` is generated and must be committed) + Tailwind v4. Display and interaction only.
- Dependencies point from `apps` to `packages`, never the other way.

## Rules

- Money always uses `Cents` (integer cents) from `@holdem-knight/core`. Multiply with `multiply` and an explicit rounding mode,
  and split with `allocate`. Never use floating-point arithmetic for money (ADR 0004).
- Timers record timestamps and compute differences. They never rely on a running interval (ADR 0001).
- The ledger is append-only events. To undo, append a reversal event; never change old records (ADR 0005).
- Storage goes through the repository interface: guest mode is local Dexie, account mode is Supabase (ADR 0005).
- Calculations in `core` must have Vitest unit tests. Anything that conserves money also gets a fast-check property test.
- TypeScript strict mode, no `any`. Touch targets are at least 44px.
- Commit messages use Conventional Commits in English, for example `feat(core): compute minimal settlement transfers`.
- Everything in the repository and on GitHub is in English: commit messages, branch names, pull requests, issues, comments,
  documentation, code comments and test names. Interface text and Chinese sample data in tests stay in Chinese.
  Discussions with the user are in Chinese.
- Decisions that affect the long-term structure get a new record in `docs/adr/`.

## Design tokens

Table-felt green is the base and chip gold is the only accent color; dark is the main mode. Tokens are defined in `apps/web/src/styles.css`.
The logo, icons and brand rules are in `docs/brand/README.md` (ADR 0021).
