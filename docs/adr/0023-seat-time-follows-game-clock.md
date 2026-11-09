# 0023. Time at the table counts only while the game clock runs

- Status: Accepted
- Date: 2026-11-09

## Context

[ADR 0022](0022-table-fee-and-wages.md) counted time at the table from buy-in to leaving, whether or not the game clock ran. After trying it, the user decided on 2026-11-09 that a game whose clock has not started has not started, and a paused clock means the game is paused: nobody's time should count for the table fee or wages then.

The clock only stored the time so far and when the current run started, so the pauses were not known.

## Options considered

- Keep counting from the ledger alone: simple, but charges time the organizer has said is not play.
- Stop every player's session with ledger events when the clock pauses: writes many events for one tap, and undoing a pause would need reversals for each.
- **Keep each run of the clock on the game and count the overlap**: one small list on the timer, and time at the table stays derived.

## Decision

- `GameTimer` gains `runs`, the finished runs from start to pause. `pauseTimer` appends one, and a new clock starts with an empty list. The run still going ends at the current time when counted.
- Counted time is each player's sessions from ADR 0022 within the clock's runs. Before the clock starts there is none, so a game whose clock never ran charges nothing.
- "开局 xx 小时后" for wages now means once the clock shows xx hours, skipping pauses.
- A clock started before this change has no `runs` and an unknown history. Its game keeps the ADR 0022 behavior: all time at the table counts, and the after-hours rate counts from the first player sitting down. Pausing such a clock never starts a partial history.
- The game page says when the clock is not running in a game with a table fee or wages, and the settlement section says that only clock time counts.
- Backups stay at version 7 and carry `runs` as an optional field, so version 7 backups made before this change still restore, as do older ones.

## Consequences

- An organizer who forgets to start the clock sees no charges at settlement, with a note saying why. Starting the clock late cannot be corrected afterwards yet.
- Time at the table now depends on both the ledger and the clock, so both must be right.
