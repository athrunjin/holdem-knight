# 0029. The transfer plan a game starts with, and changing it after settlement

- Status: Accepted
- Date: 2026-11-14

## Context

[ADR 0012](0012-settlement-collector.md) saved who collects on the game, with a missing value meaning the optimal plan, and locked the choice once settlement was confirmed.

In a game with insurance, a table fee or wages the organizer is owed money by most of the table, and in practice everyone settles with the organizer. Those games opened on the optimal plan, so the organizer changed the plan every time. The plan also turned out to be something organizers revisit after confirming, when the table agrees on a different way to pay, and reopening the game for it is out of proportion: the plan moves no result.

## Options considered

- Write the organizer as collector into the game when it is created or settled: games already saved would keep the old behavior, and turning insurance or a charge on or off later would leave a stale choice behind.
- A second field for the kind of plan beside `collectorId`: two fields that can disagree.
- **Keep one field, let a missing value mean the game's own default, and save the optimal plan as a value of its own**: the default follows the game's settings as they are now, and an organizer who picks the optimal plan in a game with charges keeps it.

## Decision

- `collectorId` may also be `OPTIMAL_PLAN`, the optimal plan chosen outright. `chooseCollector` saves it for that choice instead of clearing the field.
- A missing `collectorId` means the game's default: the organizer collects in a game with insurance, a table fee or wages, and any other game takes the optimal plan. Rake joins the list when it exists (M4).
- `transferCollector` in `core` resolves the plan. A saved collector who is no longer in the game falls back to the same default, where 0012 fell back to the optimal plan.
- The plan can be changed on a settled game. Results, charges and the difference handling stay locked there as before.
- The organizer is named by the game's `organizerId` in the plan and the transfers, as on their card ([ADR 0028](0028-organizer-seat.md)), in place of the fixed label of 0012.
- The backup format stays at version 11: the field already holds any ID. An older app reads `OPTIMAL_PLAN` as a collector who is not in the game and shows the optimal plan, which is what was chosen.

## Consequences

- Games saved before this, with insurance or charges and no collector chosen, now show the organizer collecting, settled ones included. Their results do not change, and the optimal plan is one tap away.
- A collector plan usually has more transfers than the optimal plan. In the games it is now the default for, most transfers already had the organizer on one side.
- `OPTIMAL_PLAN` joins the reserved IDs. Player IDs are generated, so none can collide with it.
