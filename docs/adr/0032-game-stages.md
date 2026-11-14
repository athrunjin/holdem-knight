# 0032. The stages of a game, with settling between open and settled

- Status: Superseded in part by [0033](0033-complete-when-all-received.md): a game is complete by its ticks, with no archiving
- Date: 2026-11-14

## Context

A game had two statuses, `open` and `settled`. The settlement page worked on an open game until 确认结算, so nothing told a game whose results were being checked from one still being played. Transfers could be ticked before the results were confirmed ([ADR 0030](0030-transfers-marked-as-made.md)), while their amounts could still change, and archiving an open game settled it on the way ([ADR 0031](0031-archiving-a-game.md)). History also had a part for settled games not yet archived, which is not a stage the organizer thinks in.

The organizer names four stages: 进行中, 结算中, 积分待处理 and 已完成.

## Options considered

- Work 结算中 out from the ledger, as an open game with nobody seated: no new status, but the games list would have to load every ledger, and a table that everyone left one by one would read as being settled when nobody asked for that.
- Four statuses, with 积分待处理 and 已完成 saved as statuses: the last two would repeat what `archive` already says.
- **A third status, `settling`, with the last two stages read from the status and the archive together.**

## Decision

- `GameStatus` gains `settling`. The settle step on the game page sets it (`startSettling`), in the same step that seats everyone out and stops the clock. `settleGame` confirms the results as before.
- `reviseGame` replaces `reopenGame`: a settled game goes back to `settling`, not to `open`, and loses its settlement time, its place in the archive and the marks on its transfers. With marks present the page asks first.
- A game that is being settled goes back to `open` when the organizer comes back to the game page (`resumeGame`). The page does this on arrival, so 返回牌桌 and the browser's back button do the same.
- While a game is being settled its results can change: how a difference is handled, the charges let off, the plan. Its transfers cannot be ticked and it cannot be archived. A tap on either points at 确认结算. This replaces the rule in ADR 0030 that marks can be set at any time, and the rule in ADR 0031 that archiving settles an open game.
- Once a game is settled its results are locked. A tap on one of them points at 修改对局结果.
- `gameStage` names the stage: `open`, `settling`, then `pending` for a settled game, which becomes `complete` when it is archived with every transfer made. The games list shows open and settling games under 进行中, the latter labeled 结算中 and opening on their settlement page, and history in two parts, 积分待处理 and 完成. The part for games not archived is gone.
- `settling` joins backup version 12, which has not been released without it.

## Consequences

- Every place that reads the status had to pick a side for `settling`. Pages treat anything not settled as open to change.
- A game archived as pending is listed where it already was. What archiving adds is that it moves to 完成 by itself when its last transfer is ticked, where a game not archived waits for 归档牌局.
- A game left on its settlement page stays `settling` until someone comes back to it. Games from before this that were left at that point are `open`, and become `settling` at their next settle step.
- The game page saves the game when it finds it `settling`. It skips this while its own settle step is saving and leaving, or the step would be undone as soon as it was made.
