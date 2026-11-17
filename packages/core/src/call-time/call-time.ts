import type { Timestamp } from "../domain";

/** Lengths a countdown can be set to in one tap, in seconds. */
export const CALL_TIME_PRESETS = [30, 60, 90, 120] as const;

/** One tap of longer or shorter, in seconds. */
export const CALL_TIME_STEP = 10;

/** A length is a whole number of seconds from one second up to three digits. */
export const MIN_CALL_TIME = 1;
export const MAX_CALL_TIME = 999;

/** The last seconds of a countdown, when the display warns that time is nearly up. */
export const CALL_TIME_WARNING = 10;

/**
 * A countdown for a player who has been called on to act. It keeps the moment it ends, so the
 * time left is right after a suspended page (ADR 0001).
 */
export interface CallTime {
  /** Seconds a new countdown starts from */
  seconds: number;
  /** The countdown under way, or one that ran out and has not been cleared */
  run?: {
    endsAt: Timestamp;
    /** Seconds from the start to the end, with any added or taken off on the way */
    total: number;
  };
}

export type CallTimePhase = "idle" | "running" | "warning" | "done";

export const DEFAULT_CALL_TIME: CallTime = { seconds: 60 };

const isLength = (seconds: number) =>
  Number.isInteger(seconds) && seconds >= MIN_CALL_TIME && seconds <= MAX_CALL_TIME;

/**
 * A length as typed: digits only, read as a whole number of seconds. Returns undefined for
 * anything else, for zero, and for more than the longest countdown.
 */
export function parseCallTime(text: string): number | undefined {
  if (!/^\d+$/.test(text)) return undefined;
  const seconds = Number(text);
  return isLength(seconds) ? seconds : undefined;
}

/** Milliseconds left. Zero before a start and after the end. */
export function callTimeRemainingMs(callTime: CallTime, now: Timestamp): number {
  if (!callTime.run) return 0;
  return Math.max(0, callTime.run.endsAt - now);
}

/** Whole seconds left, counting a second that has begun. Zero before a start and after the end. */
export function callTimeRemaining(callTime: CallTime, now: Timestamp): number {
  return Math.ceil(callTimeRemainingMs(callTime, now) / 1000);
}

export function callTimePhase(callTime: CallTime, now: Timestamp): CallTimePhase {
  if (!callTime.run) return "idle";
  const remaining = callTimeRemaining(callTime, now);
  if (remaining === 0) return "done";
  return remaining <= CALL_TIME_WARNING ? "warning" : "running";
}

/** The part of the countdown still to run, from 1 at the start to 0 at the end. */
export function callTimeFraction(callTime: CallTime, now: Timestamp): number {
  if (!callTime.run) return 1;
  const { endsAt, total } = callTime.run;
  return Math.min(1, Math.max(0, (endsAt - now) / (total * 1000)));
}

/** Sets the length of the next countdown. One under way is left alone, and so is a length out of range. */
export function setCallTime(callTime: CallTime, seconds: number): CallTime {
  if (callTime.run || !isLength(seconds) || seconds === callTime.seconds) return callTime;
  return { seconds };
}

/**
 * Makes the countdown longer or shorter by `delta` seconds. Before a start that is the length to
 * count from, which a step never takes out of range. Under way it moves the end, and the length
 * a new countdown starts from stays. Nothing is taken off that would end the countdown, and
 * nothing changes once it has run out.
 */
export function adjustCallTime(callTime: CallTime, delta: number, now: Timestamp): CallTime {
  const { seconds, run } = callTime;
  if (!run) return isLength(seconds + delta) ? { seconds: seconds + delta } : callTime;
  const remaining = callTimeRemaining(callTime, now);
  if (remaining === 0 || remaining + delta <= 0 || remaining + delta > MAX_CALL_TIME) {
    return callTime;
  }
  return { seconds, run: { endsAt: run.endsAt + delta * 1000, total: run.total + delta } };
}

/** Whether `adjustCallTime` would change anything. */
export function canAdjustCallTime(callTime: CallTime, delta: number, now: Timestamp): boolean {
  return adjustCallTime(callTime, delta, now) !== callTime;
}

/** Starts counting down from the set length. A countdown under way or run out is replaced. */
export function startCallTime({ seconds }: CallTime, now: Timestamp): CallTime {
  return { seconds, run: { endsAt: now + seconds * 1000, total: seconds } };
}

/** Clears the countdown, whether under way or run out, and keeps the length for the next one. */
export function stopCallTime({ seconds }: CallTime): CallTime {
  return { seconds };
}
