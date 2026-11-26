---
description: Run the generator and evaluator review loop on a change to what the app shows, from an existing spec, with bounded iterations and a score.
---

Parse from $ARGUMENTS:

1. `brief`: one line naming the change, for the report
2. `--max-iterations N`: optional, default 3
3. `--pass-threshold N`: optional, default 8.0
4. `--eval-mode MODE`: optional, default `playwright`; also `screenshot`, `code-only`

## What this is for

The loop is for changes to what the app shows. It runs the visual review of `docs/design/review.md` as a second
agent that did not write the code. It is not for rules in `packages/core`, the database or tooling: those are
held by their tests and by review, and have nothing for the evaluator to look at.

There is no planner. `gan-harness/spec.md` is written beforehand from the plan the organizer agreed to: what to
build, the pages and states it touches, what counts as done. An optional `gan-harness/eval-rubric.md` adds
what "good" means for this change. If `spec.md` is missing, stop and say so; do not write one yourself.

## Phase 0: set up

1. Check that the branch is not `main`; stop if it is.
2. Create `gan-harness/feedback/`, `gan-harness/screenshots/` and `gan-harness/seed/` (the folder is ignored by git).
3. Start the dev server yourself, once, and keep it for the whole loop:
   `pnpm --filter web exec vite --port ${GAN_DEV_SERVER_PORT:-5174} --strictPort`, opened as
   `http://handflow.localhost:${GAN_DEV_SERVER_PORT:-5174}`. If the port is taken, another loop is running: stop.
4. Seed the data the spec's pages need, in the Playwright browser, on that origin only. Restore a backup where one fits
   (我的, then the restore from a file); the browser reads files under the worktree only, so copy the file to
   `gan-harness/seed/` first. Otherwise make the records through the app. The agents share this browser; keep it open.
5. Take a screenshot of each page of the spec at 393px before any code changes, as `gan-harness/screenshots/before-*.png`.
6. Note the start time and the settings. Note the time with `date` at the start and end of every phase from here on.

## Phase 1: the loop

```
iteration = 1
while iteration <= max_iterations:

    # Generate
    Launch the gan-generator agent:
    - reads spec.md, and feedback-{iteration-1}.md after the first iteration
    - builds or fixes, runs pnpm check, commits
    - writes generator-state.md

    If generator-state.md lists open questions, or pnpm check failed: stop the loop and report them.

    # Evaluate
    Launch the gan-evaluator agent with the eval mode and the pass threshold:
    - reviews the running app by docs/design/review.md
    - writes feedback/feedback-{iteration}.md

    Read the feedback: the total score, the open blockers, the mode achieved.

    if score >= pass_threshold and open blockers == 0:
        PASSED; break
    if iteration >= 3 and the score has not improved in the last 2 iterations:
        PLATEAU; break
    iteration += 1
```

One loop at a time on a machine: the dev server port and the local Supabase are shared.

After the last iteration, run `pnpm check` yourself and read the diff against `main`: the evaluator cannot run the
check, and the generator's word is not evidence. A failing check makes the result FAIL whatever the score.
Then stop the dev server you started.

## Phase 2: report

Write `gan-harness/build-report.md` and show it:

```markdown
## Review loop report

**Brief:** ...
**Result:** PASS / FAIL / PLATEAU / STOPPED (open questions)
**Iterations:** N / max
**Final score:** X.X / 10, open blockers: N
**Evaluation mode achieved:** ...
**`pnpm check` by this session:** passed / failed
**Commits:** ...

### Scores
| Iter | Design | Originality | Craft | Functionality | Total | Blockers |
| --- | --- | --- | --- | --- | --- | --- |

### Done when
- each line of the spec, PASS or FAIL

### Left open
- Should fix and Notes from the last evaluation, by grade

### There before this change
- defects the evaluator found that the change did not make, for changes of their own

### Not reviewed
- what the evaluator could not look at

### Time
| Phase | Start | End | Tool calls, tokens |
| --- | --- | --- | --- |
```

The report feeds "How it was verified" in the pull request: widths and languages looked at, what was measured,
open findings by grade, and what was not reviewed. A pass is not the organizer's acceptance; they still read
the preview on a phone.
