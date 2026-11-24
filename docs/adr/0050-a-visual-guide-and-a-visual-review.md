# 0050. A visual guide, and a visual review before hand-over

- Status: Accepted
- Date: 2026-11-24

## Context

How the app looks was decided page by page, in conversation with the organizer on preview builds: dark only, menus in the page, marks for currencies, how figures line up, how a page plays in. The decisions were followed, but they were written nowhere in the repository except as tokens in the stylesheet and a few lines of the brand guide. Each new page meant recalling them, and the same corrections came back: a size, a color, a control built a second time.

The steps before a pull request check that a change is correct (`pnpm check`). None checks that it looks and moves like the rest of the app. That was found by the organizer on a phone, after the work was thought done.

## Options considered

- Keep going by memory and the organizer's corrections: no new documents, and the same rounds again on every page.
- A visual regression tool comparing screenshots in CI: catches unintended changes, but says nothing about a new page, and needs stored images kept in step for every width and language.
- **Write the guide down, and review each interface change against it before it is handed over.**

## Decision

- `docs/design/README.md` is the visual guide: principles, color, type, space and shape, components, motion, the order of a page, words, what not to do, and the gaps known today. Values stay in the stylesheet's tokens, which the guide explains and does not repeat as a second source.
- `docs/design/review.md` is the visual review: a checklist from the guide, run in the preview at 360, 393 and 412px, in both languages, through each state and animation, with findings graded as blocker, should fix or note.
- The review is a step of every pull request that changes what the app shows, after `pnpm check` and before the organizer reads the preview. Blockers are fixed first. The pull request says what was reviewed, what was measured and what was not looked at.
- A decision the organizer makes at acceptance that the guide does not have is added to the guide in the same pull request, with its date.

## Consequences

- A new page starts from written rules, and a correction is made once.
- Each interface pull request takes longer by the length of the review, and its description is longer.
- The guide can fall behind the app. The stylesheet wins where they differ, and the pull request that finds the difference fixes the guide.
- The review is done by the author. It does not replace the organizer's reading on a real phone, which stays the acceptance.
- Screenshot comparison in CI is left for later, once pages stop changing shape from week to week.
