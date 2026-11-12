# Architecture decision records (ADRs)

Records decisions that affect the project's long-term structure: the context at the time, the options considered, the final choice and its costs.
Once recorded, a decision isn't edited. If it changes later, write a new record and mark the old one "Superseded by XXXX".

| Number                                  | Title                                                                                   | Status   |
| --------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| [0001](0001-pwa-first.md)               | App form: PWA first, packaged with Capacitor later                                      | Accepted |
| [0002](0002-frontend-stack.md)          | Front-end stack: React + Vite + TanStack Router + Tailwind                              | Accepted |
| [0003](0003-backend-supabase.md)        | Back end: Supabase, designed for multi-region deployment                                | Accepted |
| [0004](0004-money-as-integer-cents.md)  | All money is integer cents                                                              | Accepted |
| [0005](0005-guest-and-account-modes.md) | Guest and account modes, with storage behind a repository interface                     | Accepted |
| [0006](0006-monorepo-and-tooling.md)    | pnpm monorepo and engineering tools                                                     | Accepted |
| [0007](0007-domain-model-and-repository.md) | Domain model and repository interface in core, Dexie implementation in apps/web     | Accepted |
| [0008](0008-pinyin-initials.md)         | Generate pinyin initials in the app layer with pinyin-pro                               | Accepted |
| [0009](0009-backup-format.md)           | Versioned JSON backups, and restore only adds records                                   | Accepted |
| [0010](0010-buy-in-hands.md)            | Buying in by hands: games fix chips per hand, and the ledger keeps recording chips      | Accepted |
| [0011](0011-chip-blinds-and-live-stacks.md) | Blinds in chips, and live stacks as ledger events | Accepted |
| [0012](0012-settlement-collector.md) | Save the settlement collector on the game | Accepted |
| [0013](0013-unbalanced-settlement.md) | Allow settling unbalanced books | Accepted |
| [0014](0014-insurance-seat.md) | Insurance as a seat in the game | Superseded in part by 0015 |
| [0015](0015-insurance-moves-only-the-seat.md) | Insurance moves only the seat, once its card is dealt | Superseded in part by 0017 |
| [0016](0016-insurance-hands.md) | An insurance hand as a draft, written to the ledger when finished | Accepted |
| [0017](0017-finished-hand-sets-stacks.md) | A finished hand sets the stacks it knows | Superseded in part by 0018 |
| [0018](0018-short-premium-buy-in.md) | A premium a player cannot pay buys whole hands, once confirmed | Accepted |
| [0019](0019-entered-stack-updates-table.md) | An all-in player's entered chips update the table at once | Accepted |
| [0020](0020-holdem-knight-naming.md)        | The product is named Hold’em Knight                       | Accepted |
| [0021](0021-brand-identity.md)              | Visual identity: the K◇K diamond knight helmet            | Accepted |
| [0022](0022-table-fee-and-wages.md)         | Table fees and wages as cash charges at settlement        | Superseded in part by 0023 and 0025 |
| [0023](0023-seat-time-follows-game-clock.md) | Time at the table counts only while the game clock runs | Accepted |
| [0024](0024-itemized-charges-and-waivers.md) | Itemized wages by rate, and waiving a charge at settlement | Superseded in part by 0025 |
| [0025](0025-wage-segments-and-billing-units.md) | Wage segments, billing units and rounding up | Superseded in part by 0027 |
| [0026](0026-insurance-cover-limits-and-odds-tables.md) | Insurance cover limits, and odds tables kept apart from the rule's settings | Accepted |
| [0027](0027-wage-units-rounding-and-game-time-zone.md) | Wage units at the longer rate, rounding modes, and the game's time zone | Accepted |

## Template

```markdown
# NNNN. Title

- Status: Proposed / Accepted / Superseded by NNNN
- Date: YYYY-MM-DD

## Context

## Options considered

## Decision

## Consequences
```
