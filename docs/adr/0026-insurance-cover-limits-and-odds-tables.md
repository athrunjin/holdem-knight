# 0026. Insurance cover limits, and odds tables kept apart from the rule's settings

- Status: Accepted
- Date: 2026-11-11

## Context

Insurance rules capped the premium at a percentage of the pot, and could close the turn card after a flop all-in. Organizers think of limits as how much a hit may give back: the stake, half the pot, three quarters or the full pot, which are the covers the calculator already quotes. They also reuse one odds table with different settings, and different tables with the same settings.

## Options considered

- Keep premium caps and add presets: 保本 has no fixed percentage of the pot, so it cannot be a preset.
- **Cover limits by street, and odds tables saved on their own**: matches the quotes, and each part is picked or saved without touching the other.

## Decision

- `InsuranceRule` loses `coverTurn` and the premium caps. A flop all-in can always insure the turn card, one card at a time, and the river can always be insured.
- `turnCoverLimit` and `riverCoverLimit` are `stake` or a percentage from 1 to 99 of the buyer's pot share. Missing means the full share. `quoteInsurance` holds the premium to what leaves the buyer that much on a hit, and marks a cover held below its target as capped.
- `SavedOddsTable` keeps odds by outs under a name. Picking one, or confirming an edited table, sets only the game's odds.
- A saved insurance rule is picked for its other settings only: whether a hit refunds the premium, whether tie cards count, and the two limits. The game's odds stay as they are.
- Rules from before lose their caps and turn switch when read from storage or a backup, so they insure the full pot and the turn card. Backups move to version 9.

## Consequences

- A game set up with a premium cap, or with the turn card closed, now prices as if neither were set.
- Saved insurance rules still store odds, which are ignored when the rule is picked. Dropping them is left for a later migration.
