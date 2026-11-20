# 0044. The books in Postgres as the app's documents, with their security tested in process

- Status: Accepted
- Date: 2026-11-20

## Context

Accounts keep a host space's books in Supabase ([ADR 0003](0003-backend-supabase.md), [ADR 0040](0040-accounts-host-spaces-and-player-records.md)). The app's records are rich and still changing: a game carries its insurance, wage, table fee and rake rules, each with shapes from before and after several changes, and the backup format has moved through fifteen versions in three weeks. What a record may hold is already checked in one place, the schemas a backup is read with ([ADR 0009](0009-backup-format.md)), and the rules that read it live in `core`.

The database has to do what only it can: keep one space's books from another's, keep the ledger append-only, and keep a record under one ID. Those rules need tests that run as readily as the unit tests do, and a local Supabase needs Docker and a minute to start.

## Options considered

For how records are kept:

- A column for every field: reports in plain SQL, but every new field is a migration, and each shape is described twice, in the app and in the tables.
- One document for a whole space, like a backup: nothing to design, but every save rewrites everything, two devices overwrite each other, and the ledger cannot be append-only.
- **A row for each record, holding the document the app keeps, with the columns the database needs worked out from it**: the tables stay as they are while the app's types move on.

For testing the security:

- Only against a local Supabase: the real thing, but it needs Docker running, and a failure there says less about which rule broke.
- Only in a Postgres that runs inside the test process (PGlite), given the roles and the `auth` schema a Supabase project starts with: no services, so the tests run with the unit tests, but nothing shows that a real project behaves the same.
- **Both**: every rule in process, and the main ones again through the real sign-in and API.

## Decision

- Migrations are SQL files in `packages/db/supabase/migrations`, laid out as the Supabase CLI expects, so the same files apply to a local stack or to any project ([ADR 0003](0003-backend-supabase.md)).
- `games`, `players`, `ledger_events`, `insurance_hands` and `saved_configs` each keep a record as `data`, the document as the app has it, under `organizer_id` and `id`. A check holds the document to the ID and the space it is kept under.
- IDs are made by the app and are unique only within a space, so the key of every record is the space and the ID together. Guest data brought into two accounts can share IDs without meeting.
- Columns the database needs are generated from the document, never written apart from it: a game's time and status, a ledger event's game, time, type and player, a hand's game and time. Times stay the millisecond numbers the app keeps.
- A ledger event and an insurance hand belong to a game of the same space, by a foreign key.
- Everything saved under a name is in one table, `saved_configs`, with the list it belongs to in `collection`.
- Signing up makes an account its profile, its space and its place in it as owner, by a trigger on `auth.users`, all or none. A unique index keeps an account to one space for now.
- Row-level security is on for every table. Nothing is granted to a visitor who has not signed in; a signed-in account gets only what the migration grants. So far only the owner of a space reads and keeps its books; assistants and linked players come with their own policies ([ADR 0042](0042-linked-players-and-claiming-records.md)).
- The ledger is granted reading and adding only. No one who signs in has the right to change or delete an event.
- A player record's link to an account is a column of its own that the owner is not granted to write; a function will set it when a record is taken up.
- The database does not check what a document holds beyond its ID and space. The app checks it with the backup schemas, on the way in and on the way out.
- `packages/db` tests the migrations with PGlite: each test file starts a database, adds what Supabase provides, applies every migration, and runs statements as an account, as another account and as a visitor. They run under `pnpm test`.
- The same package holds the local Supabase's configuration, which starts only what the app uses: the database, sign-in, the API, Studio and the mail catcher. `pnpm test:local` signs accounts in and reads and writes through the API, and runs in CI as a job of its own.

## Consequences

- A new field in a record needs no migration. A field the database has to filter or join on needs a generated column.
- Reports over many games should not read every document: the settled summary of a game gets columns of its own when the host's reports are built.
- PGlite is Postgres, not Supabase, and a major version ahead of it (18 against 17): sign-in, the REST layer and realtime are not there. What depends on those, such as the repository built on `supabase-js`, is tested against the local Supabase.
- The short codes of accounts and spaces are eight characters taken from a random ID. A clash is refused by the unique index and has to be tried again once there are many accounts.
