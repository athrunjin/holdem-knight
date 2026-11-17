import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  adjustCallTime,
  CALL_TIME_STEP,
  type CallTime,
  callTimeFraction,
  callTimePhase,
  callTimeRemaining,
  callTimeRemainingMs,
  canAdjustCallTime,
  MAX_CALL_TIME,
  MIN_CALL_TIME,
  parseCallTime,
  setCallTime,
  startCallTime,
  stopCallTime,
} from "./call-time";

const START = 1_000_000;
const running = (seconds: number) => startCallTime({ seconds }, START);

describe("setting the length", () => {
  it("takes a preset and then steps of ten seconds", () => {
    let callTime = setCallTime({ seconds: 60 }, 90);
    callTime = adjustCallTime(callTime, CALL_TIME_STEP, START);
    expect(callTime).toEqual({ seconds: 100 });
    expect(adjustCallTime(callTime, -CALL_TIME_STEP, START)).toEqual({ seconds: 90 });
  });

  it("takes no step out of range", () => {
    expect(adjustCallTime({ seconds: 15 }, -CALL_TIME_STEP, START)).toEqual({ seconds: 5 });
    expect(canAdjustCallTime({ seconds: 10 }, -CALL_TIME_STEP, START)).toBe(false);
    expect(canAdjustCallTime({ seconds: 11 }, -CALL_TIME_STEP, START)).toBe(true);
    expect(canAdjustCallTime({ seconds: MIN_CALL_TIME }, CALL_TIME_STEP, START)).toBe(true);
    expect(canAdjustCallTime({ seconds: MAX_CALL_TIME - 9 }, CALL_TIME_STEP, START)).toBe(false);
    expect(canAdjustCallTime({ seconds: MAX_CALL_TIME - 10 }, CALL_TIME_STEP, START)).toBe(true);
  });

  it("takes a typed length that is a positive whole number", () => {
    expect(parseCallTime("45")).toBe(45);
    expect(parseCallTime("007")).toBe(7);
    expect(parseCallTime(String(MAX_CALL_TIME))).toBe(MAX_CALL_TIME);
    for (const text of ["", "0", "000", "-5", "1.5", "1e2", " 30", "30s", "1000"]) {
      expect(parseCallTime(text)).toBeUndefined();
    }
  });

  it("keeps the length it had when given one out of range", () => {
    const callTime: CallTime = { seconds: 60 };
    for (const seconds of [0, -30, 1.5, MAX_CALL_TIME + 1, Number.NaN]) {
      expect(setCallTime(callTime, seconds)).toBe(callTime);
    }
    expect(setCallTime(callTime, 7)).toEqual({ seconds: 7 });
  });

  it("leaves a countdown under way alone", () => {
    const callTime = running(60);
    expect(setCallTime(callTime, 30)).toBe(callTime);
  });
});

describe("counting down", () => {
  it("is idle before a start", () => {
    const callTime: CallTime = { seconds: 60 };
    expect(callTimePhase(callTime, START)).toBe("idle");
    expect(callTimeRemaining(callTime, START)).toBe(0);
    expect(callTimeFraction(callTime, START)).toBe(1);
  });

  it("counts a second that has begun", () => {
    const callTime = running(30);
    expect(callTimeRemaining(callTime, START)).toBe(30);
    expect(callTimeRemaining(callTime, START + 1)).toBe(30);
    expect(callTimeRemaining(callTime, START + 1_000)).toBe(29);
    expect(callTimeRemaining(callTime, START + 29_999)).toBe(1);
    expect(callTimeRemaining(callTime, START + 30_000)).toBe(0);
  });

  it("warns through the last ten seconds and is done at the end", () => {
    const callTime = running(30);
    expect(callTimePhase(callTime, START)).toBe("running");
    expect(callTimePhase(callTime, START + 19_999)).toBe("running");
    expect(callTimePhase(callTime, START + 20_000)).toBe("warning");
    expect(callTimePhase(callTime, START + 29_999)).toBe("warning");
    expect(callTimePhase(callTime, START + 30_000)).toBe("done");
    expect(callTimePhase(callTime, START + 500_000)).toBe("done");
  });

  it("gives the time left to the millisecond", () => {
    const callTime = running(30);
    expect(callTimeRemainingMs(callTime, START + 20_127)).toBe(9_873);
    expect(callTimeRemainingMs(callTime, START + 40_000)).toBe(0);
    expect(callTimeRemainingMs({ seconds: 30 }, START)).toBe(0);
  });

  it("is right after a suspended page, from the end it kept", () => {
    expect(callTimeRemaining(running(120), START + 95_000)).toBe(25);
  });

  it("gives the part still to run", () => {
    const callTime = running(60);
    expect(callTimeFraction(callTime, START)).toBe(1);
    expect(callTimeFraction(callTime, START + 15_000)).toBe(0.75);
    expect(callTimeFraction(callTime, START + 90_000)).toBe(0);
  });
});

describe("adjusting a countdown under way", () => {
  it("moves the end and keeps the length for the next one", () => {
    const longer = adjustCallTime(running(60), CALL_TIME_STEP, START + 5_000);
    expect(longer.seconds).toBe(60);
    expect(callTimeRemaining(longer, START + 5_000)).toBe(65);
    expect(longer.run?.total).toBe(70);
  });

  it("takes nothing off that would end it", () => {
    const callTime = running(30);
    expect(canAdjustCallTime(callTime, -CALL_TIME_STEP, START + 20_000)).toBe(false);
    expect(adjustCallTime(callTime, -CALL_TIME_STEP, START + 20_000)).toBe(callTime);
    expect(canAdjustCallTime(callTime, -CALL_TIME_STEP, START + 19_000)).toBe(true);
  });

  it("changes nothing once it has run out", () => {
    const callTime = running(30);
    expect(adjustCallTime(callTime, CALL_TIME_STEP, START + 30_000)).toBe(callTime);
  });
});

describe("starting and stopping", () => {
  it("starts again from the set length", () => {
    const again = startCallTime(running(90), START + 200_000);
    expect(callTimeRemaining(again, START + 200_000)).toBe(90);
  });

  it("clears the countdown and keeps the length", () => {
    expect(stopCallTime(running(90))).toEqual({ seconds: 90 });
  });
});

describe("properties", () => {
  const steps = fc.array(fc.constantFrom(CALL_TIME_STEP, -CALL_TIME_STEP), { maxLength: 80 });

  it("keeps the length within its limits whatever is tapped", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_CALL_TIME, max: MAX_CALL_TIME }),
        steps,
        (seconds, taps) => {
          const end = taps.reduce<CallTime>(
            (callTime, delta) => adjustCallTime(callTime, delta, START),
            { seconds },
          );
          expect(end.seconds).toBeGreaterThanOrEqual(MIN_CALL_TIME);
          expect(end.seconds).toBeLessThanOrEqual(MAX_CALL_TIME);
        },
      ),
    );
  });

  it("reads back every length it can be set to, and nothing else as a length", () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: MAX_CALL_TIME + 50 }), (seconds) => {
        const inRange = seconds >= MIN_CALL_TIME && seconds <= MAX_CALL_TIME;
        expect(parseCallTime(String(seconds))).toBe(inRange ? seconds : undefined);
      }),
    );
  });

  it("never ends a countdown by taking time off, and never runs it past the longest", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_CALL_TIME, max: MAX_CALL_TIME }),
        fc.array(
          fc.record({
            delta: fc.constantFrom(CALL_TIME_STEP, -CALL_TIME_STEP),
            wait: fc.integer({ min: 0, max: 3_000 }),
          }),
          { maxLength: 80 },
        ),
        (seconds, taps) => {
          let now = START;
          let callTime = startCallTime({ seconds }, now);
          for (const { delta, wait } of taps) {
            now += wait;
            const before = callTimeRemaining(callTime, now);
            callTime = adjustCallTime(callTime, delta, now);
            const after = callTimeRemaining(callTime, now);
            if (before > 0) expect(after).toBeGreaterThan(0);
            expect(after).toBeLessThanOrEqual(MAX_CALL_TIME);
            expect(callTimeFraction(callTime, now)).toBeLessThanOrEqual(1);
          }
        },
      ),
    );
  });
});
