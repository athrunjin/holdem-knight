import { describe, expect, it } from "vitest";
import { axisTicks, composeDay } from "./ResultCurve";

describe("composeDay", () => {
  it("makes a day of a year, a month and a day as typed, with or without leading zeros", () => {
    expect(composeDay("2026", "11", "18")).toBe("2026-11-18");
    expect(composeDay(" 2026 ", "1", "05")).toBe("2026-01-05");
    expect(composeDay("2028", "2", "29")).toBe("2028-02-29");
  });

  it("gives nothing for what is not a day of the calendar", () => {
    expect(composeDay("2026", "2", "30")).toBeUndefined();
    expect(composeDay("2025", "2", "29")).toBeUndefined();
    expect(composeDay("2026", "13", "1")).toBeUndefined();
    expect(composeDay("2026", "0", "10")).toBeUndefined();
    expect(composeDay("2026", "11", "0")).toBeUndefined();
  });

  it("gives nothing for parts that are not whole numbers, or a year that is not four digits", () => {
    expect(composeDay("26", "11", "18")).toBeUndefined();
    expect(composeDay("2026", "", "18")).toBeUndefined();
    expect(composeDay("2026", "11", "1.5")).toBeUndefined();
    expect(composeDay("2026", "nov", "18")).toBeUndefined();
    expect(composeDay("2026", "-1", "18")).toBeUndefined();
  });
});

describe("axisTicks", () => {
  it("covers the values with a few round steps", () => {
    expect(axisTicks(0, 426_600)).toEqual([0, 200_000, 400_000, 600_000]);
    expect(axisTicks(-300_000, 150_000)).toEqual([-400_000, -200_000, 0, 200_000]);
  });

  it("always has 0 where the values lie on both sides of it, and something for no span", () => {
    expect(axisTicks(-1, 1)).toContain(0);
    expect(axisTicks(0, 0).length).toBeGreaterThan(1);
  });
});
