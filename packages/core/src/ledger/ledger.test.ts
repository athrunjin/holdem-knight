import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  type ChipEvent,
  INSURANCE_PLAYER_ID,
  type InsuranceBuyEvent,
  type InsuranceSettleEvent,
  type LedgerEvent,
  type Player,
  RAKE_PLAYER_ID,
  type RakeEvent,
  type ReversalEvent,
  type StackSetEvent,
} from "../domain";
import { RULE_30 } from "../insurance";
import { cents } from "../money";
import {
  activeChipEvents,
  adjustHands,
  chipsToCents,
  gameRecord,
  hasPlayerEvents,
  insuranceRecords,
  insuranceSeatChange,
  insuranceTopUp,
  lastBuyChips,
  latestCashOut,
  ledgerTotals,
  nextBuyType,
  rakeChips,
  rakeRecords,
  recentPlayers,
  soleBuyIn,
  summarizeByPlayer,
  undoInsurance,
  undoInsuranceHand,
} from "./ledger";

const base = { organizerId: "me", gameId: "g1", occurredAt: 1 };

const chip = (id: string, type: ChipEvent["type"], playerId: string, chips: number): ChipEvent => ({
  ...base,
  id,
  type,
  playerId,
  chips,
});

const reversal = (id: string, reversedEventId: string): ReversalEvent => ({
  ...base,
  id,
  type: "reversal",
  reversedEventId,
});

const rake = (id: string, chips: number): RakeEvent => ({
  ...base,
  id,
  type: "rake",
  playerId: RAKE_PLAYER_ID,
  chips,
});

describe("rake", () => {
  it("adds up the rake still in effect", () => {
    const events = [rake("1", 120), rake("2", 30), reversal("r", "2"), rake("3", 50)];
    expect(rakeChips(events)).toBe(170);
    expect(rakeRecords(events).map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("is a seat that has left with the rake and bought nothing", () => {
    const events = [chip("1", "buy_in", "a", 1000), rake("2", 100)];
    expect(summarizeByPlayer(events)).toContainEqual({
      playerId: RAKE_PLAYER_ID,
      boughtChips: 0,
      cashedOutChips: 100,
      seated: false,
      stackChips: 0,
      netChips: 100,
    });
  });

  it("balances the table once the players' stacks show it gone", () => {
    const events: LedgerEvent[] = [
      chip("1", "buy_in", "a", 1000),
      chip("2", "buy_in", "b", 1000),
      { ...rake("3", 100), occurredAt: 2 },
      { ...base, occurredAt: 3, id: "4", type: "stack_set", playerId: "a", chips: 1900 },
      { ...base, occurredAt: 3, id: "5", type: "stack_set", playerId: "b", chips: 0 },
    ];
    expect(ledgerTotals(summarizeByPlayer(events)).balanceChips).toBe(0);
  });

  it("takes a total typed lower as a change below 0", () => {
    const events = [rake("1", 120), rake("2", -20)];
    expect(rakeChips(events)).toBe(100);
    expect(summarizeByPlayer(events)).toContainEqual(
      expect.objectContaining({ playerId: RAKE_PLAYER_ID, netChips: 100 }),
    );
  });

  it("leaves no seat once every rake is taken back", () => {
    const events = [chip("1", "buy_in", "a", 1000), rake("2", 100), reversal("r", "2")];
    expect(summarizeByPlayer(events).map((p) => p.playerId)).toEqual(["a"]);
  });

  it("never moves a player's stack", () => {
    const events = [chip("1", "buy_in", "a", 1000), rake("2", 100)];
    expect(summarizeByPlayer(events)[0]?.stackChips).toBe(1000);
  });
});

describe("summarizeByPlayer", () => {
  it("adds up buy-ins, rebuys and cash-outs, ordered by first buy-in", () => {
    const events = [
      chip("1", "buy_in", "a", 1000),
      chip("2", "buy_in", "b", 500),
      chip("3", "rebuy", "a", 200),
      chip("4", "cash_out", "b", 800),
    ];
    expect(summarizeByPlayer(events)).toEqual([
      {
        playerId: "a",
        boughtChips: 1200,
        cashedOutChips: 0,
        seated: true,
        stackChips: 1200,
        netChips: 0,
      },
      {
        playerId: "b",
        boughtChips: 500,
        cashedOutChips: 800,
        seated: false,
        stackChips: 0,
        netChips: 300,
      },
    ]);
  });

  it("seats a player again on a rebuy after cashing out", () => {
    const events = [
      chip("1", "buy_in", "a", 1000),
      chip("2", "cash_out", "a", 0),
      chip("3", "rebuy", "a", 500),
    ];
    expect(summarizeByPlayer(events)[0]?.seated).toBe(true);
  });

  it("ignores reversed events and drops fully reversed players", () => {
    const events = [chip("1", "buy_in", "a", 1000), reversal("2", "1")];
    expect(summarizeByPlayer(events)).toEqual([]);
  });

  it("returns the books to their state before an event once it is reversed", () => {
    const anyEvent = fc.record({
      type: fc.constantFrom<ChipEvent["type"]>("buy_in", "rebuy", "cash_out"),
      playerId: fc.constantFrom("a", "b", "c"),
      chips: fc.integer({ min: 0, max: 1_000_000 }),
    });
    fc.assert(
      fc.property(fc.array(anyEvent), anyEvent, (history, last) => {
        const before: LedgerEvent[] = history.map((e, i) => ({ ...base, ...e, id: `e${i}` }));
        const event = { ...base, ...last, id: "last" };
        const after = [...before, event, reversal("r", "last")];
        // Stacks are left out: returning after a cash-out keeps the chips left with
        const books = (events: readonly LedgerEvent[]) =>
          summarizeByPlayer(events).map(({ playerId, boughtChips, cashedOutChips, seated }) => ({
            playerId,
            boughtChips,
            cashedOutChips,
            seated,
          }));
        expect(books(after)).toEqual(books(before));
      }),
    );
  });
});

describe("activeChipEvents", () => {
  it("filters out reversals and reversed events, keeping the order", () => {
    const kept = chip("2", "rebuy", "a", 200);
    const events = [chip("1", "buy_in", "a", 1000), kept, reversal("3", "1")];
    expect(activeChipEvents(events)).toEqual([kept]);
  });
});

describe("ledgerTotals", () => {
  it("adds up totals and the table balance", () => {
    const players = summarizeByPlayer([
      chip("1", "buy_in", "a", 1000),
      chip("2", "buy_in", "b", 500),
      chip("3", "cash_out", "b", 300),
    ]);
    expect(ledgerTotals(players)).toEqual({
      boughtChips: 1500,
      cashedOutChips: 300,
      balanceChips: -200,
    });
  });
});

describe("nextBuyType", () => {
  it("treats the first as a buy-in and later ones as rebuys", () => {
    const events = [chip("1", "buy_in", "a", 1000)];
    expect(nextBuyType(events, "b")).toBe("buy_in");
    expect(nextBuyType(events, "a")).toBe("rebuy");
  });

  it("still treats the next as a buy-in after the only one is undone", () => {
    const events = [chip("1", "buy_in", "a", 1000), reversal("2", "1")];
    expect(nextBuyType(events, "a")).toBe("buy_in");
  });
});

describe("lastBuyChips", () => {
  it("takes the latest buy not undone, skipping cash-outs", () => {
    const events = [
      chip("1", "buy_in", "a", 1000),
      chip("2", "rebuy", "a", 500),
      chip("3", "cash_out", "a", 100),
      chip("4", "rebuy", "b", 300),
      reversal("5", "4"),
    ];
    expect(lastBuyChips(events)).toBe(500);
    expect(lastBuyChips([])).toBeUndefined();
  });
});

describe("chipsToCents", () => {
  it("converts at the ratio and rounds to the cent", () => {
    expect(chipsToCents(1000, { chips: 100, amount: cents(100) })).toBe(1000);
    expect(chipsToCents(1, { chips: 3, amount: cents(100) })).toBe(33);
    expect(chipsToCents(2, { chips: 3, amount: cents(100) })).toBe(67);
  });
});

describe("adjustHands", () => {
  const hand = 200;

  it("records buy_in for a first purchase", () => {
    expect(adjustHands([], "a", hand, { to: 2 })).toEqual({
      reversedEventIds: [],
      buy: { type: "buy_in", chips: 400 },
    });
  });

  it("records a rebuy for the difference on an increase", () => {
    const events = [chip("1", "buy_in", "a", 200)];
    expect(adjustHands(events, "a", hand, { by: 1 }).buy).toEqual({ type: "rebuy", chips: 200 });
    expect(adjustHands(events, "a", hand, { to: 4 }).buy).toEqual({ type: "rebuy", chips: 600 });
  });

  it("reverses the latest rebuy on a decrease", () => {
    const events = [chip("1", "buy_in", "a", 200), chip("2", "rebuy", "a", 200)];
    expect(adjustHands(events, "a", hand, { by: -1 })).toEqual({ reversedEventIds: ["2"] });
  });

  it("records the difference again when the reversal takes off too much", () => {
    const events = [chip("1", "buy_in", "a", 200), chip("2", "rebuy", "a", 600)];
    expect(adjustHands(events, "a", hand, { to: 2 })).toEqual({
      reversedEventIds: ["2"],
      buy: { type: "rebuy", chips: 200 },
    });
  });

  it("keeps buy_in when the first buy-in is reversed too", () => {
    const events = [chip("1", "buy_in", "a", 600)];
    expect(adjustHands(events, "a", hand, { to: 1 })).toEqual({
      reversedEventIds: ["1"],
      buy: { type: "buy_in", chips: 200 },
    });
  });

  it("keeps at least 1 hand and appends nothing when unchanged", () => {
    const events = [chip("1", "buy_in", "a", 200)];
    expect(adjustHands(events, "a", hand, { by: -1 })).toEqual({ reversedEventIds: [] });
    expect(adjustHands(events, "a", hand, { to: 1 })).toEqual({ reversedEventIds: [] });
  });

  it("skips undone records and other players", () => {
    const events = [
      chip("1", "buy_in", "a", 200),
      chip("2", "rebuy", "a", 200),
      reversal("r", "2"),
      chip("3", "buy_in", "b", 200),
    ];
    expect(adjustHands(events, "a", hand, { to: 3 }).buy?.chips).toBe(400);
  });

  it("reaches the target hands after any adjustment", () => {
    const hands = fc.integer({ min: 1, max: 20 });
    fc.assert(
      fc.property(fc.array(hands, { minLength: 1, maxLength: 10 }), hands, (buys, target) => {
        const events: LedgerEvent[] = buys.map((n, i) =>
          chip(`e${i}`, i === 0 ? "buy_in" : "rebuy", "a", n * hand),
        );
        const { reversedEventIds, buy } = adjustHands(events, "a", hand, { to: target });
        const next: LedgerEvent[] = [
          ...events,
          ...reversedEventIds.map((id) => reversal(`r-${id}`, id)),
          ...(buy ? [chip("new", buy.type, "a", buy.chips)] : []),
        ];
        expect(summarizeByPlayer(next)[0]?.boughtChips).toBe(target * hand);
      }),
    );
  });
});

describe("adjustHands with a hand bought for a premium", () => {
  it("never takes back the hand an insurance hand bought", () => {
    const events = [
      chip("1", "buy_in", "a", 200),
      { ...chip("2", "rebuy", "a", 200), handId: "h1" },
    ];
    expect(adjustHands(events, "a", 200, { to: 1 })).toEqual({ reversedEventIds: [] });
    const more = [...events, chip("3", "rebuy", "a", 200)];
    expect(adjustHands(more, "a", 200, { to: 1 })).toEqual({ reversedEventIds: ["3"] });
    // A first buy-in of two hands cut to one is recorded again as a buy-in
    const two = [chip("1", "buy_in", "a", 400), { ...chip("2", "rebuy", "a", 200), handId: "h1" }];
    expect(adjustHands(two, "a", 200, { to: 2 })).toEqual({
      reversedEventIds: ["1"],
      buy: { type: "buy_in", chips: 200 },
    });
  });
});

describe("live stacks", () => {
  const at = (occurredAt: number, event: LedgerEvent): LedgerEvent => ({ ...event, occurredAt });
  const stackSet = (
    id: string,
    chips: number,
    occurredAt: number,
    playerId = "a",
  ): LedgerEvent => ({
    ...base,
    id,
    type: "stack_set",
    playerId,
    chips,
    occurredAt,
  });
  const stackOf = (events: readonly LedgerEvent[]) => summarizeByPlayer(events)[0]?.stackChips;

  it("starts at the amount bought and adds buys", () => {
    const events = [at(1, chip("1", "buy_in", "a", 500)), at(2, chip("2", "rebuy", "a", 500))];
    expect(summarizeByPlayer(events)[0]).toMatchObject({ stackChips: 1000, netChips: 0 });
  });

  it("uses a typed stack and shows the win or loss", () => {
    const events = [at(1, chip("1", "buy_in", "a", 500)), stackSet("s", 700, 2)];
    expect(summarizeByPlayer(events)[0]).toMatchObject({ stackChips: 700, netChips: 200 });
  });

  it("adds a hand to a typed stack: 700 becomes 1200", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 500)),
      stackSet("s", 700, 2),
      at(3, chip("2", "rebuy", "a", 500)),
    ];
    expect(stackOf(events)).toBe(1200);
  });

  it("removes a hand from a typed stack, even one bought earlier: 700 becomes 200", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 500)),
      at(2, chip("2", "rebuy", "a", 500)),
      stackSet("s", 700, 3),
      at(4, reversal("r", "2")),
    ];
    expect(stackOf(events)).toBe(200);
  });

  it("never goes below 0", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 500)),
      at(2, chip("2", "rebuy", "a", 500)),
      stackSet("s", 100, 3),
      at(4, reversal("r", "2")),
    ];
    expect(stackOf(events)).toBe(0);
  });

  it("treats a reversal and its replacement buy as one change", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 1500)),
      stackSet("s", 700, 2),
      at(3, reversal("r", "1")),
      at(3, chip("2", "buy_in", "a", 1000)),
    ];
    expect(stackOf(events)).toBe(200);
  });

  it("restores the previous stack when a typed stack is undone", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 500)),
      stackSet("s", 700, 2),
      at(3, chip("2", "rebuy", "a", 500)),
      at(4, reversal("r", "s")),
    ];
    expect(stackOf(events)).toBe(1000);
  });

  it("is 0 after leaving and back to the chips left with after returning", () => {
    const left = [at(1, chip("1", "buy_in", "a", 500)), at(2, chip("2", "cash_out", "a", 600))];
    expect(summarizeByPlayer(left)[0]).toMatchObject({ stackChips: 0, netChips: 100 });
    expect(summarizeByPlayer([...left, at(3, reversal("r", "2"))])[0]).toMatchObject({
      stackChips: 600,
      netChips: 100,
    });
  });

  it("counts earlier cash-outs in the win or loss after sitting back down", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 500)),
      at(2, chip("2", "cash_out", "a", 800)),
      at(3, chip("3", "rebuy", "a", 500)),
    ];
    expect(summarizeByPlayer(events)[0]).toMatchObject({ stackChips: 500, netChips: 300 });
  });

  it("does not treat a typed stack as a buy or a cash-out", () => {
    const events = [at(1, chip("1", "buy_in", "a", 500)), stackSet("s", 0, 2)];
    expect(summarizeByPlayer(events)[0]).toMatchObject({ boughtChips: 500, seated: true });
  });

  it("shows an imbalance until wins and losses are both entered", () => {
    const buys = [at(1, chip("1", "buy_in", "a", 500)), at(1, chip("2", "buy_in", "b", 500))];
    const win = [...buys, stackSet("s1", 700, 2)];
    expect(ledgerTotals(summarizeByPlayer(win)).balanceChips).toBe(200);
    const both = [...win, stackSet("s2", 300, 3, "b")];
    expect(ledgerTotals(summarizeByPlayer(both)).balanceChips).toBe(0);
  });
});

describe("latestCashOut", () => {
  it("finds the latest cash-out still in effect", () => {
    const events = [
      chip("1", "buy_in", "a", 500),
      chip("2", "cash_out", "a", 600),
      reversal("r", "2"),
      chip("3", "cash_out", "a", 700),
      chip("4", "cash_out", "b", 100),
    ];
    expect(latestCashOut(events, "a")?.id).toBe("3");
  });

  it("returning brings back the chips left with and seats the player", () => {
    const left = [
      { ...chip("1", "buy_in", "a", 500), occurredAt: 1 },
      { ...chip("2", "cash_out", "a", 1300), occurredAt: 2 },
    ];
    const out = latestCashOut(left, "a");
    if (!out) throw new Error("missing cash-out");
    const back = [...left, { ...reversal("r", out.id), occurredAt: 3 }];
    expect(summarizeByPlayer(back)[0]).toMatchObject({
      seated: true,
      cashedOutChips: 0,
      stackChips: 1300,
      netChips: 800,
    });
  });
});

describe("soleBuyIn", () => {
  it("finds a buy-in that is the only record", () => {
    expect(soleBuyIn([chip("1", "buy_in", "a", 500)], "a")?.id).toBe("1");
  });

  it("ignores hands that were added and removed again", () => {
    const events = [
      chip("1", "buy_in", "a", 500),
      chip("2", "rebuy", "a", 500),
      reversal("r", "2"),
    ];
    expect(soleBuyIn(events, "a")?.id).toBe("1");
  });

  it("refuses a player with other records", () => {
    const rebuy = [chip("1", "buy_in", "a", 500), chip("2", "rebuy", "a", 500)];
    const left = [chip("1", "buy_in", "a", 500), chip("2", "cash_out", "a", 500)];
    const typed: LedgerEvent[] = [
      chip("1", "buy_in", "a", 500),
      { ...base, id: "s", type: "stack_set", playerId: "a", chips: 700 },
    ];
    expect(soleBuyIn(rebuy, "a")).toBeUndefined();
    expect(soleBuyIn(left, "a")).toBeUndefined();
    expect(soleBuyIn(typed, "a")).toBeUndefined();
    expect(soleBuyIn([], "a")).toBeUndefined();
  });
});

describe("gameRecord", () => {
  const at = (occurredAt: number, event: LedgerEvent): LedgerEvent => ({ ...event, occurredAt });
  const kinds = (events: readonly LedgerEvent[]) =>
    gameRecord(events).map(({ kind, chips }) => `${kind} ${chips}`);

  it("lists rake and taking it back", () => {
    const events = [at(1, rake("1", 120)), at(2, reversal("r", "1"))];
    expect(kinds(events)).toEqual(["rake 120", "rake_undo 120"]);
  });

  it("lists events oldest first", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 500)),
      at(2, chip("2", "rebuy", "a", 500)),
      at(3, chip("3", "cash_out", "a", 900)),
    ];
    expect(kinds(events)).toEqual(["buy_in 500", "rebuy 500", "cash_out 900"]);
  });

  it("keeps the original row and adds one for a reduced hand", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 500)),
      at(2, chip("2", "rebuy", "a", 500)),
      at(3, reversal("r", "2")),
    ];
    expect(kinds(events)).toEqual(["buy_in 500", "rebuy 500", "reduce 500"]);
  });

  it("reads a reversal and its replacement buy as one reduction", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 1500)),
      at(2, reversal("r", "1")),
      at(2, chip("2", "buy_in", "a", 500)),
    ];
    expect(kinds(events)).toEqual(["buy_in 1500", "reduce 1000"]);
  });

  it("names a reversed cash-out as a return", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 500)),
      at(2, chip("2", "cash_out", "a", 1300)),
      at(3, reversal("r", "2")),
    ];
    expect(kinds(events)).toEqual(["buy_in 500", "cash_out 1300", "return 1300"]);
  });

  it("names a fully reversed player as removed", () => {
    const events = [at(1, chip("1", "buy_in", "a", 500)), at(2, reversal("r", "1"))];
    expect(kinds(events)).toEqual(["buy_in 500", "remove 500"]);
  });

  it("shows typed stacks and undone ones from older games", () => {
    const stack: LedgerEvent = {
      ...base,
      id: "s",
      type: "stack_set",
      playerId: "a",
      chips: 700,
      occurredAt: 2,
    };
    const events = [at(1, chip("1", "buy_in", "a", 500)), stack, at(3, reversal("r", "s"))];
    expect(kinds(events)).toEqual(["buy_in 500", "stack_set 700", "stack_undo 700"]);
  });

  it("keeps players apart when they share a timestamp", () => {
    const events = [
      at(1, chip("1", "buy_in", "a", 500)),
      at(1, chip("2", "buy_in", "b", 500)),
      at(2, chip("3", "cash_out", "a", 500)),
      at(2, chip("4", "cash_out", "b", 500)),
    ];
    expect(gameRecord(events).map((e) => `${e.playerId} ${e.kind}`)).toEqual([
      "a buy_in",
      "b buy_in",
      "a cash_out",
      "b cash_out",
    ]);
  });
});

describe("insurance", () => {
  const seat = INSURANCE_PLAYER_ID;
  const buy = (id: string, playerId: string, chips: number, payoutChips: number) =>
    ({
      ...base,
      id,
      type: "insurance_buy",
      playerId,
      chips,
      payoutChips,
      outs: 8,
      oddsHundredths: 350,
      street: "river",
    }) satisfies InsuranceBuyEvent;
  const settle = (id: string, purchaseId: string, playerId: string, chips: number) =>
    ({
      ...base,
      id,
      type: "insurance_settle",
      purchaseId,
      playerId,
      hit: chips > 0,
      chips,
    }) satisfies InsuranceSettleEvent;
  const later = <T extends LedgerEvent>(event: T, occurredAt: number): T => ({
    ...event,
    occurredAt,
  });
  const stacks = (events: readonly LedgerEvent[]) =>
    Object.fromEntries(summarizeByPlayer(events).map((p) => [p.playerId, p.stackChips]));

  const start = [chip("s", "buy_in", seat, 1000), chip("a", "buy_in", "a", 1000)];

  it("moves no chips until the card is dealt", () => {
    expect(stacks([...start, later(buy("b", "a", 100, 350), 2)])).toEqual({
      insurance: 1000,
      a: 1000,
    });
  });

  it("moves only the seat when the card is dealt", () => {
    const bought = [...start, later(buy("b", "a", 100, 350), 2)];
    expect(stacks([...bought, later(settle("h", "b", "a", 350), 3)])).toEqual({
      insurance: 750,
      a: 1000,
    });
    expect(stacks([...bought, later(settle("m", "b", "a", 0), 3)])).toEqual({
      insurance: 1100,
      a: 1000,
    });
  });

  it("restores the seat when a result is undone", () => {
    const events = [
      ...start,
      later(buy("b", "a", 100, 350), 2),
      later(settle("h", "b", "a", 350), 3),
    ];
    const undone = [...events, later(reversal("r1", "h"), 4), later(reversal("r2", "b"), 4)];
    expect(stacks(undone)).toEqual({ insurance: 1000, a: 1000 });
    expect(insuranceRecords(undone)).toEqual([]);
  });

  it("changes the seat by exactly its results and never a player's stack", () => {
    const purchase = fc.record({
      premium: fc.integer({ min: 1, max: 50 }),
      payout: fc.integer({ min: 1, max: 900 }),
      hit: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(purchase, { maxLength: 8 }), (purchases) => {
        const events: LedgerEvent[] = [
          chip("s", "buy_in", seat, 100_000),
          chip("a", "buy_in", "a", 1000),
        ];
        purchases.forEach(({ premium, payout, hit }, i) => {
          events.push(later(buy(`b${i}`, "a", premium, payout), i * 2 + 2));
          events.push(later(settle(`h${i}`, `b${i}`, "a", hit ? payout : 0), i * 2 + 3));
        });
        const net = purchases.reduce(
          (total, { premium, payout, hit }) => total + premium - (hit ? payout : 0),
          0,
        );
        expect(stacks(events)).toEqual({ insurance: 100_000 + net, a: 1000 });
      }),
    );
  });

  it("leaves a typed stack alone", () => {
    const events = [
      ...start,
      later({ ...base, id: "t", type: "stack_set", playerId: "a", chips: 30 }, 2),
      later(buy("b", "a", 100, 350), 3),
      later(settle("h", "b", "a", 350), 4),
    ];
    expect(stacks(events).a).toBe(30);
  });

  it("reports purchases with their results", () => {
    const events = [
      ...start,
      later(buy("b1", "a", 100, 350), 2),
      later(settle("h", "b1", "a", 350), 3),
      later(buy("b2", "a", 50, 175), 4),
    ];
    expect(insuranceRecords(events).map((r) => [r.purchase.id, r.status, r.settleId])).toEqual([
      ["b1", "hit", "h"],
      ["b2", "pending", undefined],
    ]);
  });

  it("names insurance in the game record", () => {
    const events = [
      ...start,
      later(buy("b1", "a", 100, 350), 2),
      later(settle("h", "b1", "a", 350), 3),
      later(buy("b2", "a", 50, 175), 4),
      later(settle("m", "b2", "a", 0), 5),
      later(reversal("r", "m"), 6),
    ];
    expect(
      gameRecord(events)
        .slice(2)
        .map((e) => [e.kind, e.chips]),
    ).toEqual([
      ["insurance_buy", 100],
      ["insurance_hit", 350],
      ["insurance_buy", 50],
      ["insurance_miss", 0],
      ["insurance_undo", 0],
    ]);
  });

  it("stops a player who has bought insurance being removed as a mistake", () => {
    const events = [chip("a", "buy_in", "a", 1000), later(buy("b", "a", 100, 350), 2)];
    expect(soleBuyIn(events, "a")).toBeUndefined();
  });

  it("adds whole hands only when the seat cannot pay", () => {
    expect(insuranceTopUp(1000, 800, 500)).toBe(0);
    expect(insuranceTopUp(1000, 1000, 500)).toBe(0);
    expect(insuranceTopUp(1000, 1001, 500)).toBe(500);
    expect(insuranceTopUp(200, 1300, 500)).toBe(1500);
  });

  describe("taking insurance back", () => {
    const set = (id: string, playerId: string, chips: number, handId?: string): StackSetEvent => ({
      ...base,
      id,
      type: "stack_set",
      playerId,
      chips,
      ...(handId !== undefined && { handId }),
    });
    /** The events an undo appends: the reversals together, then the stacks that stay. */
    const undone = (events: readonly LedgerEvent[], undo: ReturnType<typeof undoInsuranceHand>) => {
      const at = Math.max(...events.map((e) => e.occurredAt)) + 1;
      return [
        ...events,
        ...undo.reversedEventIds.map((id) => later(reversal(`r-${id}-${at}`, id), at)),
        ...(undo.seatTopUpChips > 0
          ? [later(chip(`t-${at}`, "rebuy", seat, undo.seatTopUpChips), at)]
          : []),
        ...undo.keptStacks.map((k) =>
          later(set(`k-${k.playerId}-${at}`, k.playerId, k.chips), at + 1),
        ),
      ];
    };
    const table = [...start, chip("b", "buy_in", "b", 1000)];
    /** A and B all in for 1,000 each. A wins, having paid 100 for a cover that missed. */
    const hand = [
      later({ ...buy("pa", "a", 100, 350), handId: "h1" }, 10),
      later({ ...settle("sa", "pa", "a", 0), handId: "h1" }, 10),
      later(set("ha", "a", 1900, "h1"), 11),
      later(set("hb", "b", 0, "h1"), 11),
    ];
    const played = [...table, ...hand];

    it("restores every stack while nothing has changed since the hand", () => {
      expect(stacks(played)).toEqual({ insurance: 1100, a: 1900, b: 0 });
      const undo = undoInsuranceHand(played, "h1", 1000);
      expect(undo.keptPlayerIds).toEqual([]);
      expect(stacks(undone(played, undo))).toEqual({ insurance: 1000, a: 1000, b: 1000 });
    });

    describe("with the seat's chips set by the hand", () => {
      const seatStart = [chip("s0", "buy_in", seat, 3000), later(set("s1", seat, 100), 2)];
      const players = [chip("a", "buy_in", "a", 1000), chip("b", "buy_in", "b", 1000)];
      /** A cover of 50 that pays 1,000, with what the summary wrote for the seat around it. */
      const paid = (extra: readonly LedgerEvent[], chips: number) => [
        ...seatStart,
        ...players,
        ...extra.map((e) => later(e, 10)),
        later({ ...buy("pa", "a", 50, 1000), handId: "h1" }, 10),
        later({ ...settle("sa", "pa", "a", 1000), handId: "h1" }, 10),
        later(set("hs", seat, chips, "h1"), 11),
      ];
      const seatAfterUndo = (events: readonly LedgerEvent[]) =>
        stacks(undone(events, undoInsuranceHand(events, "h1", 1000))).insurance;

      it("gives back what the seat had, though it stopped at 0 in between", () => {
        // Too few Buy-ins to pay: 100 + 50 - 1,000 stops at 0, then the chips are set to 150
        const short = paid([], 150);
        expect(stacks(short).insurance).toBe(150);
        expect(seatAfterUndo(short)).toBe(100);
        expect(undoInsuranceHand(short, "h1", 1000).seatTopUpChips).toBe(0);
      });

      it("leaves Buy-ins put right with the hand as a record, and moves no chips by them", () => {
        const more = paid([chip("x1", "rebuy", seat, 1000), chip("x2", "rebuy", seat, 1000)], 150);
        expect(seatAfterUndo(more)).toBe(100);
        const fewer = paid([reversal("x3", "s0"), chip("x4", "buy_in", seat, 2000)], 150);
        expect(seatAfterUndo(fewer)).toBe(100);
      });

      it("keeps what later hands won or lost the seat", () => {
        const later2 = [
          ...paid([], 150),
          later({ ...buy("pb", "b", 70, 500), handId: "h2" }, 20),
          later({ ...settle("sb", "pb", "b", 0), handId: "h2" }, 20),
        ];
        expect(stacks(later2).insurance).toBe(220);
        expect(seatAfterUndo(later2)).toBe(170);
      });

      it("leaves the seat's chips alone once they were counted again", () => {
        const counted = [...paid([], 150), later(set("c", seat, 400), 30)];
        expect(undoInsuranceHand(counted, "h1", 1000).keptStacks).toEqual([]);
      });
    });

    it("does nothing more when asked a second time", () => {
      const once = undone(played, undoInsuranceHand(played, "h1", 1000));
      expect(undoInsuranceHand(once, "h1", 1000).reversedEventIds).toEqual([]);
      const single = [
        ...start,
        later(buy("p", "a", 100, 350), 2),
        later(settle("m", "p", "a", 0), 3),
      ];
      const [record] = insuranceRecords(single);
      if (!record) throw new Error("no record");
      const back = undone(single, undoInsurance(single, record, 1000));
      expect(stacks(back)).toEqual({ insurance: 1000, a: 1000 });
      expect(undoInsurance(back, record, 1000).reversedEventIds).toEqual([]);
    });

    it("leaves a stack typed or bought since the hand as it is, and still takes the insurance back", () => {
      const since = [
        ...played,
        later(chip("b2", "rebuy", "b", 1000), 20),
        later(set("ta", "a", 2500), 21),
        later(set("tb", "b", 400), 22),
      ];
      const undo = undoInsuranceHand(since, "h1", 1000);
      expect(undo.keptPlayerIds).toEqual(["a", "b"]);
      expect(stacks(undone(since, undo))).toEqual({ insurance: 1000, a: 2500, b: 400 });
    });

    it("takes back a hand bought for a premium without moving a stack typed since", () => {
      // B lost the pot and bought a hand to pay 100 for a cover that missed
      const short = [
        ...table,
        later({ ...chip("rb", "rebuy", "b", 1000), handId: "h2" }, 10),
        later({ ...buy("pb", "b", 100, 350), handId: "h2" }, 10),
        later({ ...settle("sb", "pb", "b", 0), handId: "h2" }, 10),
        later(set("ha", "a", 2000, "h2"), 11),
        later(set("hb", "b", 900, "h2"), 11),
      ];
      expect(stacks(undone(short, undoInsuranceHand(short, "h2", 1000)))).toEqual({
        insurance: 1000,
        a: 1000,
        b: 1000,
      });
      const since = [...short, later(set("tb", "b", 400), 20)];
      const after = summarizeByPlayer(undone(since, undoInsuranceHand(since, "h2", 1000)));
      expect(after.find((p) => p.playerId === "b")).toMatchObject({
        boughtChips: 1000,
        stackChips: 400,
      });
      // A's stack was not touched after the hand, so it goes back
      expect(after.find((p) => p.playerId === "a")?.stackChips).toBe(1000);
      expect(after.find((p) => p.playerId === seat)?.stackChips).toBe(1000);
    });

    it("brings the seat back first after a settle attempt, so the change is not lost", () => {
      const out = [
        ...played,
        later(chip("oa", "cash_out", "a", 1900), 30),
        later(chip("ob", "cash_out", "b", 0), 30),
        later(chip("os", "cash_out", seat, 1100), 30),
      ];
      const after = summarizeByPlayer(undone(out, undoInsuranceHand(out, "h1", 1000)));
      expect(after.find((p) => p.playerId === seat)).toMatchObject({
        seated: true,
        stackChips: 1000,
      });
      // The players left with their chips counted, which stay
      expect(after.find((p) => p.playerId === "a")).toMatchObject({ cashedOutChips: 1900 });

      const single = [
        ...start,
        later(buy("p", "a", 100, 350), 2),
        later(settle("m", "p", "a", 0), 3),
        later(chip("os", "cash_out", seat, 1100), 30),
      ];
      const [record] = insuranceRecords(single);
      if (!record) throw new Error("no record");
      expect(stacks(undone(single, undoInsurance(single, record, 1000))).insurance).toBe(1000);
    });

    it("restores two hands undone newest first", () => {
      const second = [
        ...played,
        chip("c", "buy_in", "c", 1000),
        later(set("h2a", "a", 2900, "h2"), 21),
        later(set("h2c", "c", 0, "h2"), 21),
      ];
      const first = undone(second, undoInsuranceHand(second, "h2", 1000));
      expect(stacks(first)).toEqual({ insurance: 1100, a: 1900, b: 0, c: 1000 });
      const undo = undoInsuranceHand(first, "h1", 1000);
      expect(undo.keptPlayerIds).toEqual([]);
      const back = summarizeByPlayer(undone(first, undo));
      expect(Object.fromEntries(back.map((p) => [p.playerId, p.stackChips]))).toEqual({
        insurance: 1000,
        a: 1000,
        b: 1000,
        c: 1000,
      });
      expect(ledgerTotals(back).balanceChips).toBe(0);
    });

    it("restores a stack when the player left after the hand and came back", () => {
      const away = [
        ...played,
        later(chip("oa", "cash_out", "a", 1900), 30),
        later(reversal("ra", "oa"), 31),
      ];
      expect(stacks(undone(away, undoInsuranceHand(away, "h1", 1000))).a).toBe(1000);
    });

    it("has the seat buy hands to give back more than it holds", () => {
      // A hit since has emptied the seat, which then gives back a premium of 100
      const emptied = [
        ...played,
        later(buy("p2", "b", 50, 1150), 20),
        later(settle("s2", "p2", "b", 1150), 21),
      ];
      expect(stacks(emptied).insurance).toBe(0);
      const undo = undoInsuranceHand(emptied, "h1", 1000);
      expect(undo.seatTopUpChips).toBe(1000);
      const seatAfter = summarizeByPlayer(undone(emptied, undo)).find((p) => p.playerId === seat);
      // Bought 2,000 and holding 900: down the 1,100 it paid out less the premium it kept
      expect(seatAfter).toMatchObject({ boughtChips: 2000, stackChips: 900, netChips: -1100 });
    });

    it("restores any hand exactly when undone at once", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5000 }),
          fc.integer({ min: 0, max: 5000 }),
          fc.integer({ min: 1, max: 500 }),
          // No more than the seat holds: it is topped up before it pays more
          fc.integer({ min: 0, max: 1000 }),
          fc.boolean(),
          (endA, endB, premium, payout, shortB) => {
            const events = [
              ...table,
              ...(shortB ? [later({ ...chip("rb", "rebuy", "b", 1000), handId: "h" }, 10)] : []),
              later({ ...buy("px", "a", premium, payout), handId: "h" }, 10),
              later({ ...settle("sx", "px", "a", payout), handId: "h" }, 10),
              later(set("ha", "a", endA, "h"), 11),
              later(set("hb", "b", endB, "h"), 11),
            ];
            const back = summarizeByPlayer(undone(events, undoInsuranceHand(events, "h", 1000)));
            expect(back).toEqual(summarizeByPlayer(table));
          },
        ),
      );
    });
  });

  describe("insuranceSeatChange", () => {
    const on = { insurance: RULE_30, handChips: 1000 };
    const off = { handChips: 1000 };

    it("seats one hand when insurance turns on", () => {
      expect(insuranceSeatChange(on, [])).toEqual({ reversedEventIds: [], buyInChips: 1000 });
    });

    it("does nothing once seated at the right size", () => {
      expect(insuranceSeatChange(on, start)).toEqual({ reversedEventIds: [] });
    });

    it("resizes the seat if the hand size changed before play", () => {
      const change = insuranceSeatChange({ ...on, handChips: 2000 }, start);
      expect(change).toEqual({ reversedEventIds: ["s"], buyInChips: 2000 });
    });

    it("removes the seat when insurance turns off", () => {
      expect(insuranceSeatChange(off, start)).toEqual({ reversedEventIds: ["s"] });
    });

    it("leaves a seat that has sold insurance alone", () => {
      const events = [...start, later(buy("b", "a", 100, 350), 2)];
      expect(insuranceSeatChange(off, events)).toEqual({ reversedEventIds: [] });
    });
  });

  it("does not count the insurance seat as the game having started", () => {
    expect(hasPlayerEvents([chip("s", "buy_in", seat, 1000)])).toBe(false);
    expect(hasPlayerEvents([chip("s", "buy_in", seat, 1000), reversal("r", "s")])).toBe(false);
    expect(hasPlayerEvents(start)).toBe(true);
  });
});

describe("recentPlayers", () => {
  const person = (id: string, initials: string): Player => ({
    id,
    organizerId: "me",
    name: id,
    initials,
    createdAt: 1,
  });
  const ace = person("Ace", "ace");
  const ben = person("Ben", "ben");
  const zoe = person("Zoe", "zoe");
  const kim = person("Kim", "kim");
  const everyone = [ace, ben, zoe, kim];
  const buyIn = (id: string, playerId: string) => chip(id, "buy_in", playerId, 100);
  const names = (games: LedgerEvent[][], limit = 12) =>
    recentPlayers(games, everyone, limit).map((p) => p.name);

  it("puts the newest game first, and one game's players in alphabetical order", () => {
    const newest = [buyIn("1", "Zoe"), buyIn("2", "Ace")];
    const older = [buyIn("3", "Kim"), buyIn("4", "Ben")];
    expect(names([newest, older])).toEqual(["Ace", "Zoe", "Ben", "Kim"]);
  });

  it("lists a player once, at their newest game", () => {
    const newest = [buyIn("1", "Zoe")];
    const older = [buyIn("2", "Ace"), buyIn("3", "Zoe")];
    expect(names([newest, older])).toEqual(["Zoe", "Ace"]);
  });

  it("keeps to the limit", () => {
    expect(names([[buyIn("1", "Zoe"), buyIn("2", "Ace"), buyIn("3", "Ben")]], 2)).toEqual([
      "Ace",
      "Ben",
    ]);
  });

  it("leaves out the insurance seat, players taken back out and unknown players", () => {
    const game = [
      buyIn("1", INSURANCE_PLAYER_ID),
      buyIn("2", "Ace"),
      buyIn("3", "Ben"),
      reversal("4", "3"),
      buyIn("5", "deleted"),
    ];
    expect(names([game])).toEqual(["Ace"]);
  });

  it("returns each player once, at most the limit", () => {
    const game = fc.array(fc.constantFrom("Ace", "Ben", "Zoe", "Kim", "nobody"));
    fc.assert(
      fc.property(fc.array(game), fc.nat(5), (games, limit) => {
        const events = games.map((ids, g) => ids.map((id, i) => buyIn(`${g}-${i}`, id)));
        const result = recentPlayers(events, everyone, limit);
        const known = new Set(games.flat().filter((id) => id !== "nobody"));
        expect(new Set(result).size).toBe(result.length);
        expect(result.length).toBe(Math.min(limit, known.size));
      }),
    );
  });
});
