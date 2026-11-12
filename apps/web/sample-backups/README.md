# Sample backups

Backup files with made-up games, for trying the app on a phone: restore one, open the game, and compare the
settlement page with [EXPECTED.md](EXPECTED.md). Each result there was worked out by hand and is checked against
`@holdem-knight/core` by the unit tests, so a difference on the phone points at the app, not at the sample.

| File | Date | What it covers |
| --- | --- | --- |
| `01-balanced.json` | 2026-01-01 | A balanced game, the best transfer plan |
| `02-collector-and-undo.json` | 2026-01-02 | A player collecting, an undone rebuy, a return to the table (返回) |
| `03-imbalance-split.json` | 2026-01-03 | Too many chips split among the winners, a ratio that does not divide evenly |
| `04-imbalance-organizer-aud.json` | 2026-01-04 | Missing chips kept by the organizer, Australian dollars |
| `05-insurance.json` | 2026-01-05 | Insurance with a hit and a miss, its result taken by a player |
| `06-table-fee-and-wages.json` | 2026-01-06 | Table fee with a minimum time, wages that change after 3 hours |
| `07-open-game.json` | 2026-01-07 | A game still open, for trying 一键离桌并结算 |
| `08-wage-units-across-midnight.json` | 2026-01-08 | Wages by 30 minutes rounded up, a rate from midnight, units across two rates |
| `all.json` | | Everything above in one file |

The app has no game names, so the samples are told apart by date: every one is in January 2026, starting at 19:00
Beijing time. The same six players (张伟, 王芳, 李娜, 刘洋, 陈静, 赵磊) sit in all of them. All IDs start with `sample-`.

## Restoring on a phone

Use a **pull request preview link**, not the live site. The app cannot delete games or players, so samples restored
into the live site stay mixed with real games, and a sample player can take a real player's name. Each preview link is
its own site with its own local data.

1. On the phone, open this folder on GitHub, open the file, and tap **Download raw file**. Save it to Files.
2. Open the preview link, go to 我的 → 数据备份 → 恢复备份, and pick the file.
3. The message says how many records were added. Open the game by its date and go to 结算.

Restoring only adds records (ADR 0009): restoring the same file again skips everything. Once 07-open-game has been
settled it stays settled on that site; to try it again, use another preview link or clear the site's data.

## Changing a sample

The samples and their expected results live in `apps/web/src/data/sample-backups/scenarios.ts`. Work out the new
results by hand and write them into `expected`; never copy them from a failing test. Then regenerate the files here:

```bash
pnpm --filter @holdem-knight/web exec vitest run src/data/sample-backups -u
```

The test fails when a result differs from `expected`, or when a file here no longer matches what `scenarios.ts`
generates. Don't edit the JSON files or `EXPECTED.md` by hand.
