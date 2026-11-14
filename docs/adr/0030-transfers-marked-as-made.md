# 0030. Marking transfers as made

- Status: Accepted
- Date: 2026-11-14

## Context

After a game the organizer follows up on who has paid. The settlement page listed the transfers but had no way to tick them off, so that was tracked in a chat or on paper.

Transfers are not saved: they are worked out from the ledger and the chosen plan ([ADR 0012](0012-settlement-collector.md), [ADR 0029](0029-default-transfer-plan.md)). A mark needs something saved to hold on to.

## Options considered

- Save the transfer list with a flag on each: it goes stale when the plan changes or a reopened game changes the results, which is why 0012 did not save it.
- Mark by position in the list: any change of plan or result moves the marks onto other payments.
- Mark by the two people only: a mark would survive a change in the amount, and say a payment was made that was made for another sum.
- **Save the marked payments themselves, each as who pays whom and how much**: a mark shows wherever the current plan has exactly that payment.

## Decision

- `Game` gains an optional `doneTransfers`, a list of `Transfer`. `markTransfers` adds or removes marks and `isTransferDone` reads them, both in `core`. `Transfer` moves to the domain types.
- A mark applies to a transfer with the same payer, payee and amount. It holds when the plan changes and comes back to the same payment, and no longer applies once the amount changes, for example after reopening the game. Marks that match nothing stay saved and unseen.
- Marks can be set before and after settlement is confirmed, like the plan.
- Marks are a note for the organizer. They do not move results, and nothing else reads them yet.
- Backups move to version 12 with the new field, so an older app refuses a newer file instead of dropping the marks.

## Consequences

- Two payments in one plan are never between the same two people in the same direction, so a mark cannot stand for more than one transfer at a time.
- A mark that stopped matching is not cleaned up. The list is bounded by the handful of plans a game is viewed in.
- What a collector holds is still not tracked: the marks say which payments were made, not where the money is.
