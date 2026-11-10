import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildPots, contestedStakes, potTotals } from "./pots";

describe("buildPots", () => {
  it("keeps dead money in the top contested pot when the top stake is uncalled", () => {
    const pots = buildPots([
      { playerId: "a", chips: 100 },
      { playerId: "b", chips: 300 },
      { playerId: "pool", chips: 500, folded: true },
    ]);

    expect(pots.map((p) => [p.amountChips, p.playerIds])).toEqual([
      [700, ["a", "b"]],
      [200, ["b"]],
    ]);
  });

  it("layers dead money across the side pots it reaches", () => {
    const pots = buildPots([
      { playerId: "a", chips: 100 },
      { playerId: "b", chips: 300 },
      { playerId: "c", chips: 300 },
      { playerId: "pool", chips: 250, folded: true },
    ]);

    expect(pots.map((p) => p.amountChips)).toEqual([400, 550]);
  });
});

describe("potTotals", () => {
  it("reports the contested pot, the dead money and the uncalled excess", () => {
    expect(
      potTotals([
        { playerId: "a", chips: 100 },
        { playerId: "b", chips: 300 },
        { playerId: "pool", chips: 500, folded: true },
      ]),
    ).toEqual({ effectiveChips: 700, deadChips: 500, uncalledChips: 200 });
  });

  it("has nothing contested until a second player is in", () => {
    expect(potTotals([{ playerId: "a", chips: 100 }])).toEqual({
      effectiveChips: 0,
      deadChips: 0,
      uncalledChips: 100,
    });
  });

  it("accounts for every chip once a player is live", () => {
    const stack = fc.integer({ min: 1, max: 100_000 });
    fc.assert(
      fc.property(
        fc.array(stack, { minLength: 1, maxLength: 9 }),
        fc.array(stack, { maxLength: 4 }),
        (liveChips, deadChips) => {
          const entries = [
            ...liveChips.map((chips, i) => ({ playerId: `live-${i}`, chips })),
            ...deadChips.map((chips, i) => ({ playerId: `dead-${i}`, chips, folded: true })),
          ];
          const total = entries.reduce((sum, e) => sum + e.chips, 0);
          const { effectiveChips, uncalledChips } = potTotals(entries);
          expect(effectiveChips + uncalledChips).toBe(total);
        },
      ),
    );
  });
});

describe("contestedStakes", () => {
  it("counts what each player has in every pot they contest", () => {
    expect(
      contestedStakes([
        { playerId: "a", chips: 100 },
        { playerId: "b", chips: 300 },
        { playerId: "c", chips: 300 },
        { playerId: "pool", chips: 50, folded: true },
      ]),
    ).toEqual({ a: 100, b: 300, c: 300 });
  });

  it("leaves out the top player's excess nobody called", () => {
    expect(
      contestedStakes([
        { playerId: "a", chips: 100 },
        { playerId: "b", chips: 900 },
      ]),
    ).toEqual({ a: 100, b: 100 });
  });

  it("has nothing contested until a second player is in", () => {
    expect(contestedStakes([{ playerId: "a", chips: 100 }])).toEqual({});
  });

  it("adds up to the effective pot together with the dead money", () => {
    const stack = fc.integer({ min: 1, max: 100_000 });
    fc.assert(
      fc.property(
        fc.array(stack, { minLength: 2, maxLength: 9 }),
        fc.array(stack, { maxLength: 4 }),
        (liveChips, deadChips) => {
          const entries = [
            ...liveChips.map((chips, i) => ({ playerId: `live-${i}`, chips })),
            ...deadChips.map((chips, i) => ({ playerId: `dead-${i}`, chips, folded: true })),
          ];
          const staked = Object.values(contestedStakes(entries)).reduce((sum, c) => sum + c, 0);
          const totals = potTotals(entries);
          expect(staked + totals.deadChips).toBe(totals.effectiveChips);
        },
      ),
    );
  });
});
