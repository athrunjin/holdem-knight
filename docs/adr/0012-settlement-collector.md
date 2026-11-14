# 0012. Save the settlement collector on the game

- Status: Superseded in part by 0029
- Date: 2026-11-04

## Context

Games often settle through one person who collects from losers and pays winners. That person can be a player or an organizer who isn't playing.
Transfers aren't saved because the ledger can always reproduce them, but the choice of plan can't be reproduced.

## Options considered

- Keep the choice in page state: simple, but it's lost on leaving the page and the shared image could disagree with what was agreed.
- Save the full transfer list: it would go stale when a reopened game changes.
- **Save only who collects**: transfers stay derived from the ledger, and the choice survives reopening.

## Decision

- `Game` gains an optional `collectorId`: a player ID or `ORGANIZER_COLLECTOR`. Missing means the optimal plan.
- `collectorTransfers` runs in `core`: every loser pays the collector, who pays every winner.
- If the collector is no longer in the game, the optimal plan is used.
- The choice can't change once settlement is confirmed. Reopen the game to change it.
- The backup format stays at version 2 because the field is optional.

## Consequences

- The organizer has no player record, so the interface shows a fixed label for them and nobody tracks what they hold.
- A collector plan usually has more transfers than the optimal plan, in exchange for everyone settling with one person.
