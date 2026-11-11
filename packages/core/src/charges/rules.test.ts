import { describe, expect, it } from "vitest";

import { cents } from "../money";
import {
  DEFAULT_TABLE_FEE,
  DEFAULT_WAGE,
  parseTableFee,
  parseWage,
  toTableFeeForm,
  toWageForm,
} from "./rules";

describe("parseTableFee", () => {
  it("round-trips the default", () => {
    expect(toTableFeeForm(DEFAULT_TABLE_FEE)).toEqual({ amount: "100", minMinutes: "10" });
    expect(parseTableFee(toTableFeeForm(DEFAULT_TABLE_FEE))).toEqual({
      ok: true,
      rule: DEFAULT_TABLE_FEE,
    });
  });

  it("allows no minimum time", () => {
    expect(parseTableFee({ amount: "50.5", minMinutes: "0" })).toEqual({
      ok: true,
      rule: { amount: cents(5050), minMinutes: 0 },
    });
  });

  it("reports each bad field", () => {
    expect(parseTableFee({ amount: "0", minMinutes: "1.5" })).toEqual({
      ok: false,
      issues: { amount: "not-positive", minMinutes: "invalid" },
    });
    expect(parseTableFee({ amount: "-3", minMinutes: "10" })).toEqual({
      ok: false,
      issues: { amount: "invalid" },
    });
  });
});

describe("parseWage", () => {
  const form = toWageForm(DEFAULT_WAGE);

  it("round-trips the default: by the minute, rounded up, no segments", () => {
    expect(form).toMatchObject({ hourly: "25.00", unitMinutes: 1, roundUp: true });
    expect(form).toMatchObject({ timeOn: false, afterOn: false });
    expect(parseWage(form)).toEqual({ ok: true, rule: DEFAULT_WAGE });
  });

  it("starts new segments at 0 o'clock with no end, and 6 hours into the game", () => {
    expect(form.timeSegments).toEqual([{ fromHour: "0", toHour: "", hourly: "30.00" }]);
    expect(form.afterSegments).toEqual([{ afterHours: "6", hourly: "25.00" }]);
  });

  it("reads chained time segments and rising game time segments together", () => {
    const parsed = parseWage({
      ...form,
      unitMinutes: 60,
      roundUp: false,
      timeOn: true,
      timeSegments: [
        { fromHour: "22", toHour: "2", hourly: "40" },
        { fromHour: "2", toHour: "", hourly: "30" },
      ],
      afterOn: true,
      afterSegments: [{ afterHours: "4", hourly: "35" }],
    });
    expect(parsed).toEqual({
      ok: true,
      rule: {
        hourly: cents(2500),
        unitMinutes: 60,
        roundUp: false,
        timeSegments: [
          { fromHour: 22, toHour: 2, hourly: cents(4000) },
          { fromHour: 2, hourly: cents(3000) },
        ],
        afterStartSegments: [{ afterHours: 4, hourly: cents(3500) }],
      },
    });
  });

  it("only checks the kinds that are on", () => {
    const off = {
      ...form,
      timeSegments: [{ fromHour: "x", toHour: "", hourly: "" }],
      afterSegments: [{ afterHours: "1.5", hourly: "" }],
    };
    expect(parseWage(off)).toEqual({ ok: true, rule: DEFAULT_WAGE });
  });

  it("rejects an open end before the last segment, the same hours and more than a day", () => {
    const parse = (timeSegments: { fromHour: string; toHour: string; hourly: string }[]) =>
      parseWage({ ...form, timeOn: true, timeSegments });
    expect(
      parse([
        { fromHour: "0", toHour: "", hourly: "30" },
        { fromHour: "6", toHour: "", hourly: "30" },
      ]),
    ).toMatchObject({ ok: false, issues: { "time-0-toHour": "invalid" } });
    expect(parse([{ fromHour: "5", toHour: "5", hourly: "30" }])).toMatchObject({
      ok: false,
      issues: { "time-0-toHour": "same-hours" },
    });
    expect(
      parse([
        { fromHour: "0", toHour: "20", hourly: "30" },
        { fromHour: "20", toHour: "10", hourly: "30" },
      ]),
    ).toEqual({ ok: false, issues: { time: "overlap" } });
  });

  it("rejects game time segments that do not rise, fractions of hours and too many segments", () => {
    const rising = (hours: string[]) => hours.map((afterHours) => ({ afterHours, hourly: "30" }));
    expect(parseWage({ ...form, afterOn: true, afterSegments: rising(["6", "4"]) })).toEqual({
      ok: false,
      issues: { after: "not-rising" },
    });
    expect(parseWage({ ...form, afterOn: true, afterSegments: rising(["2.5"]) })).toEqual({
      ok: false,
      issues: { "after-0-afterHours": "invalid" },
    });
    const time = [
      { fromHour: "0", toHour: "2", hourly: "30" },
      { fromHour: "2", toHour: "4", hourly: "30" },
    ];
    expect(
      parseWage({
        ...form,
        timeOn: true,
        timeSegments: time,
        afterOn: true,
        afterSegments: rising(["1", "2", "3"]),
      }),
    ).toEqual({ ok: false, issues: { segments: "too-many" } });
  });

  it("turns an older rule's adjustment into a segment, still by the minute rounded down", () => {
    const older = {
      hourly: cents(2500),
      adjustment: { kind: "time_of_day", fromHour: 22, toHour: 2, hourly: cents(4000) },
    } as const;
    expect(toWageForm(older)).toMatchObject({
      unitMinutes: 1,
      roundUp: false,
      timeOn: true,
      timeSegments: [{ fromHour: "22", toHour: "2", hourly: "40.00" }],
      afterOn: false,
    });
  });
});
