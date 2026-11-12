import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { INSURANCE_PLAYER_ID, type WageRule } from "../domain";
import { createGame, DEFAULT_GAME_SETTINGS } from "../game";
import { cents, sum } from "../money";
import { ORGANIZER_COLLECTOR, type PlayerNet } from "../settlement";
import {
  applyCharges,
  type Charge,
  chargeStatuses,
  clockReaches,
  gameCharges,
  localHourAfter,
  localHourBefore,
  localWageWindows,
  seatTimes,
  segmentedWageParts,
  tableFeeFor,
  unitWageParts,
  wageFor,
  wageParts,
  wageRateAt,
  wageWindows,
  waiveCharge,
} from "./charges";
import { buy, leave, MIN, undo } from "./test-events";

const HOUR = 60 * MIN;
const meta = { id: "g", organizerId: "me", createdAt: 0 };
/** Tests read time zero as local midnight. */
const clock = { now: 24 * HOUR, minuteOfDay: (t: number) => Math.floor(t / MIN) % 1440 };
const wage25: WageRule = { hourly: cents(2500) };
const fee = (playerId: string, amount: number) => ({
  playerId,
  kind: "table_fee",
  amount,
  waived: false,
});
const wage = (playerId: string, part: string, hourly: number, minutes: number, amount: number) => ({
  playerId,
  kind: "wage",
  part,
  hourly,
  minutes,
  amount,
  waived: false,
});
/** A clock that ran all day, so every minute at the table counts. */
const allDay = { elapsedMs: 24 * HOUR, runs: [{ from: 0, to: 24 * HOUR }] };

describe("tableFeeFor", () => {
  const rule = { amount: cents(10_000), minMinutes: 30 };

  it("charges from the minimum time on", () => {
    expect(tableFeeFor(rule, 30 * MIN)).toBe(10_000);
    expect(tableFeeFor(rule, 30 * MIN - 1)).toBe(0);
  });

  it("charges everyone with no minimum", () => {
    expect(tableFeeFor({ ...rule, minMinutes: 0 }, 0)).toBe(10_000);
  });
});

describe("wageFor", () => {
  it("counts whole minutes at the hourly rate", () => {
    expect(wageFor(wage25, [{ from: 0, to: 2 * HOUR }], Infinity, clock)).toBe(5000);
    // 25 an hour for 61.5 minutes: 61 minutes are charged, 2541.67 rounds to 2542
    expect(wageFor(wage25, [{ from: 0, to: 61.5 * MIN }], Infinity, clock)).toBe(2542);
  });

  it("charges whole minutes of the total, not of each session", () => {
    // 89.5 and 60.5 minutes make 150: 62.50, the same as one session of 150 minutes
    const sessions = [
      { from: 0, to: 89.5 * MIN },
      { from: 100 * MIN, to: 160.5 * MIN },
    ];
    expect(wageFor(wage25, sessions, Infinity, clock)).toBe(6250);
  });

  it("adds up sessions and runs an open one to now", () => {
    const sessions = [{ from: 0, to: 30 * MIN }, { from: 23 * HOUR }];
    expect(wageFor(wage25, sessions, Infinity, clock)).toBe(3750);
  });

  it("uses the time of day rate inside its hours, past midnight too", () => {
    const rule: WageRule = {
      hourly: cents(2500),
      adjustment: { kind: "time_of_day", fromHour: 22, toHour: 2, hourly: cents(4000) },
    };
    expect(wageRateAt(rule, 21 * HOUR + 59 * MIN, 0, clock.minuteOfDay)).toBe(2500);
    expect(wageRateAt(rule, 22 * HOUR, 0, clock.minuteOfDay)).toBe(4000);
    expect(wageRateAt(rule, 25 * HOUR, 0, clock.minuteOfDay)).toBe(4000);
    expect(wageRateAt(rule, 26 * HOUR, 0, clock.minuteOfDay)).toBe(2500);
    // 21:00 to 23:00: one hour at 25 and one at 40
    const sessions = [{ from: 21 * HOUR, to: 23 * HOUR }];
    expect(wageFor(rule, sessions, Infinity, { ...clock, now: 30 * HOUR })).toBe(6500);
  });

  it("switches to the after-hours rate at the switch time", () => {
    const rule: WageRule = {
      hourly: cents(2500),
      adjustment: { kind: "after_start", afterHours: 2, hourly: cents(0) },
    };
    // Sat from 1:00 to 4:00, free from 2:00
    expect(wageFor(rule, [{ from: HOUR, to: 4 * HOUR }], 2 * HOUR, clock)).toBe(2500);
    // 120.5 minutes at 25: the part minute at a rate is not charged
    expect(wageFor(rule, [{ from: 0, to: 4 * HOUR }], 2 * HOUR + 30_000, clock)).toBe(5000);
  });

  it("lists each rate with its whole minutes", () => {
    const rule: WageRule = {
      hourly: cents(2500),
      adjustment: { kind: "time_of_day", fromHour: 22, toHour: 2, hourly: cents(4000) },
    };
    // 21:00 to 22:30 and 1:00 to 3:00: 60 + 60 minutes at 25, 30 + 60 at 40
    const sessions = [
      { from: 21 * HOUR, to: 22.5 * HOUR },
      { from: 25 * HOUR, to: 27 * HOUR },
    ];
    expect(wageParts(rule, sessions, Infinity, { ...clock, now: 30 * HOUR })).toEqual([
      { part: "base", hourly: 2500, minutes: 120, amount: 5000 },
      { part: "adjusted", hourly: 4000, minutes: 90, amount: 6000 },
    ]);
  });
});

describe("segmentedWageParts", () => {
  const minuteOfDay = clock.minuteOfDay;
  const at = (fromHour: number, toHour: number) => [{ from: fromHour * HOUR, to: toHour * HOUR }];
  const parts = (rule: WageRule, start: number, sessions: { from: number; to: number }[]) =>
    segmentedWageParts(rule, sessions, wageWindows(rule, start, undefined, minuteOfDay), clock);
  const perMinute: WageRule = { hourly: cents(2500), unitMinutes: 1, roundUp: true };

  it("counts a part minute as a whole one when rounding up, and drops it when not", () => {
    const sessions = [{ from: 0, to: 90 * MIN + 30_000 }];
    expect(parts(perMinute, 0, sessions)).toEqual([
      { part: "base", hourly: 2500, minutes: 91, amount: 3792 },
    ]);
    expect(parts({ ...perMinute, roundUp: false }, 0, sessions)[0]?.minutes).toBe(90);
  });

  it("charges whole hours: 1 hour 10 minutes is 2 hours rounded up and 1 rounded down", () => {
    const hourly: WageRule = { ...perMinute, unitMinutes: 60 };
    const sessions = [{ from: 0, to: 70 * MIN }];
    expect(parts(hourly, 0, sessions)).toEqual([
      { part: "base", hourly: 2500, minutes: 120, amount: 5000 },
    ]);
    expect(parts({ ...hourly, roundUp: false }, 0, sessions)[0]?.minutes).toBe(60);
  });

  it("starts an open time segment the first time its hour comes round after the game starts", () => {
    const rule: WageRule = { ...perMinute, timeSegments: [{ fromHour: 0, hourly: cents(3000) }] };
    // The game starts at 20:00 and the player sits 22:00 to 2:00
    expect(parts(rule, 20 * HOUR, at(22, 26))).toEqual([
      { part: "base", hourly: 2500, minutes: 120, amount: 5000 },
      { part: "time-1", hourly: 3000, minutes: 120, amount: 6000 },
    ]);
  });

  it("chains time segments past midnight", () => {
    const rule: WageRule = {
      ...perMinute,
      timeSegments: [
        { fromHour: 22, toHour: 2, hourly: cents(4000) },
        { fromHour: 2, hourly: cents(3000) },
      ],
    };
    expect(parts(rule, 20 * HOUR, at(21, 27))).toEqual([
      { part: "base", hourly: 2500, minutes: 60, amount: 2500 },
      { part: "time-1", hourly: 4000, minutes: 240, amount: 16_000 },
      { part: "time-2", hourly: 3000, minutes: 60, amount: 3000 },
    ]);
  });

  it("charges the higher rate where both kinds apply", () => {
    const rule: WageRule = {
      ...perMinute,
      timeSegments: [{ fromHour: 0, hourly: cents(3000) }],
      afterStartSegments: [{ afterHours: 1, hourly: cents(4000) }],
    };
    // Starts 22:00: game time rate from 23:00, time rate from 0:00, and 40 beats 30 after that
    expect(parts(rule, 22 * HOUR, at(22, 25))).toEqual([
      { part: "base", hourly: 2500, minutes: 60, amount: 2500 },
      { part: "after-1", hourly: 4000, minutes: 120, amount: 8000 },
    ]);
  });

  it("moves each game time segment on at the next one's hours", () => {
    const rule: WageRule = {
      ...perMinute,
      afterStartSegments: [
        { afterHours: 1, hourly: cents(3000) },
        { afterHours: 2, hourly: cents(4000) },
      ],
    };
    expect(parts(rule, 0, at(0, 3)).map((p) => [p.part, p.minutes])).toEqual([
      ["base", 60],
      ["after-1", 60],
      ["after-2", 60],
    ]);
  });

  it("gives what rounding adds to, or takes from, the rate the player sat at last", () => {
    const rule: WageRule = {
      ...perMinute,
      unitMinutes: 60,
      timeSegments: [{ fromHour: 1, hourly: cents(3000) }],
    };
    // 0:30 to 1:40 is 30 minutes at the base and 40 at the time rate
    const sessions = [{ from: 30 * MIN, to: 100 * MIN }];
    expect(parts(rule, 0, sessions).map((p) => [p.part, p.minutes])).toEqual([
      ["base", 30],
      ["time-1", 90],
    ]);
    const down = parts({ ...rule, roundUp: false }, 0, sessions);
    expect(down.map((p) => [p.part, p.minutes])).toEqual([
      ["base", 30],
      ["time-1", 30],
    ]);
  });

  it("charges whole units of the total time", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 15, 30, 60),
        fc.boolean(),
        fc.integer({ min: 1, max: 10 * HOUR }),
        fc.integer({ min: 0, max: 23 }),
        (unitMinutes, roundUp, length, hour) => {
          const rule: WageRule = {
            hourly: cents(2500),
            unitMinutes: unitMinutes as 1 | 15 | 30 | 60,
            roundUp,
            timeSegments: [{ fromHour: hour, toHour: (hour + 3) % 24, hourly: cents(3000) }],
            afterStartSegments: [{ afterHours: 2, hourly: cents(2000) }],
          };
          const minutes = sum(
            parts(rule, 0, [{ from: 0, to: length }]).map((p) => cents(p.minutes)),
          );
          const units = length / (unitMinutes * MIN);
          expect(minutes).toBe((roundUp ? Math.ceil(units) : Math.floor(units)) * unitMinutes);
        },
      ),
    );
  });
});

describe("unitWageParts", () => {
  const minuteOfDay = clock.minuteOfDay;
  /** A game from 20:00 with ¥20 an hour, and ¥30 from midnight, which is hour 24. */
  const night: WageRule = {
    hourly: cents(2000),
    unitMinutes: 30,
    rounding: "up",
    timeSegments: [{ fromHour: 0, hourly: cents(3000) }],
  };
  const parts = (rule: WageRule, sessions: { from: number; to?: number }[], now = 48 * HOUR) =>
    unitWageParts(rule, sessions, localWageWindows(rule, 20 * HOUR, undefined, minuteOfDay), {
      now,
    });
  const sat = (fromMinute: number, toMinute: number) => [
    { from: 23 * HOUR + fromMinute * MIN, to: 23 * HOUR + toMinute * MIN },
  ];

  it("charges a unit across two rates at the one with more of it", () => {
    // 23:16 to 0:13: 23:16–23:46 at ¥20, then the part unit runs on to 0:16, 16 minutes of it past midnight
    expect(parts(night, sat(16, 73))).toEqual([
      { part: "base", hourly: 2000, minutes: 30, amount: 1000 },
      { part: "time-1", hourly: 3000, minutes: 30, amount: 1500 },
    ]);
  });

  it("charges the higher rate when two rates share a unit equally", () => {
    expect(parts(night, sat(45, 75))).toEqual([
      { part: "time-1", hourly: 3000, minutes: 30, amount: 1500 },
    ]);
  });

  it("counts a part unit of half or more when rounding to the nearest", () => {
    const nearest: WageRule = { ...night, rounding: "nearest" };
    // 44 minutes: 14 over, dropped. 45 minutes: 15 over, counted, and the unit runs 23:46–0:16
    expect(parts(nearest, sat(16, 60))).toEqual([
      { part: "base", hourly: 2000, minutes: 30, amount: 1000 },
    ]);
    expect(parts(nearest, sat(16, 61))).toEqual([
      { part: "base", hourly: 2000, minutes: 30, amount: 1000 },
      { part: "time-1", hourly: 3000, minutes: 30, amount: 1500 },
    ]);
  });

  it("drops any part unit when rounding down, and charges nothing under one unit", () => {
    const down: WageRule = { ...night, rounding: "down" };
    expect(parts(down, sat(16, 73))).toEqual([
      { part: "base", hourly: 2000, minutes: 30, amount: 1000 },
    ]);
    expect(parts(down, sat(16, 45))).toEqual([]);
  });

  it("rounds seconds by the minute", () => {
    const perMinute: WageRule = { hourly: cents(2500), unitMinutes: 1, rounding: "nearest" };
    const minutes = (ms: number) => parts(perMinute, [{ from: 0, to: ms }])[0]?.minutes;
    expect(minutes(90 * MIN + 29_000)).toBe(90);
    expect(minutes(90 * MIN + 30_000)).toBe(91);
    expect(parts({ ...perMinute, rounding: "up" }, [{ from: 0, to: 90 * MIN + 1 }])[0]).toEqual({
      part: "base",
      hourly: 2500,
      minutes: 91,
      amount: 3792,
    });
  });

  it("cuts units from the player's counted time, leaving out time away", () => {
    // 20 minutes, away, then 40 more: two units with nothing over
    const sessions = [
      { from: 22 * HOUR, to: 22 * HOUR + 20 * MIN },
      { from: 23 * HOUR + 30 * MIN, to: 24 * HOUR + 10 * MIN },
    ];
    // The first unit is 22:00–22:20 and 23:30–23:40. The second, 23:40–0:10, has 20 minutes before midnight
    expect(parts(night, sessions)).toEqual([
      { part: "base", hourly: 2000, minutes: 60, amount: 2000 },
    ]);
  });

  it("runs an open session to now", () => {
    expect(parts(night, [{ from: 23 * HOUR }], 23 * HOUR + 31 * MIN)).toEqual([
      { part: "base", hourly: 2000, minutes: 60, amount: 2000 },
    ]);
  });

  it("charges whole units of the total time, by the rule's rounding", () => {
    const session = fc
      .tuple(fc.nat(600_000), fc.integer({ min: 1, max: 7_000_000 }))
      .map(([gap, length]) => ({ gap, length }));
    fc.assert(
      fc.property(
        fc.array(session, { minLength: 1, maxLength: 4 }),
        fc.constantFrom(1, 15, 30, 60),
        fc.constantFrom("nearest", "up", "down"),
        (stretches, unitMinutes, rounding) => {
          let time = 21 * HOUR;
          const sessions = stretches.map(({ gap, length }) => {
            const from = time + gap;
            time = from + length;
            return { from, to: time };
          });
          const rule = { ...night, unitMinutes, rounding } as WageRule;
          const total =
            stretches.reduce((all, { length }) => all + length, 0) / (unitMinutes * MIN);
          const units =
            rounding === "up"
              ? Math.ceil(total)
              : rounding === "down"
                ? Math.floor(total)
                : Math.floor(total + 0.5);
          const charged = parts(rule, sessions).reduce((all, p) => all + p.minutes, 0);
          expect(charged).toBe(units * unitMinutes);
        },
      ),
    );
  });
});

describe("localWageWindows", () => {
  const minuteOfDay = clock.minuteOfDay;
  const base = { hourly: cents(2500), unitMinutes: 1, rounding: "nearest" } as const;
  const timeWindows = (
    segments: NonNullable<WageRule["timeSegments"]>,
    start: number,
    localMinute = minuteOfDay,
  ) =>
    localWageWindows({ ...base, timeSegments: segments }, start, undefined, localMinute).map(
      ({ part, from, to }) => [part, from / HOUR, to / HOUR],
    );
  const nightRate = [{ fromHour: 22, toHour: 6, hourly: cents(4000) }];
  const fromMidnight = [{ fromHour: 0, hourly: cents(4000) }];

  it("begins a game inside a segment in that segment", () => {
    expect(timeWindows(nightRate, 23 * HOUR)).toEqual([["time-1", 22, 30]]);
    expect(timeWindows(nightRate, 29 * HOUR)).toEqual([["time-1", 22, 30]]);
  });

  it("waits for the next start once the segments are over", () => {
    expect(timeWindows(nightRate, 31 * HOUR)).toEqual([["time-1", 46, 54]]);
    expect(timeWindows(nightRate, 20 * HOUR)).toEqual([["time-1", 22, 30]]);
  });

  it("counts a segment with no end as begun for 12 hours", () => {
    expect(timeWindows(fromMidnight, 25 * HOUR)).toEqual([["time-1", 24, Infinity]]);
    expect(timeWindows(fromMidnight, 36 * HOUR)).toEqual([["time-1", 24, Infinity]]);
    expect(timeWindows(fromMidnight, 36 * HOUR + 1)).toEqual([["time-1", 48, Infinity]]);
    expect(timeWindows(fromMidnight, 20 * HOUR)).toEqual([["time-1", 24, Infinity]]);
  });

  it("begins in a later segment of a chain", () => {
    const chain = [
      { fromHour: 22, toHour: 2, hourly: cents(4000) },
      { fromHour: 2, hourly: cents(5000) },
    ];
    expect(timeWindows(chain, 27 * HOUR)).toEqual([
      ["time-1", 22, 26],
      ["time-2", 26, Infinity],
    ]);
  });

  /** The local clock jumps from 2:00 to 3:00 at hour 26, as daylight saving starts. */
  const springForward = (t: number) => minuteOfDay(t + (t >= 26 * HOUR ? HOUR : 0));
  /** The local clock goes back from 3:00 to 2:00 at hour 27, as daylight saving ends. */
  const fallBack = (t: number) => minuteOfDay(t - (t >= 27 * HOUR ? HOUR : 0));

  it("ends a segment when the local clock shows its hour on a daylight saving night", () => {
    const zeroToSix = [{ fromHour: 0, toHour: 6, hourly: cents(4000) }];
    // An hour is skipped, so 6:00 comes 5 hours after midnight; an hour comes twice, so 7 hours after
    expect(timeWindows(zeroToSix, 20 * HOUR, springForward)).toEqual([["time-1", 24, 29]]);
    expect(timeWindows(zeroToSix, 20 * HOUR, fallBack)).toEqual([["time-1", 24, 31]]);
  });

  it("starts at the jump when the clock skips the hour, and at the first of an hour that comes twice", () => {
    expect(localHourAfter(20 * HOUR, 2, springForward)).toBe(26 * HOUR);
    expect(localHourAfter(20 * HOUR, 2, fallBack)).toBe(26 * HOUR);
    expect(localHourAfter(20 * HOUR, 3, fallBack)).toBe(28 * HOUR);
    expect(localHourBefore(27 * HOUR + 30 * MIN, 2, fallBack)).toBe(26 * HOUR);
  });

  it("finds a local hour at, before and after a time", () => {
    expect(localHourBefore(24 * HOUR, 0, minuteOfDay)).toBe(24 * HOUR);
    expect(localHourBefore(24 * HOUR - 1, 0, minuteOfDay)).toBe(0);
    expect(localHourAfter(24 * HOUR, 0, minuteOfDay)).toBe(48 * HOUR);
    expect(localHourAfter(23 * HOUR + 50 * MIN, 0, minuteOfDay)).toBe(24 * HOUR);
  });

  it("works in a time zone a quarter hour off the hour", () => {
    const nepal = (t: number) => minuteOfDay(t + 5 * HOUR + 45 * MIN);
    expect(localHourAfter(0, 6, nepal)).toBe(15 * MIN);
  });
});

describe("gameCharges with segments", () => {
  it("charges a rule with rounding unit by unit, from a segment the game started in", () => {
    const rule: WageRule = {
      hourly: cents(2500),
      unitMinutes: 30,
      rounding: "nearest",
      timeSegments: [{ fromHour: 22, toHour: 6, hourly: cents(4000) }],
    };
    // The clock starts at 23:00, inside 22–6. A rule from before rounding would wait a day
    const timer = { elapsedMs: 3 * HOUR, runs: [{ from: 23 * HOUR, to: 26 * HOUR }] };
    const played = [buy("a", 23 * 60), leave("a", 24 * 60 + 50)];
    expect(gameCharges({ wage: rule, timer }, played, { ...clock, now: 26 * HOUR })).toEqual([
      wage("a", "time-1", 4000, 120, 8000),
    ]);
    const { rounding: _, ...unrounded } = rule;
    const earlier: WageRule = { ...unrounded, roundUp: true };
    expect(gameCharges({ wage: earlier, timer }, played, { ...clock, now: 26 * HOUR })).toEqual([
      wage("a", "base", 2500, 120, 5000),
    ]);
  });

  it("starts time segments from the clock's first run", () => {
    const rule: WageRule = {
      hourly: cents(2500),
      unitMinutes: 1,
      roundUp: true,
      timeSegments: [{ fromHour: 1, hourly: cents(3000) }],
    };
    const timer = { elapsedMs: 3 * HOUR, runs: [{ from: 0, to: 3 * HOUR }] };
    expect(gameCharges({ wage: rule, timer }, [buy("a", 0), leave("a", 120)], clock)).toEqual([
      wage("a", "base", 2500, 60, 2500),
      wage("a", "time-1", 3000, 60, 3000),
    ]);
  });
});

describe("clockReaches", () => {
  const runs = [
    { from: 0, to: HOUR },
    { from: 2 * HOUR, to: 4 * HOUR },
  ];

  it("skips the pauses", () => {
    expect(clockReaches(runs, 30 * MIN)).toBe(30 * MIN);
    expect(clockReaches(runs, 2 * HOUR)).toBe(3 * HOUR);
  });

  it("is never reached past the clock's time", () => {
    expect(clockReaches(runs, 3 * HOUR + 1)).toBe(Infinity);
  });
});

describe("gameCharges", () => {
  const events = [
    buy("a", 0),
    buy("b", 60),
    buy(INSURANCE_PLAYER_ID, 0),
    leave("b", 80),
    leave("a", 120),
    leave(INSURANCE_PLAYER_ID, 120),
  ];
  const tableFee = { amount: cents(10_000), minMinutes: 30 };

  it("is empty with neither option on", () => {
    expect(gameCharges({}, events, clock)).toEqual([]);
  });

  it("charges players, not the insurance seat, and leaves out amounts of 0", () => {
    expect(gameCharges({ tableFee, wage: wage25, timer: allDay }, events, clock)).toEqual([
      fee("a", 10_000),
      wage("a", "base", 2500, 120, 5000),
      wage("b", "base", 2500, 20, 833),
    ]);
  });

  it("does not charge an organizer who plays", () => {
    const withOrganizer = [...events, buy(ORGANIZER_COLLECTOR, 0), leave(ORGANIZER_COLLECTOR, 120)];
    const game = { tableFee, wage: wage25, timer: allDay };
    expect(gameCharges(game, withOrganizer, clock)).toEqual(gameCharges(game, events, clock));
  });

  it("counts nothing before the clock starts", () => {
    expect(gameCharges({ tableFee, wage: wage25 }, events, clock)).toEqual([]);
  });

  it("counts only time while the clock runs", () => {
    // Clock from 0:30 to 1:00 and 1:10 on: a sat 0:00 to 2:00, so 1:20 counts; b sat 1:00 to 1:20, so 10 minutes
    const timer = {
      elapsedMs: 30 * MIN,
      runningSince: 70 * MIN,
      runs: [{ from: 30 * MIN, to: 60 * MIN }],
    };
    expect(gameCharges({ tableFee, wage: wage25, timer }, events, clock)).toEqual([
      fee("a", 10_000),
      wage("a", "base", 2500, 80, 3333),
      wage("b", "base", 2500, 10, 417),
    ]);
    expect(seatTimes({ timer }, events, clock.now)).toEqual([
      { playerId: "a", seatedMs: 80 * MIN },
      { playerId: "b", seatedMs: 10 * MIN },
    ]);
  });

  it("switches the after-hours rate once the clock shows those hours", () => {
    const rule: WageRule = {
      hourly: cents(2500),
      adjustment: { kind: "after_start", afterHours: 1, hourly: cents(6000) },
    };
    // The clock runs 0:30 to 1:00 and from 1:30, so it shows 1 hour at 2:00
    const timer = {
      elapsedMs: 30 * MIN,
      runningSince: 90 * MIN,
      runs: [{ from: 30 * MIN, to: 60 * MIN }],
    };
    // a sits 0:30 to 2:30: 30 + 30 minutes at 25, then 30 at 60
    const played = [buy("a", 30), leave("a", 150)];
    expect(gameCharges({ wage: rule, timer }, played, clock)).toEqual([
      wage("a", "base", 2500, 60, 2500),
      wage("a", "adjusted", 6000, 30, 3000),
    ]);
  });

  it("counts all time at the table for a clock from before runs were kept", () => {
    const rule: WageRule = {
      hourly: cents(2500),
      adjustment: { kind: "after_start", afterHours: 1, hourly: cents(6000) },
    };
    const timer = { elapsedMs: 5 * MIN };
    // The after-hours rate counts from the first player sitting down
    expect(gameCharges({ wage: rule, timer }, [buy("a", 30), leave("a", 150)], clock)).toEqual([
      wage("a", "base", 2500, 60, 2500),
      wage("a", "adjusted", 6000, 60, 6000),
    ]);
  });

  it("reports what each player owes so far and time left before the table fee", () => {
    // Clock from 0:00 to 0:20 only: a and b sat from 0:00 and 1:00, so a has 20 minutes and b none
    const timer = { elapsedMs: 20 * MIN, runs: [{ from: 0, to: 20 * MIN }] };
    expect(chargeStatuses({ tableFee, wage: wage25, timer }, events, clock)).toEqual([
      {
        playerId: "a",
        seatedMs: 20 * MIN,
        tableFee: 0,
        wageParts: [{ part: "base", hourly: 2500, minutes: 20, amount: 833 }],
        tableFeeShortMs: 10 * MIN,
      },
      { playerId: "b", seatedMs: 0, tableFee: 0, wageParts: [], tableFeeShortMs: 30 * MIN },
    ]);
  });

  it("reports time with neither option on", () => {
    expect(chargeStatuses({ timer: allDay }, events, clock)).toEqual([
      { playerId: "a", seatedMs: 2 * HOUR, tableFee: 0, wageParts: [], tableFeeShortMs: 0 },
      { playerId: "b", seatedMs: 20 * MIN, tableFee: 0, wageParts: [], tableFeeShortMs: 0 },
    ]);
  });

  it("marks the charges the game waived", () => {
    const game = waiveCharge(
      { ...createGame(meta, DEFAULT_GAME_SETTINGS), tableFee, wage: wage25, timer: allDay },
      { playerId: "a", kind: "table_fee" },
      true,
    );
    expect(gameCharges(game, events, clock)).toEqual([
      { ...fee("a", 10_000), waived: true },
      wage("a", "base", 2500, 120, 5000),
      wage("b", "base", 2500, 20, 833),
    ]);
  });

  it("does not charge a player removed as a mistake", () => {
    const mistake = buy("c", 0);
    const played = [mistake, undo(mistake, 40)];
    expect(gameCharges({ tableFee, timer: allDay }, played, clock)).toEqual([]);
  });

  it("lists time at the table", () => {
    expect(seatTimes({ timer: allDay }, events, clock.now)).toEqual([
      { playerId: "a", seatedMs: 2 * HOUR },
      { playerId: "b", seatedMs: 20 * MIN },
    ]);
  });
});

describe("waiveCharge", () => {
  const game = createGame(meta, DEFAULT_GAME_SETTINGS);
  const base = { playerId: "a", kind: "wage", part: "base" } as const;
  const adjusted = { playerId: "a", kind: "wage", part: "adjusted" } as const;

  it("waives one charge at a time and restores it", () => {
    const once = waiveCharge(waiveCharge(game, base, true), base, true);
    const both = waiveCharge(once, adjusted, true);
    expect(both.waivedCharges).toEqual([base, adjusted]);
    expect(waiveCharge(waiveCharge(both, base, false), adjusted, false)).toEqual(game);
  });
});

describe("applyCharges", () => {
  const nets: PlayerNet[] = [
    { playerId: "a", net: cents(30_000) },
    { playerId: "b", net: cents(-30_000) },
  ];
  const charges: Charge[] = [
    { playerId: "a", kind: "table_fee", amount: cents(10_000), waived: false },
    { playerId: "a", kind: "wage", part: "base", amount: cents(5000), waived: false },
    { playerId: "b", kind: "table_fee", amount: cents(10_000), waived: false },
  ];

  it("moves the charges to a new organizer row", () => {
    expect(applyCharges(nets, charges)).toEqual({
      nets: [
        { playerId: "a", net: 15_000 },
        { playerId: "b", net: -40_000 },
        { playerId: ORGANIZER_COLLECTOR, net: 25_000 },
      ],
      total: 25_000,
      recipientId: ORGANIZER_COLLECTOR,
    });
  });

  it("adds to an organizer row that is already there", () => {
    const withOrganizer = [...nets, { playerId: ORGANIZER_COLLECTOR, net: cents(-500) }];
    expect(applyCharges(withOrganizer, charges).nets.at(-1)).toEqual({
      playerId: ORGANIZER_COLLECTOR,
      net: 24_500,
    });
  });

  it("leaves out waived charges", () => {
    const waived = charges.map((c) => (c.kind === "wage" ? { ...c, waived: true } : c));
    expect(applyCharges(nets, waived).total).toBe(20_000);
    expect(applyCharges(nets, waived).nets[0]).toEqual({ playerId: "a", net: 20_000 });
  });

  it("changes nothing without charges", () => {
    expect(applyCharges(nets, [])).toEqual({ nets, total: 0, recipientId: ORGANIZER_COLLECTOR });
  });

  it("keeps the total of all results", () => {
    const amount = fc.integer({ min: -1_000_000, max: 1_000_000 }).map(cents);
    fc.assert(
      fc.property(
        fc.array(amount, { minLength: 1, maxLength: 8 }),
        fc.array(fc.tuple(fc.nat(7), fc.integer({ min: 0, max: 100_000 })), { maxLength: 16 }),
        (values, picks) => {
          const before = values.map((net, i) => ({ playerId: `p${i}`, net }));
          const owed = picks.map(
            ([i, value]): Charge => ({
              playerId: `p${i % values.length}`,
              kind: "wage",
              amount: cents(value),
              waived: value % 3 === 0,
            }),
          );
          const after = applyCharges(before, owed).nets;
          expect(sum(after.map((p) => p.net))).toBe(sum(values));
        },
      ),
    );
  });
});
