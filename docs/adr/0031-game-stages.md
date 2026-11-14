# 0031. The stages of a game: open, settling, pending and complete

- Status: Accepted
- Date: 2026-11-14

## Context

A game had two statuses, `open` and `settled`. The settlement page worked on an open game until 确认结算, so nothing told a game whose results were being checked from one still being played. With transfers that can be ticked off ([ADR 0030](0030-transfers-marked-as-made.md)), the organizer also wants history to show which games still have money owed and which are done.

The organizer names four stages: 进行中, 结算中, 积分待处理 and 已完成.

## Options considered

For 结算中:

- Work it out from the ledger, as an open game with nobody seated: no new status, but the games list would have to load every ledger, and a table that everyone left one by one would read as being settled when nobody asked for that.
- **A third status, `settling`.**

For 积分待处理 and 已完成:

- Two more statuses: they would have to be kept in step with the marks anyway, and every place that reads the status would have to learn them for something that changes nothing about the results.
- Work the stage out on the games list from each game's ledger and marks: nothing saved, but the list would settle every game again to know one word.
- An archive step taken by hand, with a button that files the game as complete or pending: built first and dropped. A settled game is pending from the moment it is settled, so the step only repeated what the ticks already said.
- **A field beside the status that says whether every transfer is in, saved by the settlement page.**

## Decision

- `GameStatus` gains `settling`. The settle step on the game page sets it (`startSettling`), in the same step that seats everyone out and stops the clock. `settleGame` confirms the results as before.
- `reviseGame` replaces `reopenGame`: a settled game goes back to `settling`, not to `open`, and loses its settlement time and the marks on its transfers. With marks present the page asks first.
- A game that is being settled goes back to `open` when the organizer comes back to the game page (`resumeGame`). The page does this on arrival, so 返回牌桌 and the browser's back button do the same.
- While a game is being settled its results can change: how a difference is handled, the charges let off, the plan. Its transfers cannot be ticked. A tap on a tick points at 确认结算.
- Once a game is settled its results are locked. A tap on one of them points at 修改对局结果.
- `Game` gains an optional `allReceived`, set to `true` while a settled game has every transfer of its plan marked as made. `markReceived` sets or clears it. The settlement page calls it wherever the answer can change, as the only place that knows the plan's transfers: on 确认结算, when a transfer is ticked or cleared, and when the plan changes.
- A game with nothing to transfer is complete as soon as it is settled.
- `gameStage` names the stage: `open`, `settling`, then `pending` for a settled game and `complete` once it has `allReceived`. The games list shows open and settling games under 进行中, the latter labeled 结算中 and opening on their settlement page, and history in two parts, 积分待处理 and 完成.
- `settling` and `allReceived` join backup version 12.

## Consequences

- Every place that reads the status had to pick a side for `settling`. Pages treat anything not settled as open to change.
- A game moves between 积分待处理 and 完成 by its ticks alone, in both directions.
- `allReceived` is only as current as the last save from the settlement page. Nothing else changes a settled game's transfers, so it cannot fall behind there.
- A game left on its settlement page stays `settling` until someone comes back to it. Games from before this that were left at that point are `open`, and become `settling` at their next settle step.
- A game settled before this that has nothing to transfer stays under 积分待处理 until its results are confirmed again: nothing on its page is left to tick.
- The game page saves the game when it finds it `settling`. It skips this while its own settle step is saving and leaving, or the step would be undone as soon as it was made.
