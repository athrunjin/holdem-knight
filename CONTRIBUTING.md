# Contributing

## Branches

- `main` is always releasable. It only changes through pull requests, and CI must pass.
- Feature branches start from `main` and are named `<type>/<short-description>`, for example `feat/buy-in-ledger` or `fix/settlement-rounding`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/):

```
<type>(<scope>): <description>
```

| Type       | Purpose                       |
| ---------- | ----------------------------- |
| `feat`     | New feature                   |
| `fix`      | Bug fix                       |
| `refactor` | Refactor (no behavior change) |
| `test`     | Tests                         |
| `docs`     | Documentation                 |
| `chore`    | Build, dependencies, config   |
| `ci`       | Continuous integration        |

The scope is a package or feature name: `core`, `web`, `settlement`, `insurance` and so on.

Example: `feat(core): compute minimal settlement transfers`

## Language

Everything in the repository and on GitHub is written in English: commit messages, branch names,
pull requests, issues, comments, documentation, code comments and test names.

Two things stay in Simplified Chinese: the app's interface text, and sample data in tests that
exercise Chinese names.

## Code

- TypeScript strict mode, no `any`.
- Money always uses `Cents` (integer cents) from `@holdem-knight/core`, never floating-point arithmetic. See [ADR 0004](docs/adr/0004-money-as-integer-cents.md).
- Business rules go in `packages/core`. UI components only handle display and interaction.
- Calculations in `core` must have unit tests. Anything that conserves money also gets a fast-check property test.
- Run `pnpm check` before committing. `pnpm format` fixes formatting.

## Interface changes

How the app looks and moves is written in the [visual guide](docs/design/README.md). A change to what the app shows:

1. is built from the guide's tokens and components, and says in its plan what is new;
2. passes `pnpm check`;
3. goes through the [visual review](docs/design/review.md) in the preview: 360, 393 and 412px wide, dark, in Chinese and in English, through its states and animations;
4. has its blockers fixed, and lists in the pull request what was reviewed, what was measured, what is left open and what was not looked at;
5. is read by the organizer on a phone from the preview build;
6. adds to the guide any decision from that reading the guide did not have.

A change with nothing to see skips the review and says so ([ADR 0050](docs/adr/0050-a-visual-guide-and-a-visual-review.md)).

## Architecture decisions

When a choice affects the long-term structure (a new dependency, a data model change, a layering change),
add a decision record to `docs/adr/`. Number it next in sequence and follow the format of the existing files.
