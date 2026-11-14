# 0031. Archiving a game into history

- Status: Superseded in part by [0032](0032-game-stages.md): only a settled game can be archived, and history has two parts
- Date: 2026-11-14

## Context

History was every settled game in one list. With transfers that can be ticked off ([ADR 0030](0030-transfers-marked-as-made.md)), the organizer wants to see which games still have money owed and which are closed for good, and to decide when a game moves there.

## Options considered

- Work the group out from the transfers each time the list is shown: the list would have to load every game's ledger and settle it again to know one word.
- A third game status after `settled`: every place that reads the status would have to learn it, for something that changes nothing about the ledger or the results.
- **A field beside the status, saved when the organizer archives the game and kept in step when a transfer is ticked**: the list reads one field, and the status keeps its two values.

## Decision

- `Game` gains an optional `archive`: `complete` when every transfer of its plan was marked as made, `pending` otherwise. Missing means the game is not archived.
- `archiveGame` sets it. Archiving is always allowed, whatever has been ticked; an open game is settled in the same step, since only a settled game is history. `unarchiveGame` takes the game back out, and `reopenGame` clears the field with the rest of the settlement.
- While a game is archived, ticking or clearing a transfer moves it between the two groups (`refileGame`). The settlement page does this, as the only place that knows the plan's transfers.
- The plan cannot be changed while any of its transfers is marked as made: the other plan would ask for that payment again in another shape. The marks are cleared first.
- The games list shows history in three parts: settled games not yet archived, then 积分待处理 (`pending`), then 完成 (`complete`).
- The field joins backup version 12, added in the same release as the marks.

## Consequences

- `archive` can lag behind the ledger only through a reopened game, and reopening clears it.
- A game with nothing to transfer is complete as soon as it is archived.
- Settled games from before this stay under history, not archived, until the organizer files them.
