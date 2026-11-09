# Test plans

Manual test plans handed to testers before a release. Unit tests cover the money rules in `packages/core`.
These plans cover what only a person on a real phone can check: flows, layout, timing and data across devices.

| Plan | Covers | Build |
| --- | --- | --- |
| [Table fee, wages and settlement UI](table-fee-and-wages.md) | PRs #68, #70, #71, #72 | `main` `eeaf651` |

## Writing a plan

One file per release or feature, named after the feature. Each plan has these sections:

1. **Release notes**: what changed, by pull request.
2. **Rules**: numbered rules (R1, R2, …) that decide whether a result is right. Bug reports cite them.
3. **Environment and data**: where to test, which devices, and any sample backups with worked results.
4. **Test cases**: grouped by area, each with an ID (A-01, B-02, …), a priority, preconditions, steps and expected results.
5. **Bug reports**: the fields to fill in and the severity of each level.
6. **Exit criteria**: what must pass before the release counts as tested.
7. **Known limitations**: behavior that is not a bug.

Keep case IDs stable once a plan is handed over, so results and bug reports still point at the right case.
Interface text is quoted in Chinese, exactly as the app shows it, so testers can match it on screen.

## Priorities

| Priority | Meaning |
| --- | --- |
| P0 | Must pass before release |
| P1 | Important, should pass |
| P2 | Test when time allows |

## Severity

| Severity | Meaning |
| --- | --- |
| S1 Critical | Wrong amounts, lost data, or a game cannot be settled or a backup restored |
| S2 Major | A feature does not work, but there is a way around it |
| S3 Minor | Wrong display or wording, or state out of step |
| S4 Trivial | Styling, alignment or animation |

## Where to test

Test on a pull request preview link, not the live site. The app cannot delete games or players, so test data and
restored samples stay mixed with real games on the live site. Each preview link is its own site with its own local data.
Sample backups with hand-worked results are in [`apps/web/sample-backups`](../../apps/web/sample-backups/README.md).
