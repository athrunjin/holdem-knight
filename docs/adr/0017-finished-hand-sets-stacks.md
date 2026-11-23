# 0017. A finished hand sets the stacks it knows

- Status: Superseded in part by [0018](0018-short-premium-buy-in.md), and by [0048](0048-undoing-an-insurance-hand-keeps-later-stacks.md) on what undoing a hand restores
- Date: 2026-11-05

## Context

ADR 0015 left every player's stack alone, so the organizer typed the stacks after each insurance hand. Once all five cards are entered, the hand already holds everything needed to work those stacks out.

## Options considered

- Show the results and leave the organizer to type them: this repeats work and invites mistakes.
- Move chips with `insurance_settle`: a result would mix a hand's outcome with insurance, and a hand with nothing bought would have no event to carry it.
- **Set the stacks with `stack_set` events tagged with the hand**: this is the event a typed stack already uses, and undoing the hand reverses it.

## Decision

- `playerHandResults` works out each player's pot winnings, refund, insurance result and total. Every all-in player's chips are their whole stack, so what they end with is their new stack.
- A cover player has chips behind that the hand does not know, so they get a result but no stack. Their stack stays as it is, for the organizer to type.
- An odd chip goes to the first winner entered, because seats are not recorded.
- A premium a player's winnings could not pay leaves them at 0, and the summary shows what is short. The table balance shows the same gap.
- Finishing writes these `stack_set` events in the same write as the seat's result, only for players still seated. `handId` ties them to the hand, so undoing it restores the stacks.
- The hand no longer writes nothing when nothing was bought: its stacks still change.

## Consequences

- The table balances after a finished hand only once the cover player's stack is typed, and any folded player whose chips are in the dead money.
- ADR 0015 still holds during a hand: nothing moves until the organizer finishes it.
