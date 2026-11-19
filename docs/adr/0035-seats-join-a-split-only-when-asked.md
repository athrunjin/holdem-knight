# 0035. Seats join a split only when asked

- Status: Accepted
- Date: 2026-11-19

## Context

When the chips do not balance and the organizer splits the difference by win or loss (水上/水下比例分摊), every result on the side that is too large used to take a share in proportion to its size. That included the insurance seat, and from ADR 0034 the rake seat. Both are the organizer's money rather than a player's, and the organizer wants to decide whether they carry part of a counting mistake at the table.

## Options considered

- Keep both seats in every split: the organizer pays for mistakes that happened between players.
- Leave both out always: a game with only seats on one side could not be split at all.
- **A switch for each seat, off by default**, shown where the organizer reads their own results.

## Decision

- `settlementOutcome` takes `SplitSeats`: `insuranceInSplit` and `rakeInSplit`, both off unless set. A seat that is off takes no share. If no player is on the side being split, the seats on it share anyway, so the difference never goes unhandled.
- The game keeps each choice as `insuranceInSplit` and `rakeInSplit`, set by `chooseInsuranceInSplit` and `chooseRakeInSplit`. Backups carry them from version 13.
- The organizer's card on the settlement page lists the shares under the charges, in this order: 差额分摊 (their own as a player, not switchable), 差额分摊 - 保险 and 差额分摊 - 抽水. A seat's line shows only while that seat is on the side being split. Off, the line is struck through and shows no figures. On, it shows the chips and the amount with their signs, in the highlight color.
- The insurance and rake rows show their results before any split. When the insurance result goes to a player, or stays on its own row, that card has the 保险 switch instead.
- Every 差额分摊 line shows its chips beside the amount, which can be part of a chip: −27.27. A folded card sums its shares into one 分摊 figure.

## Consequences

- Games settled before this change with the insurance seat in a split now leave it out until the switch is turned on. Their results are worked out again whenever the settlement page opens, so they change.
- A seat forced to share, with no player on its side, shows its share with the switch locked.
