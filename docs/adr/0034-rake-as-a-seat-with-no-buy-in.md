# 0034. Rake as a seat with no Buy-in

- Status: Accepted
- Date: 2026-11-19

## Context

M4 adds rake. In a raked game the dealer takes chips out of each pot, so they leave the table and the players' stacks no longer add up to the Buy-ins. The organizer keeps the rake, and needs to see it beside insurance on their card, add to it pot by pot, take back a mistake, and have the table balance and settlement count it.

The first version fixes the rule at 10% of the pot, rounded down to whole chips, so the screens can be tried at the table before rake gets settings of its own (caps, no flop no drop, rake by profit).

## Options considered

- Keep a running total on the game record: it would be the one number in a game that can be overwritten, against the append-only ledger (ADR 0005), and undo would need its own history.
- Record rake as `stack_set` on a seat bought in for 0: a Buy-in of 0 would show in the game record and the seat would have to sit, leave and come back with the players.
- Pass the rake to the balance check as a separate term, as `chipDifference` allowed: every caller would have to remember it, and settlement would have to share out the cents of one more result by hand.
- **A `rake` event, and a rake seat derived from it**: each pot adds an event, undo is a reversal, and the seat joins the results like any player who has left.

## Decision

- `RAKE_PLAYER_ID` is a seat with no player record, like the insurance seat (ADR 0014). Its name 抽水 is reserved. Backups accept it as a player ID.
- A `rake` ledger event changes it by a whole number of chips other than 0. Adding a pot's rake is a change above 0. The organizer can also type the total in again, and that is saved as the change from the old total, which may be below 0. The total never goes below 0. 撤销 appends a reversal of the latest rake still in effect, so the total goes back one save at a time.
- `summarizeByPlayer` adds the seat while the rake is above 0, as one who has left with every chip of rake and bought nothing: never seated, its result is the rake. The table balance, the chip difference and the cash results then count it with no term of their own, and `chipDifference` loses its rake term.
- The seat never sits, so leaving, 一键离桌 and 一键回桌 pass it by, and charges never apply to it.
- At settlement `attributeRake` moves its result to the organizer, on their own row if they play. A game with rake goes through the organizer by default, as one with insurance or charges does.
- `rakeFromPot` takes the rule's whole percentage of a pot and rounds down. Each game keeps a copy of its `RakeRule`; for now every game takes `DEFAULT_RAKE_RULE`, 10%.
- Backups move to version 13 for the rule on games and saved configs and the new event.

## Consequences

- The rake comes out of the table balance only once the stacks show it gone. Until the organizer types the stacks after the pot, the balance reads the rake as too much.
- With 水上比例分摊 the rake seat stays out of the split unless the organizer switches it in, as [ADR 0035](0035-seats-join-a-split-only-when-asked.md) sets out for both seats.
- Rake recorded in a game keeps it on: the switch cannot be turned off until the rake is taken back.
- The Supabase implementation (M6) must accept the seat's ID and the `rake` event type.
