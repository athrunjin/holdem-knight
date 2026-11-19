# 0036. Rake rules with a cap and rounding, and the pot kept with each rake

- Status: Accepted
- Date: 2026-11-19

## Context

[ADR 0034](0034-rake-as-a-seat-with-no-buy-in.md) fixed rake at 10% of the pot, rounded down to whole chips, so the screens could be tried first. Organizers set rake per game: a rate such as 5% or 2.5%, a cap per pot in chips or in big blinds, and amounts that come out in the smallest chip on the table. They also want to see each pot that was raked, not only the total.

## Options considered

- Whole percentages only: 2.5% is common enough to need decimals.
- Cap in chips only: a cap in big blinds keeps its meaning when the stakes change.
- Rounding down only: with 5 as the smallest chip, rounding down takes less than the rule says on most pots; organizers expect the nearest chip.
- **A percentage with two decimals, an optional cap in chips or big blinds, and rounding to the smallest chip, with the pot kept on each rake event**: matches how rake is set and checked at the table.

## Decision

- `RakeRule` gains `rounding` (`nearest`, `down` or `up`), an optional `roundTo` (the smallest chip) and an optional `cap`, each a `RakeAmount` in chips or in big blinds, and `insuranceAfterRake`. `percent` may have two decimals, and an amount in big blinds two decimals too. New games default to 5%, rounded to the nearest big blind, with no cap; a cap switched on starts at 2 big blinds, as live rooms cap at a couple of big blinds.
- Setup shows each amount as big blinds ⇔ chips, or points, and keeps the unit last typed, so a cap typed in big blinds follows the blinds and one typed in chips does not. The cap and the rounding each have a switch; with rounding off the rake rounds down to whole chips.
- `rakeFromPot` works in whole numbers: the pot times the rate in hundredths of a percent, rounded to the smallest chip by the rule, then held to the cap. The cap is rounded down to the smallest chip. Amounts in big blinds use the game's big blind, and are left out without one, as on the tools page.
- A rule without `rounding` is from before these settings: it rounds down to whole chips with no cap, so earlier games price as they did, and it carries over to a new game that way.
- `RakeEvent` keeps `potChips` when the rake came from a pot typed in the dialog. A rake typed by hand, or a total typed over, has none.
- Rake configs are saved with the table fee and wage configs, as `SavedChargeRule` of kind `rake`.
- `insuranceAfterRake` is kept and shown, off by default, but does not change insurance quotes yet.
- No flop no drop, a minimum pot and rake per side pot are left out. Rake goes only to the host.
- Backups move to version 14.

## Consequences

- The rake on a pot depends on the smallest chip the organizer enters; leaving it at 1 matches whole-chip rounding.
- Turning `insuranceAfterRake` on will need its own decision on how quotes take the rake out of the pot. Online rooms take rake off the pot before pricing a cash-out; no rule for live games was found.
