# 0024. Itemized wages by rate, and waiving a charge at settlement

- Status: Superseded in part by [0025](0025-wage-segments-and-billing-units.md)
- Date: 2026-11-09

## Context

The organizer wants each player's settlement to show what they pay and why: wages as "rate × time" at each rate, the table fee, and a total. They also want to let a player off a single charge, such as the table fee for someone who only watched, without turning the option off for everyone.

[ADR 0022](0022-table-fee-and-wages.md) rounded a player's wages once over all rates, so the figures for each rate would not add up to what was shown, and charges could not be waived.

## Options considered

- Show one wage figure and a note of the rates: the organizer cannot check it by hand.
- Edit charges as amounts typed at settlement: flexible, but nothing ties the amount to the time at the table.
- **List wages per rate, each rounded on its own, and keep waivers on the game**: every line can be checked by hand, and a waiver stays tied to the player and the charge.

## Decision

- `wageParts` splits a player's wages into the base rate and the adjusted rate. Each counts the whole minutes of all the player's time at that rate and rounds half up to the cent. This replaces rounding once over all rates, so wages can differ by a cent from ADR 0022.
- `Charge` is a table fee or the wages at one rate, with the rate and minutes for wages and a `waived` flag. Waived charges stay in the list so they can be shown and restored.
- `Game` gains optional `waivedCharges`: each names a player, a kind and, for wages, the rate. `waiveCharge` adds or removes one. `applyCharges` skips waived charges, and detail mode during the game does too.
- The settlement page shows one card per person: a tinted row with their chips and the result from the chips, then a line for each adjustment and a total. Adjustments are a share of a difference, insurance given to the person, and each charge with a box to waive it. A person with no adjustments shows only the row, with the total in it.
- Waivers can change until the game is settled. Reopening the game allows changes again.
- Backups move to version 8 to carry waivers. Older backups still restore.

## Consequences

- The organizer's card lists a covered difference, insurance and the table fee and wage income in the same way.
- A waiver names the rate, not an amount, so a waived wage stays waived if more time is added after reopening.
- Choosing who receives the charges remains open, as an optional field read by `applyCharges`.
