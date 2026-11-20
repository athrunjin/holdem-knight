# 0039. Rake configs keep their amounts in blinds

- Status: Accepted
- Date: 2026-11-20

## Context

A rake rule has two amounts: the cap and the smallest chip. [ADR 0036](0036-rake-rules-and-pot-records.md) kept each with its unit, chips or blinds, and kept whichever side of `blinds ⇔ chips` was typed last. The tools have no blinds, so they showed a rule in chips alone and saved configs in chips.

Insurance does it another way ([ADR 0037](0037-insurance-prices-rounded-to-the-smallest-chip.md)): a config keeps the smallest chip in small blinds and never in chips, chips typed at a game are turned into small blinds, and chips typed in the tools stay in the browser. The organizer expected rake to work the same, and it has to once a config can be updated in place ([ADR 0038](0038-game-configs-follow-saved-configs.md)): updating a config from the tools would have rewritten its blinds as chips, so that game configs following it stopped following the blinds.

## Options considered

- Keep both units and bar the tools from updating a config in blinds: two kinds of rake config stay, one that follows the blinds and one that does not, and which a config is depends on which box was typed in last.
- **Amounts in blinds only, as insurance has them**: a config means the same at every blind level, and the tools change only what has no unit.

## Decision

- At a game, chips or points typed for the cap or the smallest chip are kept as the blinds they come to, with two decimals: the cap in big blinds, the smallest chip in small blinds (`rakeChipsToBlinds`). The blinds are chosen so they come back to the chips typed as the rule uses them, a cap rounded down and a smallest chip to the nearest, which two decimals always allow while the blind is under 100 chips. The chips box shows those whole chips, and cannot be typed in while the blind is unknown.
- A config saved or updated at a game keeps its amounts in blinds (`rakeFormInBlinds`). An amount still in chips is turned into blinds only when the blinds come back to the same chips, so nothing it charges changes; otherwise it stays in chips.
- The tools keep showing and pricing in chips alone, kept in the browser. A config picked there brings its rate, its rounding and its switches, and leaves the chips typed there as they are (`rakeFormForTools`). A config saved or updated from the tools takes the rate, the rounding, the rounding switch and the insurance switch from the tools, and the cap and the smallest chip from the config they were taken from, or the default's with none (`rakeRuleFromTools`). The tools' chips are never kept, and changing only them leaves the config's name as it is.
- `RakeAmount` keeps its `chips` unit: games and configs from before this read as they did, and the tools price by it.
- No change to how rake is worked out, and none to backups.

## Consequences

- A cap fixed in chips whatever the blinds can no longer be set up; it has to be typed again when the blinds change.
- A config from before with an amount in chips keeps it until it is picked at a game and saved again. At a game it shows and counts in blinds; in the tools it still brings its chips.
- A game set up before this keeps a rake amount in chips until that amount is typed over.
- At a blind of 100 chips or more, two decimals of a blind are whole chips apart, so some chip amounts cannot be kept exactly; the chips box then shows what the blinds come to.
- The cap's chips now read rounded down to whole chips, as the rule has always applied them: 2.5 BB at a big blind of 5 reads 12, not 12.5.
