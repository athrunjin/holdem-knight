import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buy, leave, MIN } from "../charges/test-events";
import {
  DEFAULT_RAKE_RULE,
  type Game,
  type ImbalanceHandling,
  INSURANCE_PLAYER_ID,
  type LedgerEvent,
  ORGANIZER_PLAYER_ID,
  RAKE_PLAYER_ID,
} from "../domain";
import { cents, sum } from "../money";
import { markTransfers } from "../settlement";
import { gameSummary, isSummaryCurrent, netOf, settleBooks, summaryBasis } from "./summary";

const SETTLED_AT = 600 * MIN;
const clock = { now: SETTLED_AT, minuteOfDay: () => 0 };
const context = { clock, day: "2026-11-21" };

/** 1 chip is 1 yuan, with the clock running from the start to the settlement. */
const game = (options: Partial<Game> = {}): Game => ({
  id: "g",
  organizerId: "me",
  currency: "CNY",
  smallBlindChips: 5,
  bigBlindChips: 10,
  chipRatio: { chips: 1, amount: cents(100) },
  status: "settled",
  createdAt: 0,
  settledAt: SETTLED_AT,
  timer: { elapsedMs: SETTLED_AT, runs: [{ from: 0, to: SETTLED_AT }] },
  ...options,
});

const rake = (chips: number): LedgerEvent => ({
  id: `rake-${chips}`,
  organizerId: "me",
  gameId: "g",
  occurredAt: 30 * MIN,
  type: "rake",
  playerId: RAKE_PLAYER_ID,
  chips,
});

/** A sits 2 hours and wins 300, B sits 1 hour and loses 400, and the rake took 100. */
const played = () => [
  buy("a", 0, 1000),
  buy("b", 0, 1000),
  rake(100),
  leave("b", 60, 600),
  leave("a", 120, 1300),
];

/** The insurance seat, which bought 1000 and ended with so many. */
const insured = (chips: number) => [
  buy(INSURANCE_PLAYER_ID, 0, 1000),
  leave(INSURANCE_PLAYER_ID, 130, chips),
];

describe("gameSummary", () => {
  it("keeps the rake, the wages and the table fee as the organizer's income", () => {
    const summary = gameSummary(
      game({
        rake: DEFAULT_RAKE_RULE,
        wage: { hourly: cents(6000) },
        tableFee: { amount: cents(5000), minMinutes: 90 },
      }),
      played(),
      context,
    );
    // Wages by the hour: 2 hours and 1 hour. Only A sat long enough for the table fee
    expect(summary.income).toEqual({ rake: 10000, insurance: 0, wage: 18000, tableFee: 5000 });
    expect(summary.players).toEqual([
      expect.objectContaining({
        playerId: "a",
        chipNet: 30000,
        wage: 12000,
        tableFee: 5000,
        total: 13000,
      }),
      expect.objectContaining({
        playerId: "b",
        chipNet: -40000,
        wage: 6000,
        tableFee: 0,
        total: -46000,
      }),
    ]);
    expect(summary).toMatchObject({
      id: "g",
      day: "2026-11-21",
      startedAt: 0,
      settledAt: SETTLED_AT,
      playedMs: SETTLED_AT,
      playerCount: 2,
      difference: 0,
      absorbed: 0,
      collectorId: ORGANIZER_PLAYER_ID,
    });
    expect(summary).not.toHaveProperty("insuranceOwnerId");
  });

  it("leaves out a charge the player was let off", () => {
    const summary = gameSummary(
      game({
        wage: { hourly: cents(6000) },
        waivedCharges: [{ playerId: "b", kind: "wage", part: "base" }],
      }),
      played(),
      context,
    );
    expect(summary.income.wage).toBe(12000);
    expect(summary.players.map((p) => p.wage)).toEqual([12000, 0]);
  });

  it("counts insurance only where its result is the organizer's", () => {
    const events = [
      buy("a", 0, 1000),
      buy("b", 0, 1000),
      ...insured(1200),
      leave("b", 60, 500),
      leave("a", 120, 1300),
    ];
    const own = gameSummary(game(), events, context);
    expect(own.income.insurance).toBe(20000);
    expect(own.insuranceOwnerId).toBe(ORGANIZER_PLAYER_ID);

    const players = gameSummary(game({ insuranceOwner: "a" }), events, context);
    expect(players.income.insurance).toBe(0);
    expect(players.insuranceOwnerId).toBe("a");
    expect(players.players[0]).toMatchObject({ playerId: "a", insurance: 20000, total: 50000 });

    const apart = gameSummary(game({ insuranceOwner: INSURANCE_PLAYER_ID }), events, context);
    expect(apart.income.insurance).toBe(0);
    expect(apart.insuranceOwnerId).toBe(INSURANCE_PLAYER_ID);
  });

  it("keeps an insurance loss as a loss", () => {
    const events = [buy("a", 0, 1000), ...insured(400), leave("a", 120, 1600)];
    expect(gameSummary(game(), events, context).income.insurance).toBe(-60000);
  });

  it("puts a difference the organizer takes on apart from the income and from their own play", () => {
    // 100 chips more were cashed out than bought
    const events = [
      buy(ORGANIZER_PLAYER_ID, 0, 1000),
      buy("a", 0, 1000),
      leave("a", 60, 1300),
      leave(ORGANIZER_PLAYER_ID, 60, 800),
    ];
    const summary = gameSummary(game({ imbalanceHandling: "organizer" }), events, context);
    expect(summary).toMatchObject({
      difference: 10000,
      absorbed: -10000,
      imbalanceHandling: "organizer",
    });
    expect(summary.players[0]).toMatchObject({
      playerId: ORGANIZER_PLAYER_ID,
      chipNet: -20000,
      share: 0,
      total: -20000,
    });
    expect(summary.income).toEqual({ rake: 0, insurance: 0, wage: 0, tableFee: 0 });
  });

  it("gives each player their share of a split difference, and the organizer takes nothing on", () => {
    const events = [
      buy("a", 0, 1000),
      buy("b", 0, 1000),
      leave("a", 60, 1300),
      leave("b", 60, 800),
    ];
    const summary = gameSummary(game({ imbalanceHandling: "split" }), events, context);
    expect(summary.absorbed).toBe(0);
    expect(summary.players.map((p) => [p.playerId, p.share])).toEqual([
      ["a", -10000],
      ["b", 0],
    ]);
  });

  it("lists the transfers of the game's plan with the ones marked as made", () => {
    const base = game({ wage: { hourly: cents(6000) } });
    const { transfers } = settleBooks(base, played(), clock);
    const paid = transfers.filter(({ from }) => from === "b");
    const summary = gameSummary(markTransfers(base, paid, true), played(), context);
    expect(summary.transfers).toEqual(
      transfers.map((transfer) => ({ ...transfer, done: transfer.from === "b" })),
    );
  });

  it("has no time played for a game whose clock never ran", () => {
    const { timer: _, ...untimed } = game();
    expect(gameSummary(untimed, played(), context)).not.toHaveProperty("playedMs");
  });
});

describe("isSummaryCurrent", () => {
  const summary = gameSummary(game(), played(), context);

  it("holds while the settled game stays as it was", () => {
    expect(isSummaryCurrent(game(), summary)).toBe(true);
    expect(isSummaryCurrent(game(), undefined)).toBe(false);
  });

  it("ends when the game is settled again, its plan changes or a transfer is marked", () => {
    expect(isSummaryCurrent(game({ settledAt: SETTLED_AT + 1 }), summary)).toBe(false);
    expect(isSummaryCurrent(game({ collectorId: "a" }), summary)).toBe(false);
    const marked = markTransfers(game(), [{ from: "b", to: "a", amount: cents(100) }], true);
    expect(isSummaryCurrent(marked, summary)).toBe(false);
  });

  it("holds for a settled game that never kept its time", () => {
    const { settledAt: _, ...timeless } = game();
    expect(isSummaryCurrent(timeless, gameSummary(timeless, played(), context))).toBe(true);
  });

  it("does not depend on the order the marks were made in", () => {
    const one = { from: "b", to: "a", amount: cents(100) };
    const two = { from: "c", to: "a", amount: cents(200) };
    expect(summaryBasis({ doneTransfers: [one, two] })).toBe(
      summaryBasis({ doneTransfers: [two, one] }),
    );
  });
});

describe("the money of a summary", () => {
  const handlings: ImbalanceHandling[] = ["split", "organizer"];
  const books = fc.record({
    players: fc.array(
      fc.record({
        bought: fc.integer({ min: 1, max: 50_000 }),
        left: fc.integer({ min: 0, max: 80_000 }),
      }),
      { minLength: 2, maxLength: 8 },
    ),
    hostPlays: fc.boolean(),
    insuranceLeft: fc.option(fc.integer({ min: 0, max: 5000 }), { nil: undefined }),
    rakeChips: fc.integer({ min: 0, max: 3000 }),
    handling: fc.constantFrom(...handlings),
    owner: fc.constantFrom(undefined, "p0", INSURANCE_PLAYER_ID, ORGANIZER_PLAYER_ID, "gone"),
    insuranceInSplit: fc.boolean(),
    rakeInSplit: fc.boolean(),
    charged: fc.boolean(),
    waiveFirst: fc.boolean(),
    ratio: fc.record({
      chips: fc.integer({ min: 1, max: 300 }),
      amount: fc.integer({ min: 1, max: 50_000 }).map(cents),
    }),
  });

  it("adds up: what the organizer ends with is their play, the income and the difference taken on", () => {
    fc.assert(
      fc.property(books, (b) => {
        const ids = b.players.map((_, i) =>
          i === 1 && b.hostPlays ? ORGANIZER_PLAYER_ID : `p${i}`,
        );
        const events: LedgerEvent[] = [
          ...b.players.map((p, i) => buy(ids[i] ?? "", 0, p.bought)),
          ...(b.insuranceLeft === undefined ? [] : insured(b.insuranceLeft)),
          ...(b.rakeChips > 0 ? [rake(b.rakeChips)] : []),
          ...b.players.map((p, i) => leave(ids[i] ?? "", 60 + i * 20, p.left)),
        ];
        const settled = game({
          chipRatio: b.ratio,
          imbalanceHandling: b.handling,
          ...(b.owner && { insuranceOwner: b.owner }),
          ...(b.insuranceInSplit && { insuranceInSplit: true }),
          ...(b.rakeInSplit && { rakeInSplit: true }),
          ...(b.charged && {
            wage: { hourly: cents(2550) },
            tableFee: { amount: cents(3000), minMinutes: 90 },
          }),
          ...(b.waiveFirst && { waivedCharges: [{ playerId: "p0", kind: "table_fee" }] }),
        });
        const { nets } = settleBooks(settled, events, clock);
        const summary = gameSummary(settled, events, context);
        const { income, absorbed, players } = summary;

        const host = players.find((p) => p.playerId === ORGANIZER_PLAYER_ID);
        const taken = income.rake + income.insurance + income.wage + income.tableFee;
        expect(netOf(nets, ORGANIZER_PLAYER_ID)).toBe((host?.total ?? 0) + taken + absorbed);
        for (const player of players) {
          if (player !== host) expect(netOf(nets, player.playerId)).toBe(player.total);
        }
        // Every charge a player pays is income, and nothing else is
        expect(income.wage).toBe(sum(players.map((p) => p.wage)));
        expect(income.tableFee).toBe(sum(players.map((p) => p.tableFee)));
        // With the difference handled, what everyone ends with comes to nothing
        expect(sum(nets.map((p) => p.net))).toBe(0);
        expect(sum(summary.transfers.map((t) => t.amount))).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});
