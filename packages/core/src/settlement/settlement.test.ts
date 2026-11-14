import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { INSURANCE_PLAYER_ID, OPTIMAL_PLAN } from "../domain";
import { RULE_30 } from "../insurance";
import { chipsToCents, type PlayerLedger } from "../ledger";
import { cents, sum } from "../money";
import {
  attributeInsurance,
  chipDifference,
  collectorTransfers,
  isValidCollector,
  netCents,
  ORGANIZER_COLLECTOR,
  type PlayerNet,
  settlementOutcome,
  settleTransfers,
  transferCollector,
} from "./settlement";

const ledger = (playerId: string, boughtChips: number, cashedOutChips: number): PlayerLedger => ({
  playerId,
  boughtChips,
  cashedOutChips,
  seated: false,
  stackChips: 0,
  netChips: cashedOutChips - boughtChips,
});

const net = (playerId: string, value: number): PlayerNet => ({ playerId, net: cents(value) });

/** Random balanced books: after buying in, chips move randomly between players. */
const balancedLedgers = fc
  .array(
    fc.record({
      bought: fc.integer({ min: 1, max: 100_000 }),
      moved: fc.integer({ min: 0, max: 100_000 }),
    }),
    { minLength: 2, maxLength: 12 },
  )
  .map((rows) => {
    const players = rows.map(({ bought, moved }, i) => {
      const lost = Math.min(bought, moved);
      return ledger(`p${i}`, bought, bought - lost);
    });
    const pot = players.reduce((total, p) => total + p.boughtChips - p.cashedOutChips, 0);
    return players.map((p, i) => (i === 0 ? { ...p, cashedOutChips: p.cashedOutChips + pot } : p));
  });

const ratios = fc.record({
  chips: fc.integer({ min: 1, max: 1000 }),
  amount: fc.integer({ min: 1, max: 100_000 }).map(cents),
});

describe("chipDifference", () => {
  it("is 0 when balanced", () => {
    expect(chipDifference([ledger("a", 1000, 1500), ledger("b", 1000, 500)])).toBe(0);
  });

  it("is positive when too much is cashed out and negative when too little", () => {
    expect(chipDifference([ledger("a", 1000, 1200)])).toBe(200);
    expect(chipDifference([ledger("a", 1000, 700)])).toBe(-300);
  });

  it("balances when results + rake = 0", () => {
    const players = [ledger("a", 1000, 900)];
    expect(chipDifference(players, { rakeChips: 100 })).toBe(0);
  });
});

describe("netCents", () => {
  it("converts each result at the ratio", () => {
    const players = [ledger("a", 1000, 1500), ledger("b", 1000, 500)];
    expect(netCents(players, { chips: 100, amount: cents(100) })).toEqual([
      net("a", 500),
      net("b", -500),
    ]);
  });

  it("still adds up to 0 when the ratio does not divide evenly", () => {
    const players = [ledger("a", 1, 2), ledger("b", 1, 2), ledger("c", 3, 1)];
    const nets = netCents(players, { chips: 3, amount: cents(100) });
    expect(sum(nets.map((p) => p.net))).toBe(0);
  });

  it("is all 0 when nobody wins or loses", () => {
    expect(netCents([ledger("a", 100, 100)], { chips: 1, amount: cents(1) })).toEqual([
      net("a", 0),
    ]);
  });

  it("throws when the books do not balance", () => {
    expect(() => netCents([ledger("a", 100, 90)], { chips: 1, amount: cents(1) })).toThrow();
  });

  it("adds up to 0 for any balanced books and ratio", () => {
    fc.assert(
      fc.property(balancedLedgers, ratios, (players, ratio) => {
        expect(sum(netCents(players, ratio).map((p) => p.net))).toBe(0);
      }),
    );
  });
});

describe("settleTransfers", () => {
  it("has the biggest debtor pay the biggest creditor first", () => {
    const transfers = settleTransfers([net("a", 700), net("b", 300), net("c", -1000)]);
    expect(transfers).toEqual([
      { from: "c", to: "a", amount: 700 },
      { from: "c", to: "b", amount: 300 },
    ]);
  });

  it("needs no transfers when nobody wins or loses", () => {
    expect(settleTransfers([net("a", 0), net("b", 0)])).toEqual([]);
  });

  it("clears everyone within n−1 transfers", () => {
    fc.assert(
      fc.property(balancedLedgers, ratios, (players, ratio) => {
        const nets = netCents(players, ratio);
        const transfers = settleTransfers(nets);
        const balances = new Map<string, number>(nets.map((p) => [p.playerId, p.net]));
        for (const { from, to, amount } of transfers) {
          expect(amount).toBeGreaterThan(0);
          balances.set(from, (balances.get(from) ?? 0) + amount);
          balances.set(to, (balances.get(to) ?? 0) - amount);
        }
        expect([...balances.values()].every((b) => b === 0)).toBe(true);
        const active = nets.filter((p) => p.net !== 0).length;
        expect(transfers.length).toBeLessThanOrEqual(Math.max(active - 1, 0));
      }),
    );
  });
});

describe("collectorTransfers", () => {
  const nets = [net("a", 700), net("b", 300), net("c", -1000), net("d", 0)];

  it("has losers pay a player collector, who pays the winners", () => {
    expect(collectorTransfers(nets, "b")).toEqual([
      { from: "c", to: "b", amount: 1000 },
      { from: "b", to: "a", amount: 700 },
    ]);
  });

  it("runs everyone through an organizer who is not playing", () => {
    expect(collectorTransfers(nets, ORGANIZER_COLLECTOR)).toEqual([
      { from: "c", to: ORGANIZER_COLLECTOR, amount: 1000 },
      { from: ORGANIZER_COLLECTOR, to: "b", amount: 300 },
      { from: ORGANIZER_COLLECTOR, to: "a", amount: 700 },
    ]);
  });

  it("clears every player and leaves the collector level", () => {
    fc.assert(
      fc.property(balancedLedgers, ratios, fc.boolean(), (players, ratio, outsider) => {
        const results = netCents(players, ratio);
        const collector = outsider ? ORGANIZER_COLLECTOR : (results[0]?.playerId ?? "");
        const balances = new Map<string, number>(results.map((p) => [p.playerId, p.net]));
        for (const { from, to, amount } of collectorTransfers(results, collector)) {
          expect(amount).toBeGreaterThan(0);
          balances.set(from, (balances.get(from) ?? 0) + amount);
          balances.set(to, (balances.get(to) ?? 0) - amount);
        }
        expect([...balances.values()].every((b) => b === 0)).toBe(true);
      }),
    );
  });
});

describe("isValidCollector", () => {
  it("accepts the organizer and players in the game only", () => {
    const nets = [net("a", 0)];
    expect(isValidCollector(nets, "a")).toBe(true);
    expect(isValidCollector(nets, ORGANIZER_COLLECTOR)).toBe(true);
    expect(isValidCollector(nets, "gone")).toBe(false);
    expect(isValidCollector(nets, undefined)).toBe(false);
  });
});

describe("transferCollector", () => {
  const nets = [net("a", 100), net("b", -100)];
  const fee = { tableFee: { amount: cents(1000), minMinutes: 0 } };

  it("takes the optimal plan in a plain game and the organizer in one with insurance or charges", () => {
    expect(transferCollector({}, nets)).toBeUndefined();
    expect(transferCollector(fee, nets)).toBe(ORGANIZER_COLLECTOR);
    expect(transferCollector({ wage: { hourly: cents(1000) } }, nets)).toBe(ORGANIZER_COLLECTOR);
    expect(transferCollector({ insurance: RULE_30 }, nets)).toBe(ORGANIZER_COLLECTOR);
  });

  it("keeps a saved choice, the optimal plan included", () => {
    expect(transferCollector({ collectorId: "a" }, nets)).toBe("a");
    expect(transferCollector({ ...fee, collectorId: "b" }, nets)).toBe("b");
    expect(transferCollector({ ...fee, collectorId: OPTIMAL_PLAN }, nets)).toBeUndefined();
  });

  it("falls back to the game's default when the collector has left the game", () => {
    expect(transferCollector({ collectorId: "gone" }, nets)).toBeUndefined();
    expect(transferCollector({ ...fee, collectorId: "gone" }, nets)).toBe(ORGANIZER_COLLECTOR);
  });
});

describe("settlementOutcome", () => {
  const oneToOne = { chips: 1, amount: cents(100) };
  // Cashed out 300 chips more than were bought
  const excess = [ledger("a", 1000, 1500), ledger("b", 1000, 800)];
  const short = [ledger("a", 1000, 1200), ledger("b", 1000, 500)];
  const netOf = (nets: readonly PlayerNet[], id: string) =>
    nets.find((p) => p.playerId === id)?.net;

  it("leaves balanced books alone whatever the handling", () => {
    const players = [ledger("a", 1000, 1500), ledger("b", 1000, 500)];
    expect(settlementOutcome(players, oneToOne, "split")).toEqual({
      nets: netCents(players, oneToOne),
      difference: 0,
      unresolved: 0,
    });
  });

  it("takes an excess off winners in proportion to their wins", () => {
    const players = [ledger("a", 1000, 4000), ledger("b", 1000, 2000), ledger("c", 3800, 0)];
    const { nets, difference, unresolved } = settlementOutcome(players, oneToOne, "split");
    expect(difference).toBe(20_000);
    expect(unresolved).toBe(0);
    expect(netOf(nets, "a")).toBe(285_000);
    expect(netOf(nets, "b")).toBe(95_000);
    expect(netOf(nets, "c")).toBe(-380_000);
  });

  it("lets losers pay less in proportion when chips are left over", () => {
    const players = [ledger("a", 3000, 0), ledger("b", 1000, 0), ledger("c", 1000, 4800)];
    const { nets, difference } = settlementOutcome(players, oneToOne, "split");
    expect(difference).toBe(-20_000);
    expect(netOf(nets, "a")).toBe(-285_000);
    expect(netOf(nets, "b")).toBe(-95_000);
    expect(netOf(nets, "c")).toBe(380_000);
  });

  it("matches the converted chip difference when the ratio does not divide evenly", () => {
    const players = [ledger("a", 300, 401), ledger("b", 300, 250), ledger("c", 300, 251)];
    const ratio = { chips: 3, amount: cents(100) };
    const { difference } = settlementOutcome([...players, ledger("d", 300, 299)], ratio, "ignore");
    expect(difference).toBe(chipsToCents(1, ratio));
  });

  it("never moves a player past 0 when splitting", () => {
    const players = [ledger("a", 500, 1000), ledger("b", 500, 500)];
    const { nets } = settlementOutcome(players, oneToOne, "split");
    expect(netOf(nets, "a")).toBe(0);
    expect(netOf(nets, "b")).toBe(0);
  });

  it("has the organizer pay an excess", () => {
    const { nets } = settlementOutcome(excess, oneToOne, "organizer");
    expect(netOf(nets, ORGANIZER_COLLECTOR)).toBe(-30_000);
    expect(netOf(nets, "a")).toBe(50_000);
  });

  it("has the organizer collect leftover chips", () => {
    const { nets } = settlementOutcome(short, oneToOne, "organizer");
    expect(netOf(nets, ORGANIZER_COLLECTOR)).toBe(30_000);
  });

  it("keeps one row for an organizer who plays and covers the difference", () => {
    const players = [...excess, ledger(ORGANIZER_COLLECTOR, 1000, 1500)];
    const { nets, unresolved } = settlementOutcome(players, oneToOne, "organizer");
    expect(nets.filter((p) => p.playerId === ORGANIZER_COLLECTOR)).toHaveLength(1);
    expect(netOf(nets, ORGANIZER_COLLECTOR)).toBe(50_000 - 80_000);
    expect(unresolved).toBe(0);
  });

  it("settles every transfer when the organizer covers the difference", () => {
    const { nets } = settlementOutcome(excess, oneToOne, "organizer");
    const balances = new Map<string, number>(nets.map((p) => [p.playerId, p.net]));
    for (const { from, to, amount } of settleTransfers(nets)) {
      balances.set(from, (balances.get(from) ?? 0) + amount);
      balances.set(to, (balances.get(to) ?? 0) - amount);
    }
    expect([...balances.values()].every((b) => b === 0)).toBe(true);
  });

  it("reports the difference when unhandled or undecided", () => {
    for (const handling of ["ignore", undefined] as const) {
      const { nets, unresolved } = settlementOutcome(excess, oneToOne, handling);
      expect(unresolved).toBe(30_000);
      expect(netOf(nets, "a")).toBe(50_000);
    }
  });

  it("pays as far as it can when unhandled", () => {
    const { nets } = settlementOutcome(excess, oneToOne, "ignore");
    expect(settleTransfers(nets)).toEqual([{ from: "b", to: "a", amount: 20_000 }]);
  });

  it("adds up to exactly 0 for any books once handled", () => {
    const buys = fc.array(
      fc.tuple(fc.integer({ min: 1, max: 5000 }), fc.integer({ min: 0, max: 5000 })),
      { minLength: 1, maxLength: 9 },
    );
    fc.assert(
      fc.property(
        buys,
        ratios,
        fc.constantFrom("split", "organizer") as fc.Arbitrary<"split">,
        (rows, ratio, handling) => {
          // The first player is the organizer, so both playing and covering are exercised
          const players = rows.map(([bought, out], i) =>
            ledger(i === 0 ? ORGANIZER_COLLECTOR : `p${i}`, bought, out),
          );
          const { nets, unresolved } = settlementOutcome(players, ratio, handling);
          expect(sum(nets.map((p) => p.net))).toBe(0);
          expect(unresolved).toBe(0);
          expect(new Set(nets.map((p) => p.playerId)).size).toBe(nets.length);
        },
      ),
    );
  });
});

describe("attributeInsurance", () => {
  const net = (playerId: string, amount: number): PlayerNet => ({ playerId, net: cents(amount) });
  const nets = [net("a", 500), net("b", -800), net(INSURANCE_PLAYER_ID, 300)];

  it("goes to the organizer by default", () => {
    expect(attributeInsurance(nets, undefined)).toEqual({
      nets: [net("a", 500), net("b", -800), net(ORGANIZER_COLLECTOR, 300)],
      insuranceNet: 300,
      ownerId: ORGANIZER_COLLECTOR,
    });
  });

  it("adds to an organizer row that is already covering a difference", () => {
    const covered = [...nets, net(ORGANIZER_COLLECTOR, -100)];
    const result = attributeInsurance(covered, undefined);
    expect(result.nets).toContainEqual(net(ORGANIZER_COLLECTOR, 200));
  });

  it("adds to a chosen player's result", () => {
    expect(attributeInsurance(nets, "b").nets).toEqual([net("a", 500), net("b", -500)]);
  });

  it("stays on its own row when listed separately", () => {
    const result = attributeInsurance(nets, INSURANCE_PLAYER_ID);
    expect(result.nets).toEqual(nets);
    expect(result.ownerId).toBe(INSURANCE_PLAYER_ID);
  });

  it("falls back to the organizer when the chosen player has gone", () => {
    expect(attributeInsurance(nets, "gone").ownerId).toBe(ORGANIZER_COLLECTOR);
  });

  it("adds no row when insurance broke even", () => {
    const flat = [net("a", 100), net("b", -100), net(INSURANCE_PLAYER_ID, 0)];
    expect(attributeInsurance(flat, undefined).nets).toEqual([net("a", 100), net("b", -100)]);
  });

  it("keeps results adding up to zero whoever takes it", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5000, max: 5000 }),
        fc.integer({ min: -5000, max: 5000 }),
        fc.constantFrom<string | undefined>(undefined, "a", "b", INSURANCE_PLAYER_ID),
        (a, insurance, owner) => {
          const all = [net("a", a), net("b", -a - insurance), net(INSURANCE_PLAYER_ID, insurance)];
          const total = attributeInsurance(all, owner).nets.reduce((sum, p) => sum + p.net, 0);
          expect(total).toBe(0);
        },
      ),
    );
  });
});
