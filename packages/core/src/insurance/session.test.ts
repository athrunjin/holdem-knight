import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { InsuranceHand, InsuranceHandPlayer } from "../domain";
import { type Card, DECK, makeCard } from "./cards";
import { potTotals } from "./pots";
import { RULE_30 } from "./rules";
import {
  blankInsuranceHand,
  buyOffer,
  dealCard,
  declineOffer,
  type HandOffer,
  handOffers,
  handPotBreakdown,
  handPotEntries,
  handResult,
  handStandings,
  offersDecided,
  type PlayerHandResult,
  playerHandResults,
  playersReady,
  premiumBuyIns,
  reviseOffer,
  stakeOf,
  undoDeal,
} from "./session";

const c = (text: string): Card => {
  const [rank, suit] = text as unknown as ["2", "s"];
  return makeCard(rank, suit);
};

const player = (playerId: string, chips: number, cards: readonly string[], cover = false) =>
  ({ playerId, chips, cover, cards: cards.map(c) }) satisfies InsuranceHandPlayer;

const aces = player("a", 1000, ["As", "Ad"]);
const kings = player("k", 1000, ["Ks", "Kd"]);

const hand = (overrides: Partial<InsuranceHand> = {}): InsuranceHand => ({
  ...blankInsuranceHand({ id: "h", organizerId: "o", gameId: "g", createdAt: 1 }),
  players: [aces, kings],
  board: [c("2c"), c("7h"), c("9d"), c("3c")],
  step: "buy",
  ...overrides,
});

const offerOf = (target: InsuranceHand): HandOffer => {
  const [offer] = handOffers(target, RULE_30);
  if (!offer) throw new Error("Expected an offer");
  return offer;
};

function bought(target: InsuranceHand) {
  const offer = offerOf(target);
  if (!offer.quote.ok) throw new Error("Expected a quote");
  const { fullPot, oddsHundredths } = offer.quote;
  return buyOffer(target, offer, "p", fullPot, oddsHundredths);
}

describe("cover players", () => {
  it("stakes what the deepest of the others put in", () => {
    const cover = player("c", 0, ["Qs", "Qd"], true);
    const players = [player("a", 300, ["As", "Ad"]), player("b", 500, ["Ks", "Kd"]), cover];
    expect(stakeOf(cover, players)).toBe(500);
    expect(potTotals(handPotEntries({ players, pools: [50] }))).toEqual({
      effectiveChips: 1350,
      deadChips: 50,
      uncalledChips: 0,
    });
  });

  it("allows only one", () => {
    expect(
      playersReady([player("a", 0, ["As", "Ad"], true), player("b", 0, ["Ks", "Kd"], true)]),
    ).toBe(false);
  });
});

describe("playersReady", () => {
  it("needs two players with chips and two cards each", () => {
    expect(playersReady([aces])).toBe(false);
    expect(playersReady([aces, { ...kings, chips: 0 }])).toBe(false);
    expect(playersReady([aces, { ...kings, cards: [c("Ks")] }])).toBe(false);
    expect(playersReady([aces, kings])).toBe(true);
    expect(playersReady([aces, player("c", 0, ["Ks", "Kd"], true)])).toBe(true);
  });
});

describe("standings", () => {
  it("leaves out players still waiting for their cards", () => {
    const waiting = player("w", 1000, []);
    expect(handStandings(hand({ players: [aces, waiting] })).players).toEqual([]);
    expect(
      handStandings(hand({ players: [aces, kings, waiting] })).players.map((s) => s.playerId),
    ).toEqual(["a", "k"]);
  });
});

describe("pot breakdown", () => {
  it("splits the main pot and each side pot by who put it in, with its own leader", () => {
    const short = player("q", 300, ["Qs", "Qd"]);
    const sidePots = hand({
      players: [aces, short, kings],
      pools: [200],
      board: [c("Qc"), c("7h"), c("9d")],
    });
    expect(handPotBreakdown(sidePots)).toEqual([
      {
        amountChips: 1100,
        stakes: [
          { playerId: "a", chips: 300 },
          { playerId: "q", chips: 300 },
          { playerId: "k", chips: 300 },
        ],
        deadChips: 200,
        leaders: ["q"],
      },
      {
        amountChips: 1400,
        stakes: [
          { playerId: "a", chips: 700 },
          { playerId: "k", chips: 700 },
        ],
        deadChips: 0,
        leaders: ["a"],
      },
    ]);
  });

  it("leaves out excess nobody called", () => {
    const deep = player("d", 5000, ["Ks", "Kd"]);
    expect(handPotBreakdown(hand({ players: [aces, deep] }))).toEqual([
      {
        amountChips: 2000,
        stakes: [
          { playerId: "a", chips: 1000 },
          { playerId: "d", chips: 1000 },
        ],
        deadChips: 0,
        leaders: ["a"],
      },
    ]);
  });

  it("accounts for every contested chip", () => {
    const stack = fc.integer({ min: 1, max: 100_000 });
    fc.assert(
      fc.property(
        fc.array(stack, { minLength: 2, maxLength: 4 }),
        fc.array(stack, { maxLength: 3 }),
        (chips, pools) => {
          const holes = [
            ["As", "Ad"],
            ["Ks", "Kd"],
            ["Qs", "Qd"],
            ["Js", "Jd"],
          ];
          const players = chips.map((amount, i) => player(`p${i}`, amount, holes[i] ?? []));
          const target = hand({ players, pools });
          const pots = handPotBreakdown(target);
          const total = pots.reduce((sum, pot) => sum + pot.amountChips, 0);
          expect(total).toBe(potTotals(handPotEntries(target)).effectiveChips);
          for (const pot of pots) {
            const staked = pot.stakes.reduce((sum, s) => sum + s.chips, 0);
            expect(staked + pot.deadChips).toBe(pot.amountChips);
            expect(pot.leaders.length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });
});

describe("offers", () => {
  it("offers the leader the cards that beat them", () => {
    const offer = offerOf(hand());
    expect(offer).toMatchObject({ key: "river-0-a", street: "river" });
    expect(offer.outs.toSorted()).toEqual([c("Kc"), c("Kh")].toSorted());
  });

  it("counts as decided once bought or turned down, and opens again on revising", () => {
    const start = hand();
    const offers = handOffers(start, RULE_30);
    expect(offersDecided(start, offers)).toBe(false);
    expect(offersDecided(bought(start), offers)).toBe(true);
    const declined = declineOffer(start, "river-0-a");
    expect(offersDecided(declined, offers)).toBe(true);
    expect(offersDecided(reviseOffer(declined, "river-0-a"), offers)).toBe(false);
    expect(reviseOffer(bought(start), "river-0-a").purchases).toEqual([]);
  });

  it.each([
    [
      "with different chances",
      [player("a", 1000, ["As", "Kh"]), player("b", 1000, ["Ad", "Kc"])],
      ["Qs", "7s", "2s", "3d"],
    ],
    [
      "with equal chances and nobody behind",
      [player("a", 1000, ["Ks", "Qs"]), player("b", 1000, ["Kh", "Qh"])],
      ["2s", "7s", "2h", "7h"],
    ],
    [
      "with different chances and someone behind",
      [
        player("a", 1000, ["As", "Kh"]),
        player("b", 1000, ["Ad", "Kc"]),
        player("c", 1000, ["Jd", "Td"]),
      ],
      ["Qs", "7s", "2s", "3d"],
    ],
  ])("refuses a tied lead %s", (_, players, board) => {
    const tied = hand({ players, board: board.map(c) });
    const offers = handOffers(tied, RULE_30).filter((o) => o.pot.leaders.length > 1);
    expect(offers.length).toBeGreaterThan(1);
    expect(offers.map((o) => o.quote)).toEqual(
      offers.map(() => ({ ok: false, block: "tied-lead" })),
    );
    expect(offersDecided(tied, offers)).toBe(true);
  });

  it("still sells equal tied leaders with someone behind them", () => {
    const tied = hand({
      players: [
        player("a", 1000, ["Js", "Jd"]),
        player("b", 1000, ["Jh", "Jc"]),
        player("c", 1000, ["5s", "5d"]),
      ],
      board: [c("2c"), c("7h"), c("9d"), c("3s")],
    });
    expect(handOffers(tied, RULE_30).map((o) => o.quote.ok)).toEqual([true, true]);
  });

  it("needs no decision when nothing can be sold", () => {
    const dead = hand({ players: [aces, player("x", 1000, ["As", "Ad"])] });
    expect(offersDecided(dead, [])).toBe(true);
  });
});

describe("dealCard", () => {
  it("settles what was sold on that card", () => {
    const start = hand({ board: hand().board.slice(0, 3) });
    const dealt = dealCard(bought(start), c("Kh"));
    expect(dealt.step).toBe("settle");
    expect(dealt.purchases[0]?.hit).toBe(true);
    expect(dealCard(bought(start), c("4h")).purchases[0]?.hit).toBe(false);
  });

  it("skips settling a turn with nothing sold, but always stops at the river", () => {
    const flop = hand({ board: hand().board.slice(0, 3) });
    expect(dealCard(flop, c("4h")).step).toBe("buy");
    expect(dealCard(hand(), c("4h")).step).toBe("settle");
  });

  it("takes a wrong card back and leaves earlier results alone", () => {
    const flop = hand({ board: hand().board.slice(0, 3) });
    const turn = dealCard(bought(flop), c("4h"));
    const river = dealCard(turn, c("5h"));
    const undone = undoDeal(river);
    expect(undone).toMatchObject({ step: "deal", board: turn.board });
    expect(undone.purchases[0]?.hit).toBe(false);
    expect(undoDeal(turn).purchases[0]).not.toHaveProperty("hit");
  });
});

describe("playerHandResults", () => {
  const river = [c("2c"), c("7h"), c("9d"), c("3c"), c("4h")];

  it("pays the winner and gives the excess back", () => {
    const players = [aces, { ...kings, chips: 300 }];
    const [a, k] = playerHandResults(hand({ players, board: river, step: "summary" }));
    expect(a).toMatchObject({ potChips: 600, refundChips: 700, netChips: 300, stackChips: 1300 });
    expect(k).toMatchObject({ potChips: 0, refundChips: 0, netChips: -300, stackChips: 0 });
  });

  it("gives a cover player a result but no stack", () => {
    const players = [aces, player("k", 0, ["Ks", "Kd"], true)];
    const [, k] = playerHandResults(hand({ players, board: river }));
    expect(k).toMatchObject({ cover: true, netChips: -1000, stackChips: null });
  });

  it("never reports a cover player as short of a premium", () => {
    const players = [aces, player("k", 0, ["Ks", "Kd"], true)];
    const flop = hand({ players, board: river.slice(0, 3), step: "buy" });
    const paying = bought(flop);
    const purchases = paying.purchases.map((purchase) => ({ ...purchase, playerId: "k" }));
    const lost = dealCard(dealCard({ ...paying, purchases }, c("3c")), c("4h"));
    expect(playerHandResults(lost)[1]).toMatchObject({ shortChips: 0, stackChips: null });
  });

  it("adds insurance to the player's result, and notes a premium they could not pay", () => {
    const flop = hand({ board: river.slice(0, 3), step: "buy" });
    const purchased = bought(flop);
    const dealt = dealCard(dealCard(purchased, c("3c")), c("Kh"));
    const [a, k] = playerHandResults(dealt);
    const premium = purchased.purchases[0]?.premiumChips ?? 0;
    expect(a).toMatchObject({ potChips: 0, insuranceChips: -premium, stackChips: 0 });
    expect(a?.shortChips).toBe(premium);
    expect(k).toMatchObject({ potChips: 2000, stackChips: 2000 });
  });

  it("notes a premium larger than the pot the player won", () => {
    const flop = hand({ board: river.slice(0, 3), step: "buy" });
    const purchased = bought(flop);
    const costly = {
      ...purchased,
      purchases: purchased.purchases.map((p) => ({ ...p, premiumChips: 2500 })),
    };
    const [a] = playerHandResults(dealCard(dealCard(costly, c("3c")), c("4h")));
    expect(a).toMatchObject({ potChips: 2000, stackChips: 0, shortChips: 500 });
  });

  it("splits a tie and gives the odd chip to the first winner", () => {
    const players = [player("a", 100, ["As", "Kh"]), player("b", 100, ["Ad", "Kc"])];
    const pools = [1];
    const results = playerHandResults(hand({ players, pools, board: river }));
    expect(results.map((r) => r.potChips)).toEqual([101, 100]);
  });

  it("shares out every chip in the pots", () => {
    const seat = fc.record({ chips: fc.integer({ min: 1, max: 5000 }), hit: fc.boolean() });
    fc.assert(
      fc.property(
        fc.shuffledSubarray([...DECK], { minLength: 13, maxLength: 13 }),
        fc.array(seat, { minLength: 4, maxLength: 4 }),
        fc.array(fc.integer({ min: 1, max: 500 }), { maxLength: 3 }),
        (cards, seats, pools) => {
          const players = seats.map(({ chips }, i) => ({
            playerId: `p${i}`,
            chips,
            cover: false,
            cards: cards.slice(i * 2, i * 2 + 2),
          }));
          const results = playerHandResults(hand({ players, pools, board: cards.slice(8) }));
          const paid = results.reduce((sum, r) => sum + r.potChips + r.refundChips, 0);
          const total = [...seats.map((s) => s.chips), ...pools].reduce((a, b) => a + b, 0);
          expect(paid).toBe(total);
          expect(results.reduce((sum, r) => sum + r.netChips, 0)).toBe(
            pools.reduce((a, b) => a + b, 0),
          );
        },
      ),
    );
  });
});

describe("premiumBuyIns", () => {
  const result = { playerId: "a", shortChips: 0 } as PlayerHandResult;

  it("buys only for players who are short", () => {
    expect(premiumBuyIns([result], 100)).toEqual([]);
  });

  it("buys enough whole hands and leaves the rest as their stack", () => {
    expect(premiumBuyIns([{ ...result, shortChips: 20 }], 100)).toEqual([
      { playerId: "a", shortChips: 20, buyInChips: 100, stackChips: 80 },
    ]);
    expect(premiumBuyIns([{ ...result, shortChips: 100 }], 100)[0]?.stackChips).toBe(0);
    expect(premiumBuyIns([{ ...result, shortChips: 101 }], 100)[0]).toMatchObject({
      buyInChips: 200,
      stackChips: 99,
    });
  });
});

describe("handResult", () => {
  it("counts settled purchases only", () => {
    const flop = hand({ board: hand().board.slice(0, 3) });
    expect(handResult(bought(flop)).seatChips).toBe(0);
  });

  it("gives the seat the premiums less the payouts", () => {
    const purchase = fc.record({
      premiumChips: fc.integer({ min: 1, max: 1000 }),
      payoutChips: fc.integer({ min: 1, max: 30_000 }),
      hit: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(purchase, { maxLength: 6 }), (rows) => {
        const purchases = rows.map((row, i) => ({
          ...row,
          id: `${i}`,
          offerKey: `${i}`,
          playerId: "a",
          street: "river" as const,
          outs: [],
          oddsHundredths: 300,
        }));
        const net = rows.reduce(
          (total, r) => total + r.premiumChips - (r.hit ? r.payoutChips : 0),
          0,
        );
        expect(handResult({ purchases }).seatChips).toBe(net);
      }),
    );
  });
});
