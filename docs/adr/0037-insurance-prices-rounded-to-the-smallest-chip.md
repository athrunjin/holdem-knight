# 0037. Insurance prices rounded to the smallest chip

- Status: Accepted
- Date: 2026-11-20

## Context

Insurance priced in whole chips. [ADR 0032](0032-insurance-covers-are-priced-by-what-they-pay.md) settled the edges that whole chips leave: 保本 and 半池 take the smallest whole premium that pays at least their target, and 满池 the largest whose payout stays within the pot share. At a table whose smallest chip is 5, a premium of 286 cannot be paid, and the organizer rounds it by hand. Rake already rounds to the smallest chip ([ADR 0036](0036-rake-rules-and-pot-records.md)), and the organizer asked for insurance to do the same, set the same way.

## Options considered

- Keep the whole-chip edges and round only the premium shown: the payout would then not follow from the premium and the odds.
- Round to the smallest chip but keep the edges, so 保本 always pays at least the stake and 满池 never more than the pot: with the smallest chip at 5 or more, the edges move a premium a whole chip away from the nearest one, which is not what the organizer asked for.
- **Round both the premium and the payout to the smallest chip by the rule's mode, in place of the edges**: matches how the table pays, and the mode (四舍五入, 向下取整 or 向上取整) is the organizer's choice.

## Decision

- `InsuranceRule` gains an optional `rounding`: a `mode` (`nearest`, `down` or `up`), the smallest chip in small blinds (`smallBlinds`, two decimals, missing means 1), and the smallest chip in chips (`chips`), which is set only where the rule is used and never kept.
- With `rounding.chips` known, each cover's premium is its target payout over the odds, rounded to the smallest chip by the mode, and at least one smallest chip. The payout is the premium times the odds, rounded the same way, plus the premium where it is refunded. A pot share whose premium rounds to nothing has no insurance. Cover limits hold the premium as before.
- The built-in rules, and so new games, round to the nearest small blind. A rule without `rounding` is from before it, and prices in whole chips with the ADR 0032 edges, as does a rule whose smallest chip is not known.
- At a game, the smallest chip is the rule's small blinds times the game's small blind, rounded to whole chips and at least 1 (`ruleAtStakes`). Setup shows it as `最小筹码面值: 1 SB ⇔ 5 [chip]`; typing chips sets the small blinds.
- The insurance tools have no game, so the smallest chip is typed in chips, 1 by default, with 1, 5, 10 and 20 a tap away, and kept with the tools' settings in the browser.
- A saved insurance config keeps the mode and the small blinds, never the chips (`ruleToKeep`). Picking one in the tools keeps the chips typed there; at a game the small blinds are worked out from the game's small blind.
- Backups keep `rounding` with its mode and small blinds, still at version 14.

## Consequences

- With rounding on, 保本 can pay a little less or more than the stake, and 满池, rounded up, a little more than the pot share. The info mark by 超出部分 says so.
- A config saved in the tools carries no chips; a config saved at a game with a smallest chip of 2 SB brings 2 SB to the next game, whatever its blinds.
