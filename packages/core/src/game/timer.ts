import type { GameTimer, TimerRun, Timestamp } from "../domain";

/** Time on the clock. Computed from timestamps, so it survives a suspended page (ADR 0001). */
export function timerElapsedMs(timer: GameTimer, now: Timestamp): number {
  if (timer.runningSince === undefined) return timer.elapsedMs;
  return timer.elapsedMs + Math.max(0, now - timer.runningSince);
}

/** Pausing records the run that ends, unless the clock's earlier runs are unknown. */
export function pauseTimer(timer: GameTimer, now: Timestamp): GameTimer {
  const { runningSince, runs } = timer;
  if (runningSince === undefined) return timer;
  const elapsedMs = timerElapsedMs(timer, now);
  if (!runs) return { elapsedMs };
  return { elapsedMs, runs: [...runs, { from: runningSince, to: Math.max(runningSince, now) }] };
}

/** Starts a timer that has never run, pauses a running one and resumes a paused one. */
export function toggleTimer(timer: GameTimer | undefined, now: Timestamp): GameTimer {
  if (timer === undefined) return { elapsedMs: 0, runningSince: now, runs: [] };
  if (timer.runningSince !== undefined) return pauseTimer(timer, now);
  return { ...timer, runningSince: now };
}

/**
 * Every run of the clock, with a run still going ending at `now`. A clock that never started has
 * none. Returns undefined for a clock started before runs were kept.
 */
export function timerRuns(timer: GameTimer | undefined, now: Timestamp): TimerRun[] | undefined {
  if (!timer) return [];
  if (!timer.runs) return undefined;
  const { runningSince } = timer;
  const current =
    runningSince === undefined ? [] : [{ from: runningSince, to: Math.max(runningSince, now) }];
  return [...timer.runs, ...current];
}
