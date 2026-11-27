import { createContext, useContext, useEffect, useRef, useState } from "react";

/** Whether motion is turned down on the device: then everything is in its final state at once. */
export const still = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * True while a page that is being come back to arrives (`useQuietArrival`): what it shows first is
 * there at once, as it was left, and what shows after that moves.
 */
export const QuietMotion = createContext(false);

/**
 * Whether a page come back to is still arriving: true for its first paint and no longer. What is
 * on the page by then is there at once, as it was left; whatever shows after that, such as for
 * another period, plays in as usual.
 */
export function useQuietArrival(returning: boolean): boolean {
  const [quiet, setQuiet] = useState(returning);
  useEffect(() => {
    if (quiet) setQuiet(false);
  }, [quiet]);
  return quiet;
}

/**
 * Whether what shows under a key plays in. It is settled when the key is first seen, and holds
 * for as long as the key does: not while a page come back to is arriving, and not with motion
 * turned down on the device.
 */
export function usePlaysIn(key: string): boolean {
  const quiet = useContext(QuietMotion);
  const settled = useRef<{ key: string; plays: boolean }>(undefined);
  if (settled.current?.key !== key) settled.current = { key, plays: !(still() || quiet) };
  return settled.current.plays;
}

interface CountUp {
  /** How long the run to a new figure takes, in milliseconds */
  readonly duration?: number;
  /** How long a run from 0 waits first, so figures can come one after another */
  readonly delay?: number;
  /** A new key starts over from 0. The same key runs on from the figure shown. */
  readonly resetKey?: string;
}

/**
 * A figure that runs to its value instead of jumping there: from 0 when it first shows and when
 * `resetKey` changes, and from where it stands when only the value changes. It slows as it
 * arrives. With motion turned down on the device it is the value at once.
 */
export function useCountUp(
  target: number,
  { duration = 600, delay = 0, resetKey = "" }: CountUp = {},
): number {
  // A page come back to opens on the figure itself
  const quiet = useContext(QuietMotion);
  const [shown, setShown] = useState({ key: resetKey, value: quiet ? target : 0 });
  const value = useRef(quiet ? target : 0);
  // The key the figure last moved under. One it has not moved under yet starts from 0, also when
  // the effect is run again before its wait is over
  const moved = useRef<string | undefined>(quiet ? resetKey : undefined);

  useEffect(() => {
    const fresh = moved.current !== resetKey;
    if (still()) {
      value.current = target;
      moved.current = resetKey;
      setShown({ key: resetKey, value: target });
      return;
    }
    const from = fresh ? 0 : value.current;
    const wait = fresh ? delay : 0;
    let frame = 0;
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const part = Math.min(1, Math.max(0, (now - start - wait) / duration));
      if (part > 0) moved.current = resetKey;
      value.current = from + (target - from) * (1 - (1 - part) ** 3);
      setShown({ key: resetKey, value: value.current });
      if (part < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay, resetKey]);

  // The first frame under a new key is already 0, not the figure the last key ended on
  return shown.key === resetKey ? shown.value : 0;
}

/**
 * False on the first frame something shows under a key, and true from the one after it has been
 * painted: what a transition from nothing needs to start from.
 */
export function useEntered(key: string): boolean {
  const quiet = useContext(QuietMotion);
  const [entered, setEntered] = useState(quiet ? key : undefined);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(key));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [key]);
  return entered === key || still();
}
