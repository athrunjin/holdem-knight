# 0025. Wage segments, billing units and rounding up

- Status: Accepted
- Date: 2026-11-11

## Context

[ADR 0022](0022-table-fee-and-wages.md) gave wages one base rate and at most one advanced rate, by time of day or after the clock shows some hours, charged by the whole minute with a part minute dropped. [ADR 0024](0024-itemized-charges-and-waivers.md) listed and waived wages per rate.

Organizers asked for more: a few rates through the night, both kinds of rate at once, and charging by the quarter, the half hour or the hour, where "under 2 hours counts as 2" is common.

## Options considered

- Keep one advanced rate and add a rounding switch: does not cover a night with several rates.
- Daily windows for any number of rates: an open-ended "from midnight on" means nothing for a window that repeats each day.
- **Segments on the game's timeline, with a billing unit applied to each player's total time**: matches how organizers describe a night, and every line can still be checked by hand.

## Decision

- `WageRule` gains `unitMinutes` (1, 15, 30 or 60), `roundUp`, `timeSegments` and `afterStartSegments`. A rule with `unitMinutes` set is charged by `segmentedWageParts`; a rule without it is from before and keeps the old charging, `adjustment` included, so earlier games price as they did.
- Time segments follow each other on the game's timeline. The first starts the first time the local clock shows its hour once the game has started, which is the clock's first run or, for an older clock, the first player sitting down. Each later one starts where the one before ends, and only the last may run to the end of the game. Together they may not cover more than 24 hours.
- Game time segments start once the game clock shows their hours, in rising order, each until the next.
- There are at most 3 of each kind and 4 in all. Where a time segment and a game time segment both apply, the higher rate wins, or the one that began first at equal rates.
- A player's time is summed over all rates and charged in whole units, rounded up or down by the rule. Each rate gets its whole minutes, and what rounding adds, or takes away, falls on the rate the player sat at last, then on earlier ones. Each rate still rounds half up to the cent.
- Wage parts are named `base`, `time-1` to `time-3` and `after-1` to `after-3`, so waivers keep naming a rate. Older games keep `adjusted`.
- New games default to charging by the minute with a part minute counted. A rule carried over from an older game keeps charging by the minute with the part minute dropped, as it did.
- Wage and table fee setups can be saved under a name, as `SavedChargeRule`, and picked when starting a game. Backups move to version 9.

## Consequences

- A rate at a time segment's hour depends on when the game started: from 0 o'clock in a game that starts at 2:00 begins at the next midnight.
- Daylight saving shifts a time segment's end by an hour on the night it changes, since segments are measured in hours from their start.
- Rounding up can charge a player for time they did not sit, by design; the organizer can still waive a rate.
