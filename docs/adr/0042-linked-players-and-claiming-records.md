# 0042. Linked players read their own results and what a game was played under, and claim their records by invitation

- Status: Accepted
- Date: 2026-11-20

## Context

A host records players who have no account, often for months. When such a player later signs up, the history has to become theirs to see, without the host typing anything again, and without anyone taking up a history that is not theirs. Only the host changes the books ([ADR 0040](0040-accounts-host-spaces-and-player-records.md)).

GitHub does the same for accounts brought in by a migration: activity is credited to a placeholder, an owner sends the real user an invitation to take it, and it becomes theirs once they accept. Expense apps such as Splitwise ask every friend to have an account before anything is recorded, which a card table cannot.

## Options considered

For what a linked player may read:

- The whole result of a game they played in, as the host shares it: everyone's win or loss at the table becomes readable by each of them for good. First chosen, then withdrawn by the organizer.
- The whole ledger of such a game: nothing to build, as the app works a result out from the ledger, but the rake taken and every insurance sale could be read from it whatever the page showed.
- **Their own results, and what the game was played under**: a player checks what concerns them and the terms they played on, and learns nothing of anyone else's result.

For how those are served:

- Worked out on the server from the ledger: the rules live in `core`, in TypeScript, and would have to run there too.
- **Copies written by the host's app, one for the game and one for each player**: row-level security can hold the line row by row, and nothing runs on the server.

For how a record is taken up:

- Matching by email address or name: a host rarely has a player's address, and names repeat.
- **An invitation the host makes for one record, and a request the player makes for the host to place**: both sides agree each time.

## Decision

Rights in a space:

| | Owner | Assistant (later) | Linked player |
| --- | --- | --- | --- |
| Start a game, change its settings, settle | yes | no | no |
| Record buy-ins, leaving, insurance, rake | yes | yes | no |
| Read a game's ledger, rake records and insurance hands | yes | games still open | no |
| Read every player's result | yes | yes | no |
| Read their own result, and what the game was played under | yes | yes | games they played in |
| Manage the player list, invite, unlink, merge | yes | no | leave only |

- Row-level security enforces this. The ledger can be read and added to, never changed or deleted, by anyone.
- **What a linked player reads**, only for games in which their record has ledger events:
  - Their own row: hands bought, chips, win or loss and amount, each charge itemized, and their own insurance.
  - The transfers they are part of, with the name of the other side, as they need it to pay or be paid.
  - What the game was played under: its date and length, the currency, ratio, blinds and Buy-in, and the terms of each option that was on (insurance, wages, the table fee, rake).
  - Whether the books balanced: the chip difference over the whole table, how it was handled (split, taken by the organizer, or left), and their own share of a split.
  - While a game is open, their own ledger events, so they can check the hands they bought.
- They do not read another player's row or name, the rake taken, the insurance seat's result, or the ledger.
- The host's app writes these as copies: one for the game and one for each player, when settlement is confirmed and again when the results are revised.
- **Taking up a record**, three ways:
  - The host makes an invitation for one player record and shows it as a QR code or a link. The player signs in and sees the space's name, the record's name and number, and how many games it has, then accepts.
  - The player asks to join a space by its join code, and the host places them on a record or makes a new one.
  - The host places an account that has asked on a record directly.
- An invitation works once, lasts seven days, and can be withdrawn. Only a hash of its token is kept. A database function accepts it, so the checks cannot be skipped.
- An account is linked to at most one record in a space, and to any number of spaces.
- The host can unlink a record, and the player can leave. The history stays with the host, and the player no longer reads it. Every link and unlink is logged.
- Two records for one person are merged by marking one as merged into the other, read as one from then on. Ledger events are not rewritten.

## Consequences

- The copies are derived, and have to follow the game: written on settling, rewritten on revising, and made for every settled game when guest data is brought into an account.
- A player cannot check the table's total against other rows, only whether the host's books balanced and what was done about a difference. A host who wants the table to see everything still shares the settlement image.
- The other side of a transfer is the one name of another player that a linked player reads, and it is the host's note on that player.
- A player who was not linked when a game was played reads it as soon as they are, since the right follows the record.
- An assistant's rights are set out here but nothing is built for them yet.
