import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEFAULT_RAKE_RULE } from "../domain";
import { potForRake, rakeFromPot } from "./rake";

describe("rakeFromPot", () => {
  it("takes the rule's percentage of the pot", () => {
    expect(rakeFromPot(1200, DEFAULT_RAKE_RULE)).toBe(120);
    expect(rakeFromPot(1000, { percent: 5 })).toBe(50);
  });

  it("rounds down to whole chips", () => {
    expect(rakeFromPot(125, DEFAULT_RAKE_RULE)).toBe(12);
    expect(rakeFromPot(9, DEFAULT_RAKE_RULE)).toBe(0);
  });

  it("takes nothing from an empty, negative or part-chip pot", () => {
    expect(rakeFromPot(0, DEFAULT_RAKE_RULE)).toBe(0);
    expect(rakeFromPot(-100, DEFAULT_RAKE_RULE)).toBe(0);
    expect(rakeFromPot(100.5, DEFAULT_RAKE_RULE)).toBe(0);
  });

  it("works a typed rake back to the smallest pot that gives it", () => {
    expect(potForRake(12, DEFAULT_RAKE_RULE)).toBe(120);
    expect(potForRake(7, { percent: 3 })).toBe(234);
    expect(potForRake(0, DEFAULT_RAKE_RULE)).toBe(0);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000_000 }),
        fc.integer({ min: 1, max: 99 }),
        (rake, percent) => {
          const pot = potForRake(rake, { percent });
          expect(rakeFromPot(pot, { percent })).toBe(rake);
          expect(rakeFromPot(pot - 1, { percent })).toBeLessThan(rake);
        },
      ),
    );
  });

  it("never takes more than the pot, nor a part chip", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 99 }),
        (pot, percent) => {
          const rake = rakeFromPot(pot, { percent });
          expect(Number.isInteger(rake)).toBe(true);
          expect(rake).toBeGreaterThanOrEqual(0);
          expect(rake).toBeLessThan(Math.max(pot, 1));
        },
      ),
    );
  });
});
