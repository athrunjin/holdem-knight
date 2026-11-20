import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEFAULT_RAKE_RULE, type RakeRule } from "../domain";
import { parseRake, potAtCap, potForRake, rakeFromPot, toRakeForm } from "./rake";

/** Blinds of 5 and 10. */
const BLINDS = { smallBlindChips: 5, bigBlindChips: 10 };

/** A rule from before rake had settings: 10%, rounded down to whole chips, no cap. */
const OLDER: RakeRule = { percent: 10 };

/** 5%, rounded to the nearest chip. */
const BY_CHIP: RakeRule = {
  percent: 5,
  rounding: "nearest",
  roundTo: { unit: "chips", amount: 1 },
};

describe("rakeFromPot", () => {
  it("takes the rule's percentage of the pot, which may have decimals", () => {
    expect(rakeFromPot(1200, OLDER)).toBe(120);
    expect(rakeFromPot(1000, BY_CHIP)).toBe(50);
    expect(rakeFromPot(1000, { ...BY_CHIP, percent: 2.5 })).toBe(25);
  });

  it("rounds an older rule down to whole chips", () => {
    expect(rakeFromPot(125, OLDER)).toBe(12);
    expect(rakeFromPot(9, OLDER)).toBe(0);
  });

  it("rounds to the smallest chip: nearest, or down, or up", () => {
    const rule: RakeRule = { ...BY_CHIP, roundTo: { unit: "chips", amount: 5 } };
    // 5% of 250 is 12.5, two and a half fives
    expect(rakeFromPot(250, rule)).toBe(15);
    expect(rakeFromPot(240, rule)).toBe(10);
    expect(rakeFromPot(250, { ...rule, rounding: "down" })).toBe(10);
    expect(rakeFromPot(201, { ...rule, rounding: "up" })).toBe(15);
  });

  it("rounds the default to the nearest small blind, or whole chips with no blinds", () => {
    expect(rakeFromPot(250, DEFAULT_RAKE_RULE, BLINDS)).toBe(15);
    expect(rakeFromPot(240, DEFAULT_RAKE_RULE, BLINDS)).toBe(10);
    expect(rakeFromPot(125, DEFAULT_RAKE_RULE)).toBe(6);
  });

  it("rounds down to whole chips with rounding switched off", () => {
    expect(rakeFromPot(125, { percent: 5, rounding: "up" })).toBe(6);
  });

  it("stops at the cap, in chips or in big blinds, rounded down to the smallest chip", () => {
    const rule: RakeRule = { ...BY_CHIP, cap: { unit: "chips", amount: 30 } };
    expect(rakeFromPot(1000, rule)).toBe(30);
    expect(rakeFromPot(400, rule)).toBe(20);
    const byBlinds: RakeRule = { ...BY_CHIP, cap: { unit: "bigBlinds", amount: 2.5 } };
    const byTens: RakeRule = { ...byBlinds, roundTo: { unit: "chips", amount: 10 } };
    expect(rakeFromPot(1000, byBlinds, BLINDS)).toBe(25);
    expect(rakeFromPot(1000, byTens, BLINDS)).toBe(20);
    // With no big blind to go by, a cap in big blinds does not apply
    expect(rakeFromPot(1000, byBlinds)).toBe(50);
  });

  it("works out the pot whose rake before rounding is the cap, so it comes back as typed", () => {
    const rule: RakeRule = { ...DEFAULT_RAKE_RULE, cap: { unit: "bigBlinds", amount: 51 } };
    // 51 big blinds of 5 are 255 chips, 5% of a 5,100 pot
    expect(potAtCap({ ...rule, cap: { unit: "chips", amount: 255 } })).toBe(5100);
    expect(potAtCap(rule, { bigBlindChips: 5 })).toBe(5100);
    expect(potAtCap({ ...rule, percent: 3 }, { bigBlindChips: 5 })).toBe(8500);
    expect(potAtCap(rule)).toBeNull();
    expect(potAtCap(DEFAULT_RAKE_RULE, BLINDS)).toBeNull();
  });

  it("takes nothing from an empty, negative or part-chip pot", () => {
    expect(rakeFromPot(0, BY_CHIP)).toBe(0);
    expect(rakeFromPot(-100, BY_CHIP)).toBe(0);
    expect(rakeFromPot(100.5, BY_CHIP)).toBe(0);
  });

  it("works a typed rake back to the smallest pot that gives it", () => {
    expect(potForRake(12, OLDER)).toBe(120);
    expect(potForRake(7, { percent: 3 })).toBe(234);
    expect(potForRake(0, OLDER)).toBe(0);
    expect(potForRake(40, { ...BY_CHIP, cap: { unit: "chips", amount: 30 } })).toBe(0);
    expect(potForRake(10, DEFAULT_RAKE_RULE, BLINDS)).toBe(150);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.integer({ min: 1, max: 9999 }),
        fc.constantFrom(1, 5, 25),
        fc.constantFrom("nearest", "down", "up"),
        (rake, points, amount, rounding) => {
          const rule: RakeRule = {
            percent: points / 100,
            rounding,
            roundTo: { unit: "chips", amount },
          };
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
          const rake = rakeFromPot(pot, { ...BY_CHIP, percent: points / 100, rounding });
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
      rounding: "up",
      roundTo: { unit: "chips", amount: 5 },
      cap: { unit: "bigBlinds", amount: 2.5 },
      insuranceAfterRake: true,
    };
    expect(parseRake(toRakeForm(rule))).toEqual({ ok: true, rule });
  });

  it("leaves the cap and rounding out when they are switched off", () => {
    const form = { ...toRakeForm(DEFAULT_RAKE_RULE), roundOn: false, capOn: false };
    expect(parseRake(form)).toEqual({ ok: true, rule: { percent: 5, rounding: "nearest" } });
  });

  it("rounds new rules to a small blind, and starts a cap at 2 big blinds when switched on", () => {
    expect(toRakeForm(DEFAULT_RAKE_RULE)).toMatchObject({
      roundOn: true,
      roundUnit: "smallBlinds",
      roundAmount: "1",
      capOn: false,
      capUnit: "bigBlinds",
      capAmount: "2",
    });
  });

  it("carries an older rule over as it charged: rounded down to whole chips, with no cap", () => {
    expect(toRakeForm(OLDER)).toMatchObject({
      percent: "10",
      roundOn: true,
      roundUnit: "chips",
      roundAmount: "1",
      rounding: "down",
      capOn: false,
    });
  });

  it("reports a bad percentage, smallest chip or cap", () => {
    const form = toRakeForm(DEFAULT_RAKE_RULE);
    expect(
      parseRake({
        ...form,
        percent: "2.555",
        roundUnit: "chips",
        roundAmount: "1.5",
        capOn: true,
        capAmount: "x",
      }),
    ).toEqual({
      ok: false,
      issues: { percent: "invalid", roundAmount: "invalid", capAmount: "invalid" },
    });
    expect(parseRake({ ...form, percent: "100" })).toEqual({
      ok: false,
      issues: { percent: "invalid" },
    });
    // A cap amount left behind while the cap is off does not count
    expect(parseRake({ ...form, capAmount: "x" }).ok).toBe(true);
  });
});
