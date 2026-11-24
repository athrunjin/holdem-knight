# CLAUDE.md

Project notes for AI coding assistants (Claude Code and others). Human developers should start with README.md and CONTRIBUTING.md.

## Project

An assistant (PWA) for organizers of live Texas Hold'em games: buy-in ledger, settlement, insurance, rake, timing and player reports.
The product name is Hold’em Knight (Chinese name, on record only: 有局). It is built for organizers, phone and tablet first. Interface text is in Simplified Chinese.
The roadmap is in docs/ROADMAP.md, confirmed rules and background are in docs/CONTEXT.md,
discussions of feature and process improvements are in docs/IMPROVEMENTS.md,
the visual guide and the visual review are in docs/design/,
and manual test plans handed to testers are in docs/testing/.

## Common commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start the dev server (apps/web)
pnpm test             # All unit tests
pnpm typecheck        # Type check
pnpm lint             # Biome check; pnpm format fixes issues
pnpm check            # Full pre-commit check: lint + typecheck + test + build
pnpm db:start         # Start the local Supabase and apply the migrations (needs Docker)
pnpm db:env           # Point the dev server at it; without it the app has no sign-in and runs as a guest only
pnpm test:local       # Tests through its sign-in and API; pnpm db:reset empties it, pnpm db:stop stops it
```

## Structure and layers

- `packages/core`: pure business logic (money, settlement, insurance, rake, timing). Pure functions and types only,
  with no network, database or DOM access and no dependency on other packages. All money rules live here.
- `packages/db`: the Supabase database. SQL migrations in `supabase/migrations`, the local Supabase's configuration,
  and tests of its row-level security: all of them in an in-process Postgres with no Docker, the main ones again against
  the local Supabase (ADR 0044). A migration that has been applied to a project is never edited.
- `apps/web`: React 19 + Vite + TanStack Router (file routes in `src/routes/`;
  `routeTree.gen.ts` is generated and must be committed) + Tailwind v4. Display and interaction only.
- Dependencies point from `apps` to `packages`, never the other way.

## Rules

- Money always uses `Cents` (integer cents) from `@holdem-knight/core`. Multiply with `multiply` and an explicit rounding mode,
  and split with `allocate`. Never use floating-point arithmetic for money (ADR 0004).
- Timers record timestamps and compute differences. They never rely on a running interval (ADR 0001).
- The ledger is append-only events. To undo, append a reversal event; never change old records (ADR 0005).
- Storage goes through the repository interface: guest mode is local Dexie, account mode is Supabase (ADR 0005).
  Pages import `repository` and `currentOrganizerId()` from `apps/web/src/data`, which answer for the books in use (ADR 0046).
  Both pass one set of tests, `repository-contract.ts`; behavior a repository must have goes there (ADR 0045).
- A game is settled by `settleBooks` in `core`, which the settlement page shows. A settled game keeps a
  `GameSummary` made from it, which reports read instead of the ledgers (ADR 0049).
- Calculations in `core` must have Vitest unit tests. Anything that conserves money also gets a fast-check property test.
- TypeScript strict mode, no `any`. Touch targets are at least 44px.
- Commit messages use Conventional Commits in English, for example `feat(core): compute minimal settlement transfers`.
- Everything in the repository and on GitHub is in English: commit messages, branch names, pull requests, issues, comments,
  documentation, code comments and test names. Interface text and Chinese sample data in tests stay in Chinese.
- Interface text goes in the catalogs under `apps/web/src/i18n`, Chinese first and every other language with it,
  and is read from `t` (ADR 0047). No Chinese text is written in components, routes or helpers.
  Discussions with the user are in Chinese.
- Decisions that affect the long-term structure get a new record in `docs/adr/`.

## Design

Table-felt green is the base and chip gold is the only accent color; dark is the only mode, whatever the device is set to. Tokens are defined in `apps/web/src/styles.css`.
The logo, icons and brand rules are in `docs/brand/README.md` (ADR 0021).

- How the app looks and moves is in `docs/design/README.md`: color, type, space, components, motion, the order of a page. Read it before planning or building anything the app shows, and build from its tokens and components.
- Every change to what the app shows goes through the visual review in `docs/design/review.md` after `pnpm check` and before it is handed over: in the preview at 360, 393 and 412px, dark, in Chinese and English, through its states and animations. Blockers are fixed first; the hand-over says what was reviewed, what was measured, what is left open and what was not looked at (ADR 0050).
- A decision the organizer makes about how something looks that the guide does not have is added to the guide in the same pull request.
