# 0045. One contract for the device's repository and the account's

- Status: Accepted
- Date: 2026-11-20

## Context

The app reads and writes through one repository interface, with the device's storage (Dexie) behind it in guest mode and Supabase behind it in account mode ([ADR 0005](0005-guest-and-account-modes.md), [ADR 0007](0007-domain-model-and-repository.md)). The interface says what each method takes and returns, not how it behaves: the order of a list, what happens to an ID that is already there, whether a batch is all or none. The app relies on all of those, and they were only written down as tests of the Dexie repository.

## Options considered

- Tests of the Supabase repository written on their own: the two sets drift, and a difference shows up as a bug in account mode only.
- **One set of tests that both repositories have to pass**, with what is particular to each beside it.

## Decision

- `repository-contract.ts` holds the behavior every repository has: the order of each list, saving by ID, the ledger refusing an ID twice and a batch failing whole, each list of saved things kept apart, one organizer's records hidden from another, and a backup restored by adding only what is missing. It runs against Dexie with the unit tests and against the local Supabase under `pnpm test:local` ([ADR 0044](0044-books-in-postgres-as-documents.md)).
- Where the two would differ, the database follows the device:
  - IDs and names sort by their characters alone (the `C` collation), as IndexedDB orders keys, and a tie in time goes by ID. Events recorded in the same millisecond read in the same order from either.
  - Everything saved under a name shares one table but is keyed by its list too, so the same ID in two lists stays two records.
- The Supabase repository checks every record with the backup's schemas before it is written and after it is read, so nothing reaches the database, or the app, that a backup would not accept.
- A list is read a thousand rows at a time, the most the API returns to one request, until it ends.
- A restore is one call to a database function, `restore_books`, which adds what the space lacks, all or none, and says how many it added and left. It runs with the caller's own rights, so it does nothing the caller could not do record by record.
- `backupForOrganizer` in `core` gives a backup's records another organizer and changes nothing else. A backup made in one place is restored to another through it, which is how guest data will reach an account ([ADR 0040](0040-accounts-host-spaces-and-player-records.md)).

## Consequences

- An account's storage keeps the same ID apart in two spaces; the device's does not, as it only ever holds one organizer. That is tested for Supabase alone and is not part of the contract.
- The ledger in an account has to have its game before its events, by the foreign key. The app has always saved a game first, and a backup is refused unless every event's game is in it.
- A restore sends the whole backup in one request. A history large enough to be refused for its size would have to go in parts, each all or none on its own.
- A field added to a record has to be added to the backup's schema, or it is dropped on its way to and from an account, as it already would be from a backup.
