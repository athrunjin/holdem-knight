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
  seatTimes,
  tableFeeFor,
  wageFor,
  wageParts,
  wageRateAt,
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
