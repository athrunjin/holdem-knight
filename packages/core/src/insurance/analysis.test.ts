import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { type AllInHand, analyzeAllIn, nextStreet, showdownStandings } from "./analysis";
import { type Card, parseCard } from "./cards";
import { buildPots } from "./pots";

const cards = (codes: string): Card[] =>
  codes.split(" ").map((code) => {
    const card = parseCard(code);
    if (card === null) throw new Error(`Bad card: ${code}`);
    return card;
  });

const hand = (playerId: string, codes: string, chips: number): AllInHand => ({
  playerId,
  cards: cards(codes),
  chips,
});

describe("buildPots", () => {
  it("makes one pot when everyone put in the same", () => {
    expect(
      buildPots([
        { playerId: "a", chips: 500 },
        { playerId: "b", chips: 500 },
      ]),
    ).toEqual([{ amountChips: 1000, playerIds: ["a", "b"], stakes: { a: 500, b: 500 } }]);
  });

  it("layers side pots by contribution", () => {
    const pots = buildPots([
      { playerId: "short", chips: 100 },
      { playerId: "mid", chips: 300 },
      { playerId: "big", chips: 300 },
    ]);
    expect(pots.map((p) => [p.amountChips, p.playerIds])).toEqual([
      [300, ["short", "mid", "big"]],
      [400, ["mid", "big"]],
    ]);
    expect(pots[1]?.stakes).toEqual({ mid: 200, big: 200 });
  });

  it("leaves an uncalled excess in a pot of its own", () => {
    const pots = buildPots([
      { playerId: "a", chips: 100 },
      { playerId: "b", chips: 250 },
    ]);
    expect(pots.at(-1)).toEqual({ amountChips: 150, playerIds: ["b"], stakes: { b: 150 } });
  });

  it("keeps folded chips in the layers they reached, without making the player eligible", () => {
    const pots = buildPots([
      { playerId: "a", chips: 100 },
      { playerId: "b", chips: 300 },
      { playerId: "c", chips: 300 },
      { playerId: "gone", chips: 200, folded: true },
    ]);
    expect(pots.map((p) => p.amountChips)).toEqual([400, 500]);
    expect(pots.flatMap((p) => p.playerIds)).not.toContain("gone");
  });

  it("adds folded chips above every live player to the last pot", () => {
    const pots = buildPots([
      { playerId: "a", chips: 100 },
      { playerId: "b", chips: 100 },
      { playerId: "gone", chips: 400, folded: true },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0]?.amountChips).toBe(600);
  });

  it("never loses a chip", () => {
    const entry = fc.record({
      chips: fc.integer({ min: 1, max: 5000 }),
      folded: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(entry, { minLength: 1, maxLength: 9 }), (rows) => {
        const entries = rows.map((row, i) => ({ ...row, playerId: `p${i}` }));
        fc.pre(entries.some((e) => !e.folded));
        const total = entries.reduce((sum, e) => sum + e.chips, 0);
        expect(buildPots(entries).reduce((sum, p) => sum + p.amountChips, 0)).toBe(total);
      }),
    );
  });
});

describe("analyzeAllIn", () => {
  it("counts a flush draw's nine outs against an overpair on the turn", () => {
    const [pot] = analyzeAllIn(
      [hand("pair", "Ac Ad", 500), hand("draw", "Kh Qh", 500)],
      [],
      cards("2h 7h 9c 3s"),
    );
    expect(pot?.leaders.map((l) => l.playerId)).toEqual(["pair"]);
    expect(pot?.leaders[0]?.outs).toHaveLength(9);
    expect(pot?.leaders[0]?.stakeChips).toBe(500);
    expect(pot?.leaders[0]?.shareChips).toBe(1000);
    expect(pot?.equity.draw).toBeCloseTo(9 / 44);
  });

  it("counts a card that two opponents hit only once, and credits both", () => {
    const [pot] = analyzeAllIn(
      [hand("set", "2c 2d", 500), hand("one", "Ad 5c", 500), hand("two", "Ah 6c", 500)],
      [],
      cards("Ks Qd Jc 2h"),
    );
    const leader = pot?.leaders[0];
    const tens = cards("Ts Th Td Tc");
    expect(leader?.playerId).toBe("set");
    expect(leader?.outs.toSorted()).toEqual(tens.toSorted());
    expect(leader?.byOpponent.map((o) => [o.playerId, o.cards.length])).toEqual([
      ["one", 4],
      ["two", 4],
    ]);
  });

  it("credits an out to the opponent who actually wins on it", () => {
    const [pot] = analyzeAllIn(
      [hand("set", "9c 9d", 500), hand("second", "Kh Qh", 500), hand("nuts", "Ah Jh", 500)],
      [],
      cards("2h 7h 9s 3d"),
    );
    // Five hearts are left that do not fill the set: the 3h and 9h give it a full house or better
    expect(pot?.leaders[0]?.outs.toSorted()).toEqual(cards("4h 5h 6h 8h Th").toSorted());
    expect(pot?.leaders[0]?.byOpponent.map((o) => o.playerId)).toEqual(["nuts"]);
  });

  it("works out each pot apart, so a short stack's outs only touch the main pot", () => {
    const pots = analyzeAllIn(
      [hand("short", "Kh Qh", 100), hand("leader", "Ac Ad", 400), hand("second", "Jc Jd", 400)],
      [],
      cards("2h 7h 9c 3s"),
    );
    expect(pots.map((p) => p.amountChips)).toEqual([300, 600]);
    const [main, side] = pots;
    const hearts = cards("Ah 3h 4h 5h 6h 8h 9h Th");
    expect(main?.leaders[0]?.outs.some((card) => hearts.includes(card))).toBe(true);
    expect(side?.playerIds).toEqual(["leader", "second"]);
    expect(side?.leaders[0]?.outs.some((card) => hearts.includes(card))).toBe(false);
    expect(side?.leaders[0]?.outs).toHaveLength(2);
  });

  it("separates cards that split the pot from cards that lose it", () => {
    const [pot] = analyzeAllIn(
      [hand("high", "Ac Kd", 500), hand("lower", "As Qd", 500)],
      [],
      cards("2h 7c 9d Th"),
    );
    const leader = pot?.leaders[0];
    expect(leader?.playerId).toBe("high");
    expect(leader?.outs).toHaveLength(3);
    expect(leader?.tieCards).toHaveLength(0);

    const [board] = analyzeAllIn(
      [hand("high", "Ac Kd", 500), hand("lower", "Ad Qd", 500)],
      [],
      cards("Kc Qh Jd 9s"),
    );
    // Any ten gives both players the same Broadway straight
    expect(board?.leaders[0]?.tieCards).toHaveLength(4);
  });

  it("lets tied leaders share the pot and each insure their share", () => {
    const [pot] = analyzeAllIn(
      [hand("a", "As Kd", 500), hand("b", "Ad Kc", 500), hand("c", "2c 2d", 500)],
      [],
      cards("Ah Kh 9c 4s"),
    );
    expect(pot?.leaders.map((l) => l.playerId)).toEqual(["a", "b"]);
    expect(pot?.leaders[0]?.shareChips).toBe(750);
  });

  it("gives equities that add up to 1 from the flop", () => {
    const [pot] = analyzeAllIn(
      [hand("a", "Ac Ad", 500), hand("b", "Kh Qh", 500), hand("c", "Jc Tc", 500)],
      [],
      cards("2h 7h 9c"),
    );
    const total = Object.values(pot?.equity ?? {}).reduce((sum, e) => sum + e, 0);
    expect(total).toBeCloseTo(1);
  });

  it("skips a pot only one player can win", () => {
    const pots = analyzeAllIn(
      [hand("a", "Ac Ad", 100), hand("b", "Kh Qh", 300)],
      [],
      cards("2h 7h 9c 3s"),
    );
    expect(pots).toHaveLength(1);
  });
});

describe("nextStreet", () => {
  it("sells the next card from the flop and turn only", () => {
    expect(nextStreet(cards("2h 7h"))).toBeNull();
    expect(nextStreet(cards("2h 7h 9c"))).toBe("turn");
    expect(nextStreet(cards("2h 7h 9c 3s"))).toBe("river");
    expect(nextStreet(cards("2h 7h 9c 3s 4d"))).toBeNull();
  });
});

describe("showdownStandings", () => {
  const standingOf = (
    hands: readonly AllInHand[],
    board: string,
    playerId: string,
  ): ReturnType<typeof showdownStandings>["players"][number] => {
    const { players } = showdownStandings(hands, board === "" ? [] : cards(board));
    const standing = players.find((s) => s.playerId === playerId);
    if (!standing) throw new Error(`No standing for ${playerId}`);
    return standing;
  };

  it("has nothing to say until two players hold cards", () => {
    expect(showdownStandings([hand("a", "As Ad", 100)], [])).toEqual({ players: [], exact: true });
  });

  it("puts a pair ahead of two overcards before the flop, with a sampled chance to win", () => {
    const hands = [hand("tens", "Ts Td", 100), hand("big", "Ah Kc", 100)];
    const { exact } = showdownStandings(hands, []);
    const tens = standingOf(hands, "", "tens");
    const big = standingOf(hands, "", "big");
    expect(exact).toBe(false);
    expect(tens).toMatchObject({ leading: true, outs: [], tieCards: [] });
    expect(big.leading).toBe(false);
    expect(big.outs.toSorted()).toEqual(cards("Ks Kh Kd As Ad Ac").toSorted());
    // The known figure is 57.0%: twenty thousand runouts land within a point of it
    expect(Math.abs(tens.equity - 0.57)).toBeLessThan(0.01);
    expect(tens.equity + big.equity).toBeCloseTo(1);
  });

  it("gives the same sampled chance for the same cards every time", () => {
    const hands = [hand("a", "Ts Td", 100), hand("b", "Ah Kc", 100)];
    expect(showdownStandings(hands, [])).toEqual(showdownStandings(hands, []));
  });

  it("deals every runout from the flop on", () => {
    const hands = [hand("ace", "As Th", 100), hand("kings", "Ks Kh", 100)];
    expect(showdownStandings(hands, cards("9s 7d 3c")).exact).toBe(true);
    const ace = standingOf(hands, "9s 7d 3c", "ace");
    expect(ace.leading).toBe(false);
    expect(ace.outs.toSorted()).toEqual(cards("Ah Ad Ac").toSorted());
    expect(ace.equity).toBeCloseTo(0.16, 2);
    expect(standingOf(hands, "9s 7d 3c", "kings")).toMatchObject({ leading: true, outs: [] });
  });

  it("lights every player level at the top", () => {
    const hands = [hand("a", "As Kh", 100), hand("b", "Ad Kc", 100), hand("c", "Jd Td", 100)];
    const { players } = showdownStandings(hands, cards("Qs 7s 2s 3d"));
    expect(players.map((s) => s.leading)).toEqual([true, true, false]);
  });

  it("tells cards that only bring a player level from cards that put them ahead", () => {
    const hands = [hand("a", "Ah 2c", 100), hand("b", "9h 3c", 100)];
    const behind = standingOf(hands, "Qs Qd Jc Jh", "b");
    expect(behind.outs).toEqual([]);
    expect(behind.tieCards.toSorted()).toEqual(cards("Qh Qc Js Jd").toSorted());
  });

  it("counts a card as an out when it passes the leader, even if it is shared with another player", () => {
    const hands = [hand("lead", "Ah Ad", 100), hand("x", "Kh Qc", 100), hand("y", "Kd Qs", 100)];
    const x = standingOf(hands, "Jc Ts 4d 2h", "x");
    // Any ace or nine makes the same straight for both players behind
    expect(x.outs.toSorted()).toEqual(cards("As Ac 9s 9h 9d 9c").toSorted());
    expect(x.tieCards).toEqual([]);
  });

  it("has no outs left on a full board, where the winner is certain", () => {
    const hands = [hand("a", "As Ad", 100), hand("k", "Ks Kd", 100)];
    const { players } = showdownStandings(hands, cards("2c 7h 9d 3c Jh"));
    expect(players).toEqual([
      { playerId: "a", leading: true, equity: 1, outs: [], tieCards: [] },
      { playerId: "k", leading: false, equity: 0, outs: [], tieCards: [] },
    ]);
  });

  it("shares out exactly one win among the players, whatever the cards", () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray([...Array(52).keys()], { minLength: 13, maxLength: 13 }),
        fc.integer({ min: 2, max: 4 }),
        fc.integer({ min: 3, max: 5 }),
        (deal, playerCount, boardCount) => {
          const hands = Array.from({ length: playerCount }, (_, i) => ({
            playerId: `p${i}`,
            cards: deal.slice(i * 2, i * 2 + 2),
          }));
          const { players } = showdownStandings(hands, deal.slice(8, 8 + boardCount));
          const total = players.reduce((sum, s) => sum + s.equity, 0);
          expect(total).toBeCloseTo(1);
          expect(players.some((s) => s.leading)).toBe(true);
          for (const s of players) if (s.leading) expect([...s.outs, ...s.tieCards]).toEqual([]);
        },
      ),
      { numRuns: 60 },
    );
  });
});
