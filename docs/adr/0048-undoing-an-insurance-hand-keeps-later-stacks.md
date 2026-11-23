# 0048. Undoing an insurance hand keeps the stacks changed since

- Status: Accepted
- Date: 2026-11-23

## Context

Under [ADR 0017](0017-finished-hand-sets-stacks.md) a finished hand sets each all-in player's stack with a `stack_set` event tagged with the hand, and undoing the hand reverses every event with that tag. A reversal takes back the amount an event changed at the time, and a stack never goes below 0. A hand undone at once comes back exactly. A hand undone later does not: a stack typed since is moved by an amount that no longer means anything, a change to a seat that has left is lost at 0, and a second try after a write failed half way reverses everything again. None of these shows in the table balance.

## Options considered

- Refuse to undo a hand once anything changed after it: safe, but the usual reason to undo is a mistake found later.
- Undo everything as before and ask the organizer to count the chips again: it changes stacks that were counted at the table for one that was not.
- **Take back the insurance, and restore a stack only while nothing has changed it since**: chips counted after the hand are the truth, whatever the hand got wrong.

## Decision

- `undoInsuranceHand` and `undoInsurance` in `core` work out what an undo appends. The pages no longer build it.
- A hand's purchases, results and the hands players bought for a premium ([ADR 0018](0018-short-premium-buy-in.md)) are always taken back.
- A stack the hand set is restored only if nothing moved that player's chips after it: a typed stack, a buy, a cash-out, or one of those taken back. Otherwise it stays as it is now. Taking back a hand bought moves the stack by it, so a stack that stays is written again a millisecond later.
- A change made after the hand and taken back again is no change: a later hand undone first, or a player who left and came back, leaves this hand's stacks to be restored.
- Events already reversed are left alone, so an undo asked twice does nothing more.
- A seat that has left after a settle attempt comes back in the same change, as it does when insurance is bought or settled. A seat holding less than the premiums it gives back buys whole hands first, as it does to pay a hit.
- Where the hand set the seat's chips outright (the organizer counted them at the summary, or changed the seat's Buy-ins apart from its chips), the seat is written back to what it had before the hand, moved by whatever later hands won or lost it, unless its chips were set or bought again since. Reversals alone cannot restore it: the chips set took no account of what the hand moved, and a stack that stopped at 0 has lost the rest. Buy-ins the seat was given or gave back at the summary are a record of their own, and stay.
- Dropping an open hand takes back anything it had already written.
- `adjustHands` never takes back a hand bought for a premium. It goes only with its insurance hand.
- Settlement cannot start while an insurance hand is open, and insurance cannot be turned off while one is: the hand's result is not in the ledger yet, and could not be written once everyone has left.

## Consequences

- After undoing a hand whose players' chips changed since, the table balance may be out by what the insurance moved. That is the difference between the count at the table and a record now known to be wrong, and it is for the organizer to see.
- The question asked before an undo names the players whose chips stay.
- Hands the seat bought to pay a hit stay bought, as before.
- A player whose stack stays still has the hand bought for a premium taken back, so their Buy-ins drop by it while their chips do not. Where the chips were really bought, the table balance shows it and the Buy-in is added again by hand.
- A hand undone late cannot simply be entered again: finishing it would set stacks from the hand's own figures over those counted since.
