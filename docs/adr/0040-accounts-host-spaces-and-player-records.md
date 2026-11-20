# 0040. Accounts, host spaces and player records are three things

- Status: Accepted
- Date: 2026-11-20

## Context

The app has only guest mode: one organizer, `guest`, whose ID is on every record ([ADR 0005](0005-guest-and-account-modes.md), [ADR 0007](0007-domain-model-and-repository.md)). Accounts arrive in M6 on Supabase ([ADR 0003](0003-backend-supabase.md)). The organizer asked for one account that serves a person both as a host and as a player, with different rights over a game in each role; for names that may repeat while IDs stay apart; and for a host's history of a player to be kept so that the player can take it up on joining later.

A player in the app today is a line in the host's list: a name the host typed, with an ID. Nothing says who that person is, and most players will never have an account.

## Options considered

- The account is the organizer, with the user's ID as `organizerId`: simplest, but a person who also plays in another host's game needs a second kind of record anyway, an assistant can never record into a host's books, and a second set of books for one person is impossible.
- Two kinds of account, host and player: a person who does both signs up twice, which the organizer ruled out.
- **Three things, each with its own ID: the account, the host space, and the player record**: the roles are how an account relates to a space, not what kind of account it is.

## Decision

- **Account**: a person who can sign in. It has a display name, which need not be unique, and a short public code for showing and checking. It is identified by its ID alone.
- **Host space**: one set of books, which is what `organizerId` already scopes: games, the ledger, the player list and the saved configs. A space has an owner. An account owns one space for now, made when it first signs in; the tables relate accounts to spaces many to many, with a role, so more spaces or assistants need no migration.
- **Player record**: a line in a space's player list, as now. Its name is the host's own note about a person. It gains the account it is linked to, if any, a number within its space ([ADR 0043](0043-namesakes-in-a-space.md)), and the record it was merged into, if any.
- **The books belong to the space.** An account linked to a player record gains the right to read ([ADR 0042](0042-linked-players-and-claiming-records.md)), never ownership. Unlinking or deleting that account leaves the host's books whole.
- IDs stay client-made UUIDs, so records made as a guest keep their IDs when brought into an account. Bringing guest data in rewrites only `organizerId`, from `guest` to the space, and adds what is missing by ID, as a restore does ([ADR 0009](0009-backup-format.md)).
- Deleting an account that is linked to player records unlinks them. Deleting an account that owns a space starts 30 days in which the owner can sign in and call it off, and linked players can still read; then the space and its books are deleted, and the links with them. The app asks for an export first.
- Plans and entitlements, when they come, hang on the space. Playing is free.

## Consequences

- A repository is still bound to one `organizerId`, so the UI and `core` do not change for accounts; row-level security scopes by membership of the space.
- A person is one account but may be many player records, one in each space they play in, each with the name that host gave them.
- Records that change after they are made (games, player records, saved configs) need the time of their last change and a mark for deletion to be merged between devices; [ADR 0038](0038-game-configs-follow-saved-configs.md) already keeps `updatedAt` on saved configs. The ledger is append-only and merges by ID.
- A China instance has accounts of its own ([ADR 0003](0003-backend-supabase.md)); an account does not cross regions.
