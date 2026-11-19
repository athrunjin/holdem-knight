import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEFAULT_RAKE_RULE, type RakeRule } from "../domain";
import { parseRake, potForRake, rakeFromPot, toRakeForm } from "./rake";

/** A rule from before rake had settings: 10%, rounded down to whole chips, no cap. */
const OLDER: RakeRule = { percent: 10 };

describe("rakeFromPot", () => {
  it("takes the rule's percentage of the pot, which may have decimals", () => {
    expect(rakeFromPot(1200, OLDER)).toBe(120);
    expect(rakeFromPot(1000, DEFAULT_RAKE_RULE)).toBe(50);
    expect(rakeFromPot(1000, { ...DEFAULT_RAKE_RULE, percent: 2.5 })).toBe(25);
  });

  it("rounds an older rule down to whole chips", () => {
    expect(rakeFromPot(125, OLDER)).toBe(12);
    expect(rakeFromPot(9, OLDER)).toBe(0);
  });

  it("rounds to the smallest chip: nearest by default, or down, or up", () => {
    const rule: RakeRule = { percent: 5, roundTo: 5, rounding: "nearest" };
    // 5% of 250 is 12.5, two and a half fives
    expect(rakeFromPot(250, rule)).toBe(15);
    expect(rakeFromPot(240, rule)).toBe(10);
    expect(rakeFromPot(250, { ...rule, rounding: "down" })).toBe(10);
    expect(rakeFromPot(201, { ...rule, rounding: "up" })).toBe(15);
    expect(rakeFromPot(125, DEFAULT_RAKE_RULE)).toBe(6);
  });

  it("stops at the cap, in chips or in big blinds, rounded down to the smallest chip", () => {
    const rule: RakeRule = { ...DEFAULT_RAKE_RULE, cap: { unit: "chips", amount: 30 } };
    expect(rakeFromPot(1000, rule)).toBe(30);
    expect(rakeFromPot(400, rule)).toBe(20);
    const byBlinds: RakeRule = { ...DEFAULT_RAKE_RULE, cap: { unit: "bigBlinds", amount: 3 } };
    expect(rakeFromPot(1000, byBlinds, 10)).toBe(30);
    expect(rakeFromPot(1000, { ...byBlinds, roundTo: 25 }, 10)).toBe(25);
    // With no big blind to go by, a cap in big blinds does not apply
    expect(rakeFromPot(1000, byBlinds)).toBe(50);
  });

  it("takes nothing from an empty, negative or part-chip pot", () => {
    expect(rakeFromPot(0, DEFAULT_RAKE_RULE)).toBe(0);
    expect(rakeFromPot(-100, DEFAULT_RAKE_RULE)).toBe(0);
    expect(rakeFromPot(100.5, DEFAULT_RAKE_RULE)).toBe(0);
  });

  it("works a typed rake back to the smallest pot that gives it", () => {
    expect(potForRake(12, OLDER)).toBe(120);
    expect(potForRake(7, { percent: 3 })).toBe(234);
    expect(potForRake(0, OLDER)).toBe(0);
    expect(potForRake(40, { ...DEFAULT_RAKE_RULE, cap: { unit: "chips", amount: 30 } })).toBe(0);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.integer({ min: 1, max: 9999 }),
        fc.constantFrom(1, 5, 25),
        fc.constantFrom("nearest", "down", "up"),
        (rake, points, roundTo, rounding) => {
          const rule: RakeRule = { percent: points / 100, roundTo, rounding };
          const pot = potForRake(rake, rule);
          if (pot === 0) return;
          expect(rakeFromPot(pot, rule)).toBeGreaterThanOrEqual(rake);
          expect(rakeFromPot(pot - 1, rule)).toBeLessThan(rake);
        },
      ),
    );
  });

  it("never takes more than the pot, nor a part chip", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 9999 }),
        fc.constantFrom("nearest", "down", "up"),
        (pot, points, rounding) => {
          const rake = rakeFromPot(pot, { percent: points / 100, roundTo: 1, rounding });
          expect(Number.isInteger(rake)).toBe(true);
          expect(rake).toBeGreaterThanOrEqual(0);
          expect(rake).toBeLessThanOrEqual(Math.max(pot, 0));
        },
      ),
    );
  });
});

describe("parseRake", () => {
  it("round-trips the default and a rule with a cap", () => {
    expect(parseRake(toRakeForm(DEFAULT_RAKE_RULE))).toEqual({ ok: true, rule: DEFAULT_RAKE_RULE });
    const rule: RakeRule = {
      percent: 2.5,
      roundTo: 5,
      rounding: "up",
      cap: { unit: "bigBlinds", amount: 3 },
      insuranceAfterRake: true,
    };
    expect(parseRake(toRakeForm(rule))).toEqual({ ok: true, rule });
  });

  it("carries an older rule over as it charged: rounded down to whole chips", () => {
    expect(toRakeForm(OLDER)).toMatchObject({ percent: "10", roundTo: "1", rounding: "down" });
  });

  it("reports a bad percentage, smallest chip or cap", () => {
    const form = toRakeForm(DEFAULT_RAKE_RULE);
    expect(
      parseRake({ ...form, percent: "2.555", roundTo: "0", capUnit: "chips", capAmount: "x" }),
    ).toEqual({
      ok: false,
      issues: { percent: "invalid", roundTo: "invalid", capAmount: "invalid" },
    });
    expect(parseRake({ ...form, percent: "100" })).toEqual({
      ok: false,
      issues: { percent: "invalid" },
    });
    // A cap amount left behind while there is no cap does not count
    expect(parseRake({ ...form, capAmount: "x" }).ok).toBe(true);
  });
});
