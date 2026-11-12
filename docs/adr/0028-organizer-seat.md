# 0028. The organizer plays under a seat of their own

- Status: Accepted
- Date: 2026-11-12

## Context

Organizers often play in the games they run. Until now the app had no way to say so: the organizer either stayed out of the ledger, or added themselves to the player list and was then charged their own table fee and wages, with their chips on one settlement row and what they received as organizer on another.

The settlement code already has an organizer row. `ORGANIZER_COLLECTOR` is where a covered chip difference, the insurance result and the charges land, and it can be the collector.

## Options considered

- Keep adding the organizer as an ordinary player: needs a flag on the game to say which player it is, and every charge, card and transfer would have to join two rows.
- A flag on a player record: the player list and reports would have to treat one player differently in some games only.
- **A seat with a fixed ID and no player record, the same ID settlement already uses for the organizer**: the ledger, table balance and settlement work as for any player, and everything the organizer receives lands on the row their chips are on.

## Decision

- `ORGANIZER_PLAYER_ID` is a seat in the ledger with no record in `players`, like the insurance seat ([ADR 0014](0014-insurance-seat.md)). `ORGANIZER_COLLECTOR` is now the same ID.
- The organizer joins from the game page with a first buy-in, and from then on has hands, a stack, a result and can leave and come back like a player. They stay on the organizer's card on the game and settlement pages, never among the players, and count as one of the seated.
- `chargeStatuses` and `seatTimes` leave the organizer out, so no table fee or wages are worked out for them: they would pay themselves.
- `settlementOutcome` keeps one organizer row. An organizer who plays and covers a difference has it taken from their own result. `attributeInsurance` and `applyCharges` already add to a row that exists.
- The organizer's name is the game's `organizerId` until organizers have names (M6).
- Backups accept the ID as a valid player and move to version 11, so an older app refuses a newer file instead of calling it damaged. The data has no new fields.

## Consequences

- The organizer's games do not appear in player reports, as they have no player record. Reports for organizers can read the seat when they are built.
- A game has one organizer seat. Two hosts who both play need one of them in the player list, charged like a player unless waived.
- An organizer who had added themselves as a player in earlier games stays a player there.
