# 0027. Wage units at the longer rate, rounding modes, and the game's time zone

- Status: Accepted
- Date: 2026-11-12

## Context

[ADR 0025](0025-wage-segments-and-billing-units.md) rounded a player's total time to the billing unit and gave the minutes that added or took away to the rate they sat at last. Checking it against real nights showed four problems:

- The same time at the same rates cost more or less depending on which rate came last, and the minutes listed per rate included rounding the player could not see.
- A time segment only began the next time its hour came round, so a game that started at 23:00 never reached "22 to 6".
- Segments were a fixed number of hours long, so their ends were an hour off on a daylight saving night.
- "What hour is it" was read from the viewing device. The same game, settled or not, priced differently on a phone in another time zone.

The user also asked for rounding to the nearest unit, as the default, beside rounding up and down.

## Options considered

- Keep rounding the total and share the difference between rates by time: fair, but gives odd minutes per rate that are hard to check.
- **Charge unit by unit, each unit at the rate that covers more of it**: every line is whole units, and a player can check it from when they sat down.
- Save the amounts when a game is settled, so nothing can change them: also fixes time zones, but is a larger change, and the game's zone is needed anyway for games still open.
- **Keep the time zone on the game**: time of day is then the same on every device.

## Decision

- `WageRule` gains `rounding`: `nearest`, `up` or `down`. A rule with it is charged by `unitWageParts`. Rules without it keep their charging: `segmentedWageParts` for those with `unitMinutes` and `roundUp` (ADR 0025), and `wageParts` for older ones, so earlier games price as they did.
- A player's counted time, with pauses and time away left out, is cut into billing units from the moment they sat down. A part unit at the end counts as a whole one when it is half or more (`nearest`), always (`up`) or never (`down`).
- A part unit that counts runs on past the moment the player left, on the wall clock, to make a whole unit.
- Each unit is charged at one rate: the one that covers more of it, or the higher rate when two cover the same. With ¥20 before midnight and ¥30 after, 30-minute units and rounding up, 23:16 to 0:13 is 23:16–23:46 at ¥20 and 23:46–0:16 at ¥30, as 16 of its minutes are after midnight.
- New games default to charging by the minute, rounded to the nearest. The setup shows the rounding as a list instead of a switch. A rule carried over from an earlier game reads as `up` or `down`.
- For these rules `localWageWindows` places time segments by the real local clock. A game that starts inside the segments begins in them: inside their hours when the last has an end, or within 12 hours of the first one's start when it has none. Otherwise they begin the next time the first one's hour comes round.
- Segment ends are the moments the local clock reaches their hours. Where daylight saving skips an hour, the jump counts; where an hour comes twice, the first time counts. Local hours are searched by the quarter hour, which every time zone's offset is a multiple of.
- `Game` gains `timeZone`, the device's IANA zone when the game is created. The app gives `core` the time of day in that zone. Games without it use the viewing device's zone, as before. The page does not name the zone: dates still show in the device's time, and only the rates follow the game's.
- Settlement tells players how they were charged. Each card shows the time sat and the time charged. With 明细 on, a short block above the cards names the wages and table fee the game charged: only the rates some player was charged at, the unit and rounding, and the fee with its minimum time. Its info button states the rules in words: the unit and rounding, the longer-rate rule when the game has segments, the table fee and that only clock time counts. The shared image carries those lines.
- The organizer's card leads the cards and folds like the players', with its incomes on the folded line and no sum, as that would repeat its total.
- Backups move to version 10 for `rounding` and `timeZone`. Sample backups are marked as Beijing time.

## Consequences

- Amounts are not saved at settlement. A settled game still prices from its ledger and rule, now with its own time zone.
- A unit can be charged at a rate the player sat at for less than half of it, and rounding up can charge time not sat, by design. The organizer can waive a rate.
- Three generations of wage rules are charged by three functions. The older two only serve earlier games and can go once those no longer matter.
