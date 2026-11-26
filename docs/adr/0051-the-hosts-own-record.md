# 0051. The host has a record of their own, under the organizer seat's ID

- Status: Accepted
- Date: 2026-11-26

## Context

我的 has a Player face, which shows the results of the person using the app as a player. It first let the person choose which record of the player list was them, a choice kept on the device. The organizer turned that down: who a person is comes from the books, not from picking from a list. Every set of books has one person who is certainly in it, the host, and other people's records reach them from the host later ([ADR 0042](0042-linked-players-and-claiming-records.md)), never by their own choice.

The host already plays in their own games, under a seat of their own with a fixed ID and no record ([ADR 0028](0028-organizer-seat.md)). Settled games keep a summary with a row for that seat ([ADR 0049](0049-settled-games-keep-a-summary.md)), so the host's results as a player are already worked out in `core`; they were only shown nowhere, as the seat had no record.

Player IDs are text, kept under their space in both stores (`(organizer_id, id)` in Postgres, [ADR 0044](0044-books-in-postgres-as-documents.md)), and guest data is brought into an account by keeping IDs and adding what is missing ([ADR 0040](0040-accounts-host-spaces-and-player-records.md)).

## Options considered

- **A record of its own with a new fixed ID**: the organizer seat stays as it is, and the host has two ways to sit down. Picked from a list, they would sit as an ordinary player and be charged their own table fee and wages, which ADR 0028 was written to avoid, and their games under the seat would show nowhere until merged.
- **The organizer seat's record**: the seat gains a record under its own ID, `organizer`. Its games are the host's history at once, the rules of ADR 0028 stay exactly as they are, and choosing it from a list seats the host as the organizer's card does.
- How the record is told apart: a field on the record, or the fixed ID alone. A field would need a backup version and a rule for two records that both carry it; the ID alone is unique in a space by the primary key, the same on a device and in an account, and needs nothing new in a backup.

## Decision

- **Every set of books has one record that is the host's own**: the guest's on the device, and each account's space. Its ID is `ORGANIZER_PLAYER_ID`, `organizer`, the ID of the organizer seat. It is marked by that ID alone; the `Player` type and the backup format do not change.
- **It is made when the books' player list is first read and there is none**, by the app, the same way in both stores: `players.ensure` saves a record only if none with its ID is kept, and returns the one kept, so two devices opening one space at once keep one. A space's database does not make it at sign-up or for spaces that exist, so both stores start empty and are held to one contract ([ADR 0045](0045-one-contract-for-both-repositories.md)).
- **Its name** is the account's (the name of its space, which is the account's at sign-up), or for a guest 我 / Me from the catalogs, in the language of the moment it is made; switching language later does not change it. The host can rename it like any record. It is numbered like any record ([ADR 0043](0043-namesakes-in-a-space.md)).
- **In an account's space** the database links it to the space's owner (`players.linked_user_id`) on every write, whatever the app sends, refuses to move it to another ID or space, and lets the owner delete any record but this one. The app has no way to delete a record, and cannot write `linked_user_id` at all. It goes with its space when the space is deleted.
- **Guest data brought in and backups**: as the ID is the same everywhere, a guest's own record and the account's are the same record, and the guest's history under the seat joins the account's with no merge. A restore adds only what is missing, so it never makes a second one; a backup from before this change has none, and the one in the books stays.
- **Where it shows**: first in the lists a game's players are picked from, with a small muted Host tag, and with the same tag in the player list and on its page. Picked into a game, it is the organizer's seat: at the start it buys in as any starting seat does, and at the table it opens the same buy-in as the organizer's card. In a game the seat is still named after the space, and the record takes no part in telling namesakes apart there. 我的's Player face shows its results; the header shows the account's name on its avatar and with its number when signed in.
- **This supersedes in part**:
  - [ADR 0028](0028-organizer-seat.md): the seat now has a record in `players`, so its games appear in the player list and on a player page. Its rules for money are unchanged: no table fee or wages are worked out for it, it is the collector at settlement, and it stays on the organizer's card in a game.
  - [ADR 0042](0042-linked-players-and-claiming-records.md), in its wording only. A record does not reach a player by being claimed or taken up: the host **hands out** a record, and the player's account is then **linked** to it. Read "taking up a record" as the host handing a record out and the account being linked, and "claim their records by invitation" as records handed out by invitation; the three ways, the invitation's terms, and the rest of its decisions stand. As recorded decisions are not edited here, the wording is changed in this record rather than in ADR 0042.

## Consequences

- The host's results as a player come from `core` as they were: the seat's row of each settled game's summary. Nothing is worked out differently.
- The player list is never empty again: it has the own record from the first read.
- An account's books get their own record the first time a device reads their player list, not at sign-up; an account brought guest data before that has the guest's record, under its guest name, as its own.
- The host's record is linked to the owner, so the owner cannot also be linked to another record in their own space.
- A record a host kept for themselves before this change, as an ordinary player, stays one. Merging it into the own record is a later step, by the merge of ADR 0042.
- The seat's name in a game is still the space's, which can differ from the record's after a rename.
