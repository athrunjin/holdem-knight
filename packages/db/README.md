# @holdem-knight/db

The Supabase database: its SQL migrations, the local Supabase's configuration, and tests of its row-level security ([ADR 0044](../../docs/adr/0044-books-in-postgres-as-documents.md)).

- `supabase/migrations/`: one SQL file per change, named `YYYYMMDDHHMMSS_what_it_does.sql`, applied oldest first.
- `supabase/config.toml`: the local Supabase. Only what the app uses is started: the database, sign-in, the API, Studio and the mail catcher.
- `supabase/templates/`: the emails that carry a code, for confirming an address and for resetting a password. A hosted project is given the same subjects and bodies.
- `src/testing.ts` and `src/*.test.ts`: every rule, in a Postgres that runs inside the test process (PGlite). No Docker.
- `src/local/`: the main rules again, through the real sign-in and API of the local Supabase. `apps/web` runs its repository against the same stack ([ADR 0045](../../docs/adr/0045-one-contract-for-both-repositories.md)).

## Commands

From the repository's root:

```bash
pnpm test          # includes the in-process tests
pnpm db:start      # start the local Supabase and apply the migrations (needs Docker)
pnpm db:env        # point the app's dev server at it (writes apps/web/.env.local)
pnpm test:local    # the tests that need it running, here and in apps/web
pnpm db:reset      # empty the local database and apply every migration again
pnpm db:stop       # stop it; the data stays until the next reset
```

While it runs:

| | |
| --- | --- |
| API | http://127.0.0.1:54321 |
| Studio, to look at the tables | http://127.0.0.1:54323 |
| Mail catcher, where every email it sends ends up | http://127.0.0.1:54324 |
| Database | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

`pnpm --filter @holdem-knight/db db:status` prints these with the local keys. The keys are the same on every machine and open nothing but the local stack.

## Changing the tables

Until the first project is set up, edit the one migration and run `pnpm db:reset`. Once a migration has been applied to a project it is never edited: add a new file instead.
