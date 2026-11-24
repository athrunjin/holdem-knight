# 0049. A settled game keeps a summary of its results

- Status: Accepted
- Date: 2026-11-23

## Context

A game's results were worked out on its settlement page each time it opened: the chips in cash, the difference handled, insurance and rake with whoever takes them, the charges, the transfers. The steps were written in the page itself, and nothing of them was kept, since the ledger can always give them again (`settleGame`).

The host's pages need the same figures across every game: what the games brought in by kind, what is still to come in, and later the transfers and each player's history. Working them out there means reading every game's ledger on each visit, one request a game for an account, and a second copy of the steps that could drift from the settlement page.

[ADR 0042](0042-linked-players-and-claiming-records.md) already has the host's app write copies of a game's results when it is settled, for linked players to read. Those are not built yet.

## Options considered

- Work everything out on the report page from the ledgers: nothing new to keep, but slow for an account and worse with every game, and the page would need the ledger of games it only lists.
- Work it out in the database with SQL: the settlement rules would be written twice, in two languages, and a guest's books have no database.
- **Keep a summary with each settled game, worked out by the same function the settlement page shows.**

## Decision

- `settleBooks(game, events, clock)` in `core` settles a game. The settlement page shows what it returns and works nothing out itself.
- `gameSummary` turns that into a `GameSummary`, kept under the game's ID: when and what the game was, the organizer's income by kind (rake, insurance, wages, table fee), the difference and how much of it the organizer took on, each player's result, and the transfers of the plan with the ones marked as made.
- What counts as income, in the organizer's terms of 2026-11-20: as due at settlement; insurance only where its result is the organizer's, and it can be a loss; rake and insurance after their share of a split; a difference the organizer takes on is its own figure and no part of the income; an organizer's own play is their row among the players, apart from both.
- The summary is written with the game from the settlement page: when the settlement is confirmed, when a transfer is marked or the plan changes after that. Opening the results again removes it.
- A summary carries a basis: the time the game was settled, its transfer plan and the transfers marked, with a version of the summary's own shape. Reports read the games and the summaries, and make again any summary that is missing or whose basis is not its game's: a game settled before summaries were kept, one brought in from a backup, one whose summary could not be written. So a summary that fails to save is put right the next time a report is read, and the save of the game never waits on it or fails with it.
- A game belongs to the day it started in its own time zone ([ADR 0027](0027-wage-units-rounding-and-game-time-zone.md)), kept on the summary as `2026-11-21`, so a game that runs past midnight stays on its evening and every device agrees on the month.
- Income not received is not a transfer: transfers carry wins, losses and charges in one amount. A game's income still to come in is what is owed to the organizer in transfers not marked as made, up to the income there is.
- Summaries are a list of their own in the repository interface and its contract ([ADR 0045](0045-one-contract-for-both-repositories.md)). A backup leaves them out. In an account they are rows of `game_summaries`, documents like the rest ([ADR 0044](0044-books-in-postgres-as-documents.md)), kept and read by the owner only and gone with their game.
- Amounts in different currencies are never added together: a report is of one currency.

## Consequences

- A change to how a summary is worked out raises `SUMMARY_VERSION`, and every summary is made again the next time a report is read.
- The first visit to a report after games were settled elsewhere, or after a restore, reads those games' ledgers once.
- A settled game saved by anything other than its settlement page would leave its summary behind until a report is read. Nothing else saves a settled game today.
- The copies for linked players of ADR 0042 are still to build. Each player's row is already in the summary to make them from; they will be rows of their own that a player may read, not this table.
- The settlement page and the reports cannot differ in what a game came to, as there is one function. A property test holds what the organizer ends with to their own play, the income and the difference taken on.
