# 0022. Table fees and wages as cash charges at settlement

- Status: Accepted
- Date: 2026-11-09

## Context

Organizers charge players for the game itself: a flat table fee and an hourly wage (工资). Both depend on how long each player sat, both are paid in cash rather than chips, and both go to the host by default. The organizer will later want to waive or change a single charge, and maybe give the money to someone else.

Settled with the user on 2026-11-09:

- Wages are per player: the hourly rate times that player's own time at the table, by the minute.
- Time at the table runs from buying in to leaving, and starts again when a player returns (返回). The game clock pausing does not stop it.
- The table fee is charged once per player per game, once their total time reaches the minimum.
- The time-of-day rate and the rate after some hours are advanced settings, and only one can be on at a time.

## Options considered

- Record charges as ledger events while the game runs: they would need writing at the right moments and undoing whenever a player's time changes, and they are not chips.
- Take chips from the players' stacks: the table balance would no longer be 0, and the chip results would mix the game with the cards.
- **Work charges out at settlement from the ledger's timestamps**: nothing new is stored beyond the rule on the game, the chip results stay as played, and reopening a game recomputes them.

## Decision

- `Game` and `GameSettings` gain optional `tableFee` and `wage`. Each game keeps its own copy, like the insurance rule, and both can change at any time because nothing is charged until settlement.
- `seatSessions` reads each player's sessions from buy-ins, cash-outs and reversed cash-outs. A player whose records are all reversed was a mistake and has none.
- `gameCharges` returns one `Charge` per player and kind (`table_fee` or `wage`), leaving out amounts of 0. The insurance seat is never charged.
- Wages count the whole minutes of a player's total time, each at the rate in force then, and round half up to the cent once. A part minute is not charged. "开局" for the after-hours rate is when the first player sat down.
- Time of day comes from a `minuteOfDay` function the app supplies, so `core` never reads a time zone.
- `applyCharges` runs after insurance is attributed. It takes each player's charges from their cash result and gives the total to the recipient, the organizer for now, keeping the total of all results. Transfers use the charged results.
- The settlement page marks charges apart: each charged player's row and the organizer's row say so, a note sums them, and a 台费和工资 section lists time, fee and wage per player.
- Backups move to version 7 to carry the rules on games and saved configs. Older backups still restore.

## Consequences

- Waiving or changing a charge, or choosing who receives the money, can be added as optional fields on `Game` (overrides per player and kind, and a recipient) that `gameCharges` and `applyCharges` read. The charge list already keeps each amount apart for this.
- Time at the table depends on when the organizer records buy-ins and departures. A late entry shortens a player's time.
- A player who was never charged still shows in the section with their time, so the organizer can see why.
