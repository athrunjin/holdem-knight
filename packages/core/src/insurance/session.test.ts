import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { InsuranceHand, InsuranceHandPlayer } from "../domain";
import { type Card, DECK, makeCard } from "./cards";
import { potTotals } from "./pots";
import { RULE_30 } from "./rules";
import {
  arrangeOuts,
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
  handUnderWay,
  offersDecided,
  type PlayerHandResult,
  playerHandResults,
  playersReady,
  premiumBuyIns,
  reviseOffer,
  stakeOf,
  streetEntered,
  streetInsurance,
  streetLeaders,
  undoDeal,
  withEnteredBoard,
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
    expect(handPotBreakdown(sidePots)).toMatchObject([
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
    expect(handPotBreakdown(hand({ players: [aces, deep] }))).toMatchObject([
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

  it("gives each pot its chances and the cards that change it", () => {
    // Aces against kings on the turn: two kings left among 44 unseen cards
    const [pot] = handPotBreakdown(hand());
    expect(pot).toMatchObject({ outs: 2, tieOuts: 0, unseenCards: 44 });
    expect(pot?.equity.a).toBeCloseTo(42 / 44);
    expect(pot?.equity.k).toBeCloseTo(2 / 44);
  });

  it("leaves the chances and outs out before the flop", () => {
    const [pot] = handPotBreakdown(hand({ board: [] }));
    expect(pot).toMatchObject({ leaders: ["a"], equity: {}, outs: 0, tieOuts: 0, unseenCards: 48 });
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

  describe("tie cards", () => {
    // Two queens take the pot from the kings, and any ten gives both the same straight
    const broadway = hand({
      players: [player("a", 500, ["Ac", "Kd"]), player("b", 500, ["Ad", "Qd"])],
      board: ["Kc", "Qh", "Jd", "9s"].map(c),
    });
    // Four twos on the board: an ace on the river is the kicker for both, and nothing beats the ace
    const quads = hand({
      players: [player("a", 500, ["As", "Kd"]), player("b", 500, ["Qd", "Jd"])],
      board: ["2c", "2d", "2h", "2s"].map(c),
    });

    it("sells them as an offer of their own after the cards that overtake", () => {
      const [overtake, tie, ...rest] = handOffers(broadway, RULE_30);
      expect(rest).toEqual([]);
      expect(overtake).toMatchObject({ key: "river-0-a", kind: "overtake", input: { outs: 2 } });
      expect(overtake?.outs.toSorted()).toEqual([c("Qs"), c("Qc")].toSorted());
      expect(tie).toMatchObject({
        key: "river-0-a-tie",
        kind: "tie",
        // Half the pot of 1,000 stays with the leader when a ten comes, so the other half is the
        // most a cover on the tens may pay
        input: { outs: 4, keptChips: 500, capChips: 500, shareChips: 1000, stakeChips: 500 },
      });
      if (!tie?.quote.ok) throw new Error("Expected a quote");
      expect(tie.quote.fullPot.payoutChips).toBeLessThanOrEqual(500);
      // The cards that overtake are still covered up to the whole pot
      expect(overtake?.input.capChips).toBeUndefined();
      expect(tie?.outs.toSorted()).toEqual(["Ts", "Th", "Td", "Tc"].map(c).toSorted());
      // Each is priced by its own count of cards
      expect(overtake?.quote).toMatchObject({
        ok: true,
        oddsHundredths: RULE_30.oddsHundredths[1],
      });
      expect(tie?.quote).toMatchObject({ ok: true, oddsHundredths: RULE_30.oddsHundredths[3] });
    });

    it("covers two thirds of the pot where a tie splits it three ways", () => {
      // An ace on the river is everyone's kicker to the four twos
      const threeWay = hand({
        players: [...quads.players, player("c", 500, ["Th", "9h"])],
        board: quads.board,
      });
      const [tie] = handOffers(threeWay, RULE_30);
      expect(tie).toMatchObject({
        kind: "tie",
        input: { outs: 3, shareChips: 1500, keptChips: 500, capChips: 1000 },
      });
      if (!tie?.quote.ok) throw new Error("Expected a quote");
      const { halfPot, fullPot } = tie.quote;
      // Half the pot, and above it the cap
      expect(halfPot?.payoutChips).toBeGreaterThanOrEqual(750);
      expect(fullPot.payoutChips).toBeGreaterThan(halfPot?.payoutChips ?? 0);
      expect(fullPot.payoutChips).toBeLessThanOrEqual(1000);
    });

    it("leaves them unsold under a rule that does not count them", () => {
      const offers = handOffers(broadway, { ...RULE_30, tieOuts: "exclude" });
      expect(offers.map((o) => [o.key, o.input.outs])).toEqual([["river-0-a", 2]]);
    });

    it("offers only them to a leader no card overtakes", () => {
      const offers = handOffers(quads, RULE_30);
      expect(offers.map((o) => [o.key, o.kind, o.input.outs])).toEqual([
        ["river-0-a-tie", "tie", 3],
      ]);
      // With no tie cards sold, the same hand has nothing to insure
      const [none] = handOffers(quads, { ...RULE_30, tieOuts: "exclude" });
      expect(none?.quote).toEqual({ ok: false, block: "no-outs" });
    });

    it("decides and settles each offer on its own", () => {
      const offers = handOffers(broadway, RULE_30);
      const [overtake, tie] = offers;
      if (!overtake?.quote.ok || !tie?.quote.ok) throw new Error("Expected quotes");
      const first = buyOffer(broadway, overtake, "p1", overtake.quote.stake, 1);
      expect(offersDecided(first, offers)).toBe(false);
      const both = buyOffer(first, tie, "p2", tie.quote.stake, 1);
      expect(offersDecided(both, offers)).toBe(true);
      expect(both.purchases.map((p) => p.tie)).toEqual([undefined, true]);

      // A ten splits the pot: only the cover on the tie cards pays
      expect(dealCard(both, c("Ts")).purchases.map((p) => p.hit)).toEqual([false, true]);
      expect(dealCard(both, c("Qs")).purchases.map((p) => p.hit)).toEqual([true, false]);
      expect(dealCard(both, c("3h")).purchases.map((p) => p.hit)).toEqual([false, false]);
      // Taking one back leaves the other
      expect(reviseOffer(both, "river-0-a").purchases.map((p) => p.id)).toEqual(["p2"]);
    });
  });

  describe("outs given up or sold apart", () => {
    // Two queens overtake, four tens tie
    const broadway = hand({
      players: [player("a", 500, ["Ac", "Kd"]), player("b", 500, ["Ad", "Qd"])],
      board: ["Kc", "Qh", "Jd", "9s"].map(c),
    });
    const tens = (suits: string) => [...suits].map((suit) => c(`T${suit}`));

    it("prices an offer on the cards that are left, and pays only on those", () => {
      const skipped = arrangeOuts(broadway, "river-0-a-tie", { skipped: tens("shd"), second: [] });
      const [overtake, tie] = handOffers(skipped, RULE_30);
      // The other offer is as it was
      expect(overtake).toMatchObject({ input: { outs: 2 }, skippedOuts: [] });
      expect(tie).toMatchObject({ input: { outs: 1 }, outs: tens("c"), baseKey: "river-0-a-tie" });
      expect(tie?.part).toBeUndefined();
      expect(tie?.allOuts).toHaveLength(4);
      expect(tie?.skippedOuts.toSorted()).toEqual(tens("shd").toSorted());
      // One card is priced as one card
      expect(tie?.quote).toMatchObject({ ok: true, oddsHundredths: RULE_30.oddsHundredths[0] });

      if (!tie?.quote.ok) throw new Error("Expected a quote");
      const bought = buyOffer(skipped, tie, "p", tie.quote.stake, tie.quote.oddsHundredths);
      expect(bought.purchases[0]?.outs).toEqual(tens("c"));
      expect(dealCard(bought, c("Tc")).purchases[0]?.hit).toBe(true);
      expect(dealCard(bought, c("Ts")).purchases[0]?.hit).toBe(false);
    });

    it("takes the cards back, and leaves other offers alone", () => {
      const skipped = arrangeOuts(broadway, "river-0-a", { skipped: [c("Qs")], second: [] });
      expect(handOffers(skipped, RULE_30)[0]).toMatchObject({ input: { outs: 1 } });
      const other = arrangeOuts(skipped, "river-0-a-tie", { skipped: tens("s"), second: [] });
      const back = arrangeOuts(other, "river-0-a", { skipped: [], second: [] });
      expect(back.skippedOuts).toEqual({ "river-0-a-tie": tens("s") });
      expect(handOffers(back, RULE_30).map((o) => o.input.outs)).toEqual([2, 3]);
    });

    it("always sells at least one card, and ignores cards that are not outs", () => {
      const all = arrangeOuts(broadway, "river-0-a", { skipped: [c("Qs"), c("Qc")], second: [] });
      expect(handOffers(all, RULE_30)[0]).toMatchObject({ input: { outs: 2 }, skippedOuts: [] });
      const stray = arrangeOuts(broadway, "river-0-a", { skipped: [c("2h")], second: [c("3h")] });
      expect(handOffers(stray, RULE_30).map((o) => [o.key, o.input.outs])).toEqual([
        ["river-0-a", 2],
        ["river-0-a-tie", 4],
      ]);
    });

    it("sells some of the cards as a second cover, each priced on its own cards", () => {
      const split = arrangeOuts(broadway, "river-0-a-tie", {
        skipped: tens("s"),
        second: tens("dc"),
      });
      const offers = handOffers(split, RULE_30);
      expect(offers.map((o) => [o.key, o.kind, o.part, o.input.outs])).toEqual([
        ["river-0-a", "overtake", undefined, 2],
        ["river-0-a-tie", "tie", 1, 1],
        ["river-0-a-tie-2", "tie", 2, 2],
      ]);
      const [, first, second] = offers;
      expect(first?.outs).toEqual(tens("h"));
      expect(second?.outs.toSorted()).toEqual(tens("dc").toSorted());
      // Both know every card of the kind and the ones given up, and share the kind's key
      for (const offer of [first, second]) {
        expect(offer).toMatchObject({ baseKey: "river-0-a-tie", skippedOuts: tens("s") });
        expect(offer?.allOuts).toHaveLength(4);
      }
      expect(first?.quote).toMatchObject({ oddsHundredths: RULE_30.oddsHundredths[0] });
      expect(second?.quote).toMatchObject({ oddsHundredths: RULE_30.oddsHundredths[1] });
      // The same cap on each: a tie costs half the pot whichever cover it lands on
      expect(second?.input).toMatchObject({ capChips: 500, keptChips: 500 });

      // Each is decided and settled on its own cards
      if (!first?.quote.ok || !second?.quote.ok) throw new Error("Expected quotes");
      const one = buyOffer(split, first, "p1", first.quote.stake, 1);
      expect(offersDecided(declineOffer(one, "river-0-a"), offers)).toBe(false);
      const both = buyOffer(one, second, "p2", second.quote.stake, 1);
      expect(offersDecided(declineOffer(both, "river-0-a"), offers)).toBe(true);
      expect(dealCard(both, c("Th")).purchases.map((p) => p.hit)).toEqual([true, false]);
      expect(dealCard(both, c("Td")).purchases.map((p) => p.hit)).toEqual([false, true]);
      expect(dealCard(both, c("Ts")).purchases.map((p) => p.hit)).toEqual([false, false]);
    });

    it("has one cover when the second would hold every card sold", () => {
      const all = arrangeOuts(broadway, "river-0-a-tie", { skipped: [], second: tens("shdc") });
      const [, tie, ...rest] = handOffers(all, RULE_30);
      expect(rest).toEqual([]);
      expect(tie).toMatchObject({ key: "river-0-a-tie", input: { outs: 4 } });
      expect(tie?.part).toBeUndefined();
    });
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

  it("skips settling a turn with nothing sold, and ends the hand at the river", () => {
    const flop = hand({ board: hand().board.slice(0, 3) });
    expect(dealCard(flop, c("4h")).step).toBe("buy");
    expect(dealCard(bought(flop), c("4h")).step).toBe("settle");
    expect(dealCard(hand(), c("4h")).step).toBe("summary");
    expect(dealCard(bought(hand()), c("4h")).step).toBe("summary");
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

  it("splits a player's insurance by street, and the seat's is everyone's together", () => {
    const flop = hand({ board: river.slice(0, 3), step: "buy" });
    const purchased = bought(flop);
    const premium = purchased.purchases[0]?.premiumChips ?? 0;
    const dealt = dealCard(dealCard(purchased, c("3c")), c("Kh"));
    expect(streetInsurance(dealt, "turn", "a")).toMatchObject({ chips: -premium, hit: false });
    expect(streetInsurance(dealt, "turn")).toEqual({
      chips: -premium,
      hit: false,
      paidPlayerIds: [],
    });
    expect(streetLeaders(dealt, "turn")).toEqual(["a"]);
    expect(streetLeaders(dealt, "river")).toEqual(["a"]);
    expect(streetLeaders(flop, "river")).toEqual([]);
    expect(streetInsurance(dealt, "river", "a")).toBeUndefined();
    expect(streetInsurance(dealt, "turn", "k")).toBeUndefined();
    const paid = { ...dealt, purchases: dealt.purchases.map((p) => ({ ...p, hit: true })) };
    const payout = purchased.purchases[0]?.payoutChips ?? 0;
    expect(streetInsurance(paid, "turn", "a")).toEqual({
      chips: payout - premium,
      hit: true,
      paidPlayerIds: ["a"],
    });
  });

  it("counts a hand as under way from the first cover taken or turned down", () => {
    const flop = hand({ board: river.slice(0, 3), step: "buy" });
    expect(handUnderWay(flop)).toBe(false);
    // A turn entered with the board never had insurance; one dealt after a decision did
    const withTurn = { ...flop, board: [...flop.board, c("3c")] };
    expect(withEnteredBoard(withTurn)).not.toHaveProperty("enteredBoardCards");
    const begun = withEnteredBoard({ ...withTurn, declined: ["river-0-a"] });
    expect(begun.enteredBoardCards).toBe(4);
    expect(streetEntered(begun, "turn")).toBe(true);
    expect(streetEntered(begun, "river")).toBe(false);
    expect(withEnteredBoard(dealCard(begun, c("4h"))).enteredBoardCards).toBe(4);
    expect(withEnteredBoard({ ...begun, declined: [] })).not.toHaveProperty("enteredBoardCards");
    expect(streetEntered(withEnteredBoard(bought(flop)), "turn")).toBe(false);
    expect(handUnderWay(bought(flop))).toBe(true);
    expect(handUnderWay({ ...flop, declined: ["x"] })).toBe(true);
    expect(handUnderWay({ ...flop, step: "summary" })).toBe(true);
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

  it("says what came from each pot, leaving out chips nobody called", () => {
    const players = [aces, { ...kings, chips: 300 }, player("q", 600, ["Qs", "Qd"])];
    const [a, k, q] = playerHandResults(hand({ players, board: river }));
    // 300 each in the main pot, 300 more from two in the side pot, and 400 back to the aces
    expect(a).toMatchObject({ potShares: [900, 600], refundChips: 400 });
    // The kings have nothing in the side pot
    expect(k?.potShares).toEqual([0, null]);
    expect(q?.potShares).toEqual([0, 0]);
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
