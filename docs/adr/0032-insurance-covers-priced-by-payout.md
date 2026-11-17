# 0032. Insurance covers are priced by what they pay, and a rule keeps the table its odds came from

- Status: Accepted
- Date: 2026-11-17

## Context

A cover was named for what a hit left the buyer after the premium: 保本 left the stake, 半池 half the pot share, 满池 all of it ([ADR 0026](0026-insurance-cover-limits-and-odds-tables.md)). The payout was therefore that amount plus the premium, so 满池 paid more than the pot, and at low odds 保本 could ask for a premium larger than the pot itself. The organizer reads a cover the other way round: 满池 pays the pot. The write-ups of how insurance is played say the same, with 保本 as a payout equal to what the player put in and 满池 as a premium of the pot divided by the odds.

Apart from that, a rule kept its odds as numbers only. Two tables can hold the same odds, such as a saved copy of 1 赔 30, and the page could not tell which of them had been picked.

## Options considered

For the covers:

- Keep the covers as they were and cap the payout at the pot: 满池 would sit at the cap every time, and 保本 and 半池 would still pay 47% and 70% of a pot under names that say a third and a half.
- **Name every cover for its payout.**

For rounding, with whole chips:

- The largest premium whose payout stays within the target, for every cover: 保本 could pay a chip or two under the stake.
- **At least the target for 保本 and 半池, never more than the pot share for 满池**: the two smaller covers pay what they are named for or a little over, and the insurer never pays more than the pot.

For the table:

- Name the first table that holds the odds in use, as before: a saved table with a preset's odds reads as the preset.
- Prefer saved tables over presets: the same fault the other way round.
- **Keep the table's ID with the odds.**

## Decision

- `quoteInsurance` prices 保本 as the smallest whole premium whose payout, any refunded premium included, is at least the stake (`premiumReaching`), and 半池 the same for half the pot share, rounded up. 满池 is the largest whole premium whose payout is no more than the pot share (`premiumWithin`).
- No cover or custom premium pays more than the pot share: `maxPremiumChips` is the full pot's premium, or the rule's limit where that is lower. A cover held under its target is marked as capped.
- A street's cover limit is measured the same way: the largest cover on sale is the one that pays the stake, or the given part of the pot share.
- A pot share that a single chip of premium would overpay has no insurance (`pot-too-small`).
- `InsuranceRule` and its form gain an optional `oddsTableId`. `oddsTableInUse` names that table while it still holds the odds in use, and otherwise the first table that does. Backups keep the field, with no change of version: a rule without it reads as before.

## Consequences

- 保本 and 半池 cost less than before, and a hit leaves the stake or half the pot less the premium, not the whole of it. On a pot of 3,000 at 3.5 with a stake of 1,000 the premiums are 286, 429 and 857, where they were 400, 600 and 1,200.
- Insurance already bought is not repriced: a purchase keeps the premium and payout it was sold at.
- The helpers that priced a cover by what it left, `premiumFor` and `premiumForNet`, are gone.
- A table deleted or edited after its odds were taken no longer names them, and the odds fall back to the first table holding them, or to 自定义.
