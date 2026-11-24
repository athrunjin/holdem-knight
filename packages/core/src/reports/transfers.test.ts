import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { GameSummary, SummaryTransfer } from "../domain";
import { cents } from "../money";
import { ORGANIZER_COLLECTOR } from "../settlement";
import { daysBetween, transferReport } from "./transfers";

const ME = ORGANIZER_COLLECTOR;

const summary = (
  id: string,
  day: string,
  transfers: readonly SummaryTransfer[],
  rest: Partial<GameSummary> = {},
): GameSummary => ({
  id,
  organizerId: "me",
  basis: "",
  startedAt: Date.parse(day),
  day,
  settledAt: Date.parse(day) + 1,
  currency: "CNY",
  chipRatio: { chips: 1, amount: cents(100) },
  smallBlindChips: 1,
  bigBlindChips: 2,
  playerCount: 4,
  income: { rake: cents(0), insurance: cents(0), wage: cents(0), tableFee: cents(0) },
  difference: cents(0),
  absorbed: cents(0),
  players: [],
  transfers,
  ...rest,
});

const pay = (from: string, to: string, amount: number, done = false): SummaryTransfer => ({
  from,
  to,
  amount: cents(amount),
  done,
});

const GAMES = [
  summary("g1", "2026-11-03", [pay("wang", ME, 300), pay(ME, "li", 100), pay("zhao", "li", 50)]),
  summary("g2", "2026-11-10", [pay("wang", ME, 200, true), pay(ME, "wang", 80), pay("li", ME, 40)]),
  summary("g3", "2026-11-17", [pay("wang", ME, 500)], { currency: "AUD" }),
];

describe("transferReport", () => {
  const open = transferReport(GAMES, { currency: "CNY", done: false });

  it("adds up what is still to come in and to go out, in one currency", () => {
    expect(open.toOrganizer).toBe(340);
    expect(open.fromOrganizer).toBe(180);
  });

  it("puts everything with one party together, the most owed first", () => {
    expect(open.parties.map(({ partyId, net }) => [partyId, net])).toEqual([
      ["wang", 220],
      ["li", -60],
    ]);
    const wang = open.parties[0];
    expect(wang).toMatchObject({ toOrganizer: 300, fromOrganizer: 80, games: 2 });
    expect(wang?.oldestDay).toBe("2026-11-03");
    // Newest game first
    expect(wang?.lines.map(({ gameId }) => gameId)).toEqual(["g2", "g1"]);
  });

  it("keeps transfers between players apart, in neither total", () => {
    expect(open.between.map(({ from, to, amount }) => [from, to, amount])).toEqual([
      ["zhao", "li", 50],
    ]);
  });

  it("lists the ones made instead when asked, within a period", () => {
    const made = transferReport(GAMES, { currency: "CNY", done: true });
    expect(made.toOrganizer).toBe(200);
    expect(made.parties.map(({ partyId }) => partyId)).toEqual(["wang"]);
    const earlier = { from: "2026-11-01", to: "2026-11-07" };
    expect(transferReport(GAMES, { currency: "CNY", done: true }, earlier).parties).toEqual([]);
    expect(transferReport(GAMES, { currency: "CNY", done: false }, earlier).toOrganizer).toBe(300);
  });

  it("orders parties owed alike by who has waited longest", () => {
    const games = [
      summary("late", "2026-11-12", [pay("b", ME, 100)]),
      summary("early", "2026-11-02", [pay("a", ME, 100)]),
    ];
    const { parties } = transferReport(games, { currency: "CNY", done: false });
    expect(parties.map(({ partyId }) => partyId)).toEqual(["a", "b"]);
  });

  it("counts every transfer once, and the parties' balances make up the totals", () => {
    const party = fc.constantFrom(ME, "a", "b", "c");
    const transfer = fc
      .record({
        from: party,
        to: party,
        amount: fc.integer({ min: 1, max: 1_000_000 }),
        done: fc.boolean(),
      })
      .filter(({ from, to }) => from !== to)
      .map(({ from, to, amount, done }) => pay(from, to, amount, done));
    const games = fc.array(fc.array(transfer, { maxLength: 6 }), { maxLength: 8 });
    fc.assert(
      fc.property(games, fc.boolean(), (plans, done) => {
        const summaries = plans.map((transfers, i) =>
          summary(`g${i}`, `2026-11-${String(i + 1).padStart(2, "0")}`, transfers),
        );
        const report = transferReport(summaries, { currency: "CNY", done });
        const counted = plans.flat().filter((t) => t.done === done);
        const listed = report.parties.flatMap(({ lines }) => lines).length + report.between.length;
        expect(listed).toBe(counted.length);
        const nets = report.parties.reduce((all, { net }) => all + net, 0);
        expect(nets).toBe(report.toOrganizer - report.fromOrganizer);
        const due = counted.filter((t) => t.to === ME).reduce((all, t) => all + t.amount, 0);
        expect(report.toOrganizer).toBe(due);
      }),
    );
  });
});

describe("daysBetween", () => {
  it("counts whole days across months and years", () => {
    expect(daysBetween("2026-11-17", "2026-11-24")).toBe(7);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2026-11-24", "2026-11-24")).toBe(0);
  });
});
