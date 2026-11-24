# Visual review

Every pull request that changes what the app shows is reviewed against the [visual guide](README.md) before it is handed to the organizer. It is a design QA step in the sense the industry uses the term: the built interface is compared with the design system on real sizes, findings are graded, and blockers are fixed before review by a person.

It sits beside `pnpm check`, which cannot see a page. `pnpm check` says the change is correct; the visual review says it looks and moves like the rest of the app.

## Where it sits

| Step | What happens | Who |
| --- | --- | --- |
| 1. Plan | A change that adds a page or a component says in its plan which existing components it uses and what is new, with a sketch in the app's dark colors for anything new | Author |
| 2. Build | Built from the tokens and components of the guide | Author |
| 3. `pnpm check` | Lint, types, tests, build | Author, then CI |
| 4. **Visual review** | The checklist below, in the preview, with the evidence it asks for. Blockers are fixed and checked again | Author |
| 5. Hand-over | The pull request says what was reviewed and what was not, and lists any finding left open | Author |
| 6. Acceptance | The organizer reads the preview build on a phone | Organizer |
| 7. Feed back | A decision from acceptance that is not in the guide yet is added to it in the same pull request | Author |

A change with nothing to see (rules in `core`, the database, tooling, documents) skips steps 4 to 7 and says so.

## How to review

Open the changed pages in the preview with data that fills them: long names, six-digit amounts, a negative figure, an empty state. Dark mode, in Chinese first.

1. **Widths:** 360, 393 and 412px. At 360 nothing may overlap or be cut off; 393 to 412 is where it must look right.
2. **Both languages:** every changed page once in English at 393px.
3. **States:** empty, loading, error, one item, many items; each control on, off and disabled.
4. **Motion:** each new or changed animation played from start to end, then with reduced motion turned on.
5. **Return:** leave the page for a game and come back.

Measure where the eye cannot be trusted: row heights, touch targets and alignment are read from the page, not judged from a screenshot.

## Checklist

**Color**
- [ ] Only tokens and the documented chart colors; no new hex value
- [ ] Gold only for attention, action or insurance; green for gain, red for loss, each with its sign
- [ ] No meaning carried by color alone

**Type**
- [ ] Sizes and weights from the guide's table; figures tabular
- [ ] Labels gray and small, figures white and larger; one headline figure a page
- [ ] Money in the game's format with its mark, no needless cents

**Space and shape**
- [ ] Radius by role: card, row, pill, dot
- [ ] Borders set surfaces off; shadows only on what floats
- [ ] Every touch target at least 44px, none overlapping
- [ ] Holds at 360px; right at 393 to 412px; long names and six-digit amounts wrap as the guide says

**Components and layout**
- [ ] Existing components used; anything new is justified in the pull request and added to the guide
- [ ] Choices open in place; dialogs only for typing or long lists
- [ ] Fixed orders kept: charges, currencies, periods
- [ ] The page's order follows the guide: headline, breakdown, charts, lists
- [ ] What the organizer chose is kept between visits

**Motion**
- [ ] Durations and easings from the guide's table; direction shows origin; closing mirrors opening
- [ ] Nothing loops, and nothing blocks a tap while it plays
- [ ] Plays once on arrival, not again on return from a game
- [ ] Reduced motion gives the final state at once

**Words**
- [ ] Text in the catalogs, Chinese and English together; 设置, never 配置
- [ ] English fits the layout by shortening the word, not by changing the layout

**Rules**
- [ ] No figure changed by a display change; anything that looked wrong was first worked out again in `core`

## Findings

Each finding is graded, and the pull request lists the ones left open.

| Grade | Meaning | Before hand-over |
| --- | --- | --- |
| Blocker | Breaks the guide where the organizer will see it: overlap or cut-off text at 393 to 412px, a target under 44px, an unreadable color, a wrong figure, motion that traps | Fixed |
| Should fix | Off the guide but usable: a size outside the scale, a hex value, a problem only at 360px or only in English | Fixed, or listed with a reason |
| Note | A question of taste, or a gap in the guide itself | Listed for the organizer to decide |

## What the pull request says

Under "How it was verified":

- the widths and languages looked at;
- what was measured;
- the open findings, by grade;
- what was not reviewed, plainly. A real phone, account mode and anything the preview cannot show are named rather than assumed.

## Sources

The step follows common practice rather than inventing one: design tokens as the single source of values (W3C Design Tokens), contrast and target size from WCAG 2.2 level AA, touch targets of 44pt from Apple's Human Interface Guidelines, duration and easing ranges in line with Material Design's motion guidance, and a design QA pass with graded findings before acceptance, as teams that keep a design system commonly run.
