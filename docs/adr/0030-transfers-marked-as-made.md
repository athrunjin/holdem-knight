# 0030. Marking transfers as made

- Status: Accepted
- Date: 2026-11-14

## Context

After a game the organizer follows up on who has paid. The settlement page listed the transfers but had no way to tick them off, so that was tracked in a chat or on paper.

Transfers are not saved: they are worked out from the ledger and the chosen plan ([ADR 0012](0012-settlement-collector.md), [ADR 0029](0029-default-transfer-plan.md)). A mark needs something saved to hold on to.

## Options considered

- Save the transfer list with a flag on each: it goes stale when the plan or the results change, which is why 0012 did not save it.
- Mark by position in the list: any change of plan or result moves the marks onto other payments.
- Mark by the two people only: a mark would survive a change in the amount, and say a payment was made that was made for another sum.
- **Save the marked payments themselves, each as who pays whom and how much**: a mark shows wherever the current plan has exactly that payment.

## Decision

- `Game` gains an optional `doneTransfers`, a list of `Transfer`. `markTransfers` adds or removes marks and `isTransferDone` reads them, both in `core`. `Transfer` moves to the domain types.
- A mark applies to a transfer with the same payer, payee and amount.
- Marks can only be set once the results are confirmed, and go when the results are opened again ([ADR 0031](0031-game-stages.md)). Until then the transfers can still change.
- The plan cannot be changed while one of its transfers is marked: the other plan would ask for that payment again in another shape. The marks are cleared first.
- Marks are a note for the organizer. They do not move results. The only thing that reads them is whether a settled game is complete (ADR 0031).
- Backups move to version 12 with the new field, so an older app refuses a newer file instead of dropping the marks.

## Consequences

- Two payments in one plan are never between the same two people in the same direction, so a mark cannot stand for more than one transfer at a time.
- Marks are made in one plan at a time, on results that no longer change, so a saved mark always matches a transfer on the page.
- What a collector holds is still not tracked: the marks say which payments were made, not where the money is.
