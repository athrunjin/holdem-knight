import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { GameSummary, SummaryPlayer, SummaryTransfer } from "../domain";
import { cents } from "../money";
import { ORGANIZER_COLLECTOR } from "../settlement";
import { playerCurve, playerPayments, playerReport, playerResult } from "./players";

const ME = ORGANIZER_COLLECTOR;
const DAY_MS = 86_400_000;

const row = (
  playerId: string,
  chipNet: number,
  rest: Partial<SummaryPlayer> = {},
): SummaryPlayer => ({
  playerId,
  boughtChips: 0,
  cashedOutChips: 0,
  chipNet: cents(chipNet),
  share: cents(0),
  insurance: cents(0),
  wage: cents(0),
  tableFee: cents(0),
  total: cents(chipNet),
  ...rest,
});

const summary = (
  id: string,
  day: string,
  players: readonly SummaryPlayer[],
  rest: Partial<GameSummary> = {},
): GameSummary => ({
  id,
  organizerId: "me",
  basis: "",
  startedAt: Date.parse(day),
  day,
  settledAt: Date.parse(day),
  currency: "CNY",
  chipRatio: { chips: 1, amount: cents(100) },
  smallBlindChips: 1,
  bigBlindChips: 2,
  playerCount: players.length,
  income: { rake: cents(0), insurance: cents(0), wage: cents(0), tableFee: cents(0) },
  difference: cents(0),
  absorbed: cents(0),
  players,
  transfers: [],
  ...rest,
});

describe("playerReport", () => {
  const games = [
    summary("g1", "2026-11-03", [row("wang", 500), row("li", -500)]),
    summary("g2", "2026-11-10", [
      row("wang", -300, { share: cents(-10), wage: cents(60), tableFee: cents(30) }),
      row("li", 300),
    ]),
    summary("g3", "2026-11-17", [row("wang", 200, { insurance: cents(999) })]),
    summary("g4", "2026-11-18", [row("wang", 900)], { currency: "AUD" }),
    summary("g5", "2026-11-19", [row("li", 100)]),
  ];

  it("adds up what a player won and lost in the games they played, in one currency", () => {
    const report = playerReport(games, "wang", "CNY");
    expect(report.games.map(({ summary: { id } }) => id)).toEqual(["g3", "g2", "g1"]);
    expect(report).toMatchObject({ result: 400, won: 2, average: 133, best: 500, worst: -300 });
  });

  it("counts chips alone, with shares of a difference and charges told apart", () => {
    expect(playerResult(row("a", -300, { share: cents(-10), wage: cents(60) }))).toBe(-300);
    expect(playerResult(row("a", 200, { insurance: cents(999) }))).toBe(200);
    expect(playerReport(games, "wang", "CNY")).toMatchObject({
      wage: 60,
      tableFee: 30,
      share: -10,
    });
  });

  it("runs a total over the games from the oldest, with and without the charges paid", () => {
    const curve = playerCurve(playerReport(games, "wang", "CNY").games);
    expect(curve.map(({ summary: { id } }) => id)).toEqual(["g1", "g2", "g3"]);
    expect(curve.map(({ total }) => total)).toEqual([500, 200, 400]);
    expect(curve.map(({ afterCharges }) => afterCharges)).toEqual([500, 110, 310]);
    expect(curve.at(-1)).toMatchObject({ wage: 60, tableFee: 30 });
    expect(playerCurve([])).toEqual([]);
  });

  it("keeps to the games of a period", () => {
    const period = { from: "2026-11-01", to: "2026-11-07" };
    expect(playerReport(games, "wang", "CNY", period)).toMatchObject({ result: 500, won: 1 });
  });

  it("is all zeros for someone who played in none", () => {
    expect(playerReport(games, "nobody", "CNY")).toMatchObject({
      games: [],
      result: 0,
      won: 0,
      average: 0,
      best: 0,
      worst: 0,
    });
  });

  it("has a result that is the sum of its games, between its worst and its best game times them", () => {
    const results = fc.array(fc.integer({ min: -1_000_000, max: 1_000_000 }), { maxLength: 12 });
    fc.assert(
      fc.property(results, (nets) => {
        const played = nets.map((net, i) =>
          summary(`g${i}`, `2026-11-${String(i + 1).padStart(2, "0")}`, [row("a", net)]),
        );
        const report = playerReport(played, "a", "CNY");
        expect(report.result).toBe(nets.reduce((all, net) => all + net, 0));
        expect(report.games).toHaveLength(nets.length);
        expect(report.won).toBe(nets.filter((net) => net > 0).length);
        expect(playerCurve(report.games).at(-1)?.total ?? 0).toBe(report.result);
        expect(report.worst).toBeLessThanOrEqual(report.average);
        expect(report.average).toBeLessThanOrEqual(report.best);
      }),
    );
  });
});

describe("playerPayments", () => {
  const pay = (from: string, to: string, amount: number, rest: Partial<SummaryTransfer> = {}) => ({
    from,
    to,
    amount: cents(amount),
    done: false,
    ...rest,
  });
  const at = (day: string, days: number) => Date.parse(day) + days * DAY_MS;
  const games = [
    summary("g1", "2026-11-01", [], {
      transfers: [
        pay("wang", ME, 300),
        pay("wang", ME, 200, { bad: true }),
        pay(ME, "wang", 80),
        pay("li", ME, 999),
      ],
    }),
    summary("g2", "2026-11-02", [], {
      transfers: [
        pay("wang", ME, 100, { done: true, doneAt: at("2026-11-02", 2) }),
        pay("wang", "li", 100, { done: true, doneAt: at("2026-11-02", 10) }),
        pay("wang", ME, 50, { done: true }),
      ],
    }),
  ];

  it("says what is still between a player and the organizer, and their bad debts", () => {
    expect(playerPayments(games, "wang", "CNY")).toMatchObject({
      owes: 300,
      owesCount: 1,
      owed: 80,
      owedCount: 1,
      bad: 200,
      badCount: 1,
    });
  });

  it("counts how promptly they paid only where the time was kept", () => {
    expect(playerPayments(games, "wang", "CNY")).toMatchObject({
      timed: 2,
      late: 1,
      averageDays: 6,
    });
    expect(playerPayments(games, "li", "CNY").averageDays).toBeUndefined();
  });
});
