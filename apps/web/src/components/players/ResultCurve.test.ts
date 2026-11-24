import { describe, expect, it } from "vitest";
import { axisTicks, parseTypedDay } from "./ResultCurve";

describe("parseTypedDay", () => {
  it("reads a day with dashes, slashes or dots, with or without leading zeros", () => {
    expect(parseTypedDay("2026-11-18")).toBe("2026-11-18");
    expect(parseTypedDay(" 2026/1/5 ")).toBe("2026-01-05");
    expect(parseTypedDay("2026.02.28")).toBe("2026-02-28");
  });

  it("gives nothing for what is not a day of the calendar", () => {
    expect(parseTypedDay("2026-02-30")).toBeUndefined();
    expect(parseTypedDay("2026-13-01")).toBeUndefined();
    expect(parseTypedDay("2026-00-10")).toBeUndefined();
    expect(parseTypedDay("2025-02-29")).toBeUndefined();
    expect(parseTypedDay("11-18")).toBeUndefined();
    expect(parseTypedDay("yesterday")).toBeUndefined();
    expect(parseTypedDay("")).toBeUndefined();
  });

  it("knows a leap day", () => {
    expect(parseTypedDay("2028-02-29")).toBe("2028-02-29");
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
