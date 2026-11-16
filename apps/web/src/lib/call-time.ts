import {
  adjustCallTime,
  CALL_TIME_WARNING,
  type CallTime,
  callTimeFraction,
  callTimePhase,
  callTimeRemaining,
  callTimeRemainingMs,
  DEFAULT_CALL_TIME,
  parseCallTime,
  setCallTime,
  startCallTime,
  stopCallTime,
} from "@holdem-knight/core";
import { useEffect, useState, useSyncExternalStore } from "react";

/*
 * The one Call Time countdown of this browser. It lives outside the pages, so it keeps counting
 * while the organizer is on another page, and is kept in storage, so a reload does not lose it.
 */

const STORAGE_KEY = "call-time";

function parse(stored: unknown): CallTime | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { seconds, run } = stored as Partial<CallTime>;
  if (typeof seconds !== "number" || parseCallTime(String(seconds)) === undefined) return undefined;
  if (run === undefined) return { seconds };
  if (typeof run.endsAt !== "number" || typeof run.total !== "number" || run.total <= 0) {
    return undefined;
  }
  return { seconds, run: { endsAt: run.endsAt, total: run.total } };
}

function load(): CallTime {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return (text === null ? undefined : parse(JSON.parse(text))) ?? DEFAULT_CALL_TIME;
  } catch {
    // Storage that is switched off or holds something unreadable counts as nothing kept
    return DEFAULT_CALL_TIME;
  }
}

let state = load();
const listeners = new Set<() => void>();

function update(next: CallTime) {
  if (next === state) return;
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Without storage the countdown still holds until the page is left
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const callTimeActions = {
  setLength: (seconds: number) => update(setCallTime(state, seconds)),
  adjust: (delta: number) => update(adjustCallTime(state, delta, Date.now())),
  start: () => update(startCallTime(state, Date.now())),
  /** Clears the countdown, whether under way or run out. */
  stop: () => update(state.run ? stopCallTime(state) : state),
};

/** How often the display catches up with the clock. The time itself comes from timestamps. */
const TICK_MS = 200;

/**
 * The countdown as it stands now. The display ticks only while it is under way, and on every
 * frame through the last seconds, which show hundredths of a second.
 */
export function useCallTime() {
  const callTime = useSyncExternalStore(subscribe, () => state);
  const [, setTick] = useState(0);
  // Read on every render, so a tap between two ticks shows against the time it was made at
  const now = Date.now();
  const phase = callTimePhase(callTime, now);
  const endsAt = callTime.run?.endsAt;
  const everyFrame = phase === "warning";

  useEffect(() => {
    if (endsAt === undefined) return;
    const tick = () => setTick((count) => count + 1);

    if (everyFrame) {
      let frame = requestAnimationFrame(function next() {
        tick();
        if (Date.now() < endsAt) frame = requestAnimationFrame(next);
      });
      return () => cancelAnimationFrame(frame);
    }

    const interval = window.setInterval(() => {
      tick();
      // Nothing changes on the display once it has run out
      if (Date.now() >= endsAt) window.clearInterval(interval);
    }, TICK_MS);
    // The last seconds begin on time, not at the next tick
    const untilWarning = endsAt - CALL_TIME_WARNING * 1000 - Date.now();
    const timeout = untilWarning > 0 ? window.setTimeout(tick, untilWarning) : undefined;
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [endsAt, everyFrame]);

  const remainingMs = callTimeRemainingMs(callTime, now);
  return {
    callTime,
    phase,
    /** Whole seconds to show: the set length before a start, then the time left */
    seconds: callTime.run ? callTimeRemaining(callTime, now) : callTime.seconds,
    /** Through the last seconds, the time left as whole seconds and the hundredths after them */
    lastSeconds:
      phase === "warning"
        ? {
            whole: Math.floor(remainingMs / 1000),
            hundredths: String(Math.floor((remainingMs % 1000) / 10)).padStart(2, "0"),
          }
        : undefined,
    fraction: callTimeFraction(callTime, now),
    now,
  };
}
