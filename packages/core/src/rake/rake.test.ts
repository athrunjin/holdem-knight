import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEFAULT_RAKE_RULE, type RakeRule } from "../domain";
import {
  parseRake,
  potAtCap,
  potForRake,
  rakeBlindsToChips,
  rakeChipsToBlinds,
  rakeFormForTools,
  rakeFormInBlinds,
  rakeFormInChips,
  rakeFromPot,
  rakeRuleFromTools,
  toRakeForm,
} from "./rake";

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

describe("rakeChipsToBlinds", () => {
  it("gives the blinds that come to the chips", () => {
    expect(rakeChipsToBlinds(30, 10, "cap")).toEqual({ amount: 3, exact: true });
    expect(rakeChipsToBlinds(25, 10, "cap")).toEqual({ amount: 2.5, exact: true });
    expect(rakeChipsToBlinds(5, 5, "smallestChip")).toEqual({ amount: 1, exact: true });
    expect(rakeChipsToBlinds(1, 5, "smallestChip")).toEqual({ amount: 0.2, exact: true });
  });

  it("picks two decimals that a cap rounds down to the chips typed", () => {
    // 7 chips at a big blind of 3 is 2.33…, and 2.33 big blinds would round down to 6
    const { amount, exact } = rakeChipsToBlinds(7, 3, "cap");
    expect(exact).toBe(true);
    expect(rakeBlindsToChips(amount, 3, "cap")).toBe(7);
  });

  it("says when two decimals cannot come to the chips, at a blind of 100 or more", () => {
    expect(rakeChipsToBlinds(333, 1000, "cap")).toEqual({ amount: 0.33, exact: false });
    expect(rakeChipsToBlinds(250, 200, "cap")).toEqual({ amount: 1.25, exact: true });
  });

  it("comes back to any chips at any blind under 100", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 99 }),
        fc.constantFrom("cap" as const, "smallestChip" as const),
        (chips, blindChips, use) => {
          const { amount, exact } = rakeChipsToBlinds(chips, blindChips, use);
          expect(exact).toBe(true);
          expect(Math.round(amount * 100)).toBeCloseTo(amount * 100, 6);
          expect(rakeBlindsToChips(amount, blindChips, use)).toBe(chips);
        },
      ),
    );
  });
});

describe("rakeFormInBlinds", () => {
  const inChips = {
    ...toRakeForm(DEFAULT_RAKE_RULE),
    capOn: true,
    capUnit: "chips" as const,
    capAmount: "30",
    roundUnit: "chips" as const,
    roundAmount: "5",
  };

  it("turns a cap in chips into big blinds and a smallest chip into small blinds", () => {
    expect(rakeFormInBlinds(inChips, BLINDS)).toEqual({
      ...inChips,
      capUnit: "bigBlinds",
      capAmount: "3",
      roundUnit: "smallBlinds",
      roundAmount: "1",
    });
  });

  it("charges the same after as before", () => {
    const before = parseRake(inChips);
    const after = parseRake(rakeFormInBlinds(inChips, BLINDS));
    if (!before.ok || !after.ok) throw new Error("Expected valid forms");
    for (const pot of [40, 99, 250, 599, 600, 601, 5000]) {
      expect(rakeFromPot(pot, after.rule, BLINDS)).toBe(rakeFromPot(pot, before.rule, BLINDS));
    }
  });

  it("leaves amounts already in blinds, and those with no blind to go by", () => {
    const form = toRakeForm(DEFAULT_RAKE_RULE);
    expect(rakeFormInBlinds(form, BLINDS)).toEqual(form);
    expect(rakeFormInBlinds(inChips, {})).toEqual(inChips);
  });

  it("leaves in chips an amount that blinds cannot come back to", () => {
    const odd = { ...inChips, capAmount: "333" };
    const result = rakeFormInBlinds(odd, { smallBlindChips: 500, bigBlindChips: 1000 });
    expect(result).toMatchObject({ capUnit: "chips", capAmount: "333" });
    expect(result).toMatchObject({ roundUnit: "smallBlinds", roundAmount: "0.01" });
  });
});

describe("the tools' rake settings", () => {
  const config = toRakeForm({
    percent: 3,
    rounding: "up",
    roundTo: { unit: "smallBlinds", amount: 2 },
    cap: { unit: "bigBlinds", amount: 3 },
  });
  const tools = {
    ...rakeFormInChips(toRakeForm(DEFAULT_RAKE_RULE)),
    roundAmount: "5",
    capOn: true,
    capAmount: "30",
  };

  it("shows a rule with no blinds in chips alone", () => {
    expect(rakeFormInChips(config)).toMatchObject({
      roundUnit: "chips",
      roundAmount: "1",
      capOn: false,
      capUnit: "chips",
    });
  });

  it("takes a config's rate and rounding and keeps the chips typed there", () => {
    expect(rakeFormForTools(config, tools)).toEqual({ ...tools, percent: "3", rounding: "up" });
  });

  it("takes the chips of a config kept in chips, from before amounts were in blinds", () => {
    const older = { ...config, roundUnit: "chips" as const, roundAmount: "10" };
    expect(rakeFormForTools(older, tools)).toMatchObject({ roundAmount: "10", capAmount: "30" });
    const capped = { ...config, capUnit: "chips" as const, capAmount: "50" };
    expect(rakeFormForTools(capped, { ...tools, capOn: false })).toMatchObject({
      capOn: true,
      capAmount: "50",
    });
  });

  it("keeps the rate and rounding with the amounts of the config they were taken from", () => {
    const changed = { ...rakeFormForTools(config, tools), percent: "4", rounding: "down" as const };
    expect(rakeRuleFromTools(changed, parseRuleOf(config))).toEqual({
      percent: 4,
      rounding: "down",
      roundTo: { unit: "smallBlinds", amount: 2 },
      cap: { unit: "bigBlinds", amount: 3 },
    });
  });

  it("keeps the default's amounts when taken from no config, and never the tools' chips", () => {
    expect(rakeRuleFromTools({ ...tools, percent: "2.5" }, undefined)).toEqual({
      ...DEFAULT_RAKE_RULE,
      percent: 2.5,
    });
  });

  it("keeps nothing while the settings are invalid", () => {
    expect(rakeRuleFromTools({ ...tools, percent: "0" }, undefined)).toBeNull();
  });
});

function parseRuleOf(form: ReturnType<typeof toRakeForm>): RakeRule {
  const parsed = parseRake(form);
  if (!parsed.ok) throw new Error("Expected a valid form");
  return parsed.rule;
}
