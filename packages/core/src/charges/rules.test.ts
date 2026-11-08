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
    expect(toTableFeeForm(DEFAULT_TABLE_FEE)).toEqual({ amount: "100", minMinutes: "30" });
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

  it("round-trips the default with no adjustment", () => {
    expect(form.adjustment).toBe("none");
    expect(parseWage(form)).toEqual({ ok: true, rule: DEFAULT_WAGE });
  });

  it("reads a time of day rate", () => {
    const rule = {
      ...form,
      adjustment: "time_of_day",
      fromHour: "22",
      toHour: "2",
      timeHourly: "40",
    } as const;
    expect(parseWage(rule)).toEqual({
      ok: true,
      rule: {
        hourly: cents(2500),
        adjustment: { kind: "time_of_day", fromHour: 22, toHour: 2, hourly: cents(4000) },
      },
    });
  });

  it("reads a rate after some hours", () => {
    expect(
      parseWage({ ...form, adjustment: "after_start", afterHours: "3", afterHourly: "0" }),
    ).toEqual({
      ok: true,
      rule: {
        hourly: cents(2500),
        adjustment: { kind: "after_start", afterHours: 3, hourly: cents(0) },
      },
    });
  });

  it("only checks the adjustment that is on", () => {
    expect(parseWage({ ...form, afterHours: "x", fromHour: "99" })).toEqual({
      ok: true,
      rule: DEFAULT_WAGE,
    });
  });

  it("rejects bad hours and rates", () => {
    expect(parseWage({ ...form, adjustment: "time_of_day", fromHour: "5", toHour: "5" })).toEqual({
      ok: false,
      issues: { toHour: "same-hours" },
    });
    expect(parseWage({ ...form, hourly: "", adjustment: "after_start", afterHours: "0" })).toEqual({
      ok: false,
      issues: { hourly: "invalid", afterHours: "invalid" },
    });
  });

  it("keeps both adjustments' inputs in the form", () => {
    const rule = {
      hourly: cents(2500),
      adjustment: { kind: "after_start", afterHours: 5, hourly: cents(3000) },
    } as const;
    expect(toWageForm(rule)).toMatchObject({
      adjustment: "after_start",
      afterHours: "5",
      afterHourly: "30",
      timeHourly: "25",
    });
  });
});
