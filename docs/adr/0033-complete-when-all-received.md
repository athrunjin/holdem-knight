# 0033. A settled game is complete when every transfer is in, with no archiving

- Status: Accepted
- Date: 2026-11-14

## Context

[ADR 0031](0031-archiving-a-game.md) had the organizer archive a game into one of two parts of history, and [ADR 0032](0032-game-stages.md) then made every settled game pending from the moment it is settled. That left archiving with little to do: a game archived while money was owed stayed where it already was, and a game with everything ticked still waited for a tap on 归档牌局 to count as complete. Tried on a phone, the step was one too many.

## Options considered

- Keep the button for the last step only, from pending to complete: one tap that tells the app what the ticks already say.
- Work the stage out on the games list from each game's ledger and marks: nothing saved, but the list would settle every game again to know one word, which ADR 0031 already turned down.
- **Drop archiving, and save on the game whether every transfer is in, kept in step by the settlement page.**

## Decision

- `archive`, `archiveGame`, `unarchiveGame` and `refileGame` are gone. `Game` gains an optional `allReceived`, set to `true` while a settled game has every transfer of its plan marked as made.
- `markReceived` sets or clears it. The settlement page calls it at each point where the answer can change: on 确认结算, when a transfer is ticked or cleared, and when the plan changes. `reviseGame` clears it with the marks.
- A game with nothing to transfer is complete as soon as it is settled.
- `gameStage` reads it: a settled game is `complete` with `allReceived` and `pending` without.
- Where 归档牌局 was, the settlement page has a small link, 返回主界面, to the games list.
- The field joins backup version 12 in place of `archive`, which was never released.

## Consequences

- A game moves between 积分待处理 and 完成 by its ticks alone, in both directions.
- `allReceived` is only as current as the last save from the settlement page. Nothing else changes a settled game's transfers, so it cannot fall behind there.
- A game settled before this that has nothing to transfer stays under 积分待处理 until its results are confirmed again: nothing on its page is left to tick.
