import { describe, expect, it } from "vitest";

import { type GameSummary, type IncomeItem, ORGANIZER_PLAYER_ID } from "../domain";
import { cents } from "../money";
import {
  INCOME_ITEMS,
  incomeOf,
  incomeReport,
  incomeSeries,
  monthPeriod,
  periodOf,
  recentMonths,
  shiftDay,
  shiftMonth,
  trendPeriods,
  unreceivedOf,
} from "./income";

const summary = (
  id: string,
  day: string,
  income: Partial<Record<IncomeItem, number>>,
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
  smallBlindChips: 5,
  bigBlindChips: 10,
  playerCount: 6,
  income: {
    rake: cents(income.rake ?? 0),
    insurance: cents(income.insurance ?? 0),
    wage: cents(income.wage ?? 0),
    tableFee: cents(income.tableFee ?? 0),
  },
  difference: cents(0),
  absorbed: cents(0),
  players: [],
  transfers: [],
  ...rest,
});

const owed = (amount: number, done = false) => ({
  from: "a",
  to: ORGANIZER_PLAYER_ID,
  amount: cents(amount),
  done,
});

const all = { currency: "CNY" as const, items: INCOME_ITEMS };

describe("incomeOf", () => {
  const game = summary("g", "2026-11-21", { rake: 500, insurance: -200, wage: 300, tableFee: 100 });

  it("adds the items asked for and no others", () => {
    expect(incomeOf(game, INCOME_ITEMS)).toBe(700);
    expect(incomeOf(game, ["rake", "wage"])).toBe(800);
    expect(incomeOf(game, [])).toBe(0);
  });
});

describe("unreceivedOf", () => {
  it("is what is still owed to the organizer, up to the income", () => {
    const transfers = [owed(300), owed(900, true), { ...owed(400), to: "b" }];
    expect(
      unreceivedOf(summary("g", "2026-11-21", { rake: 500 }, { transfers }), INCOME_ITEMS),
    ).toBe(300);
    expect(
      unreceivedOf(summary("g", "2026-11-21", { rake: 200 }, { transfers }), INCOME_ITEMS),
    ).toBe(200);
  });

  it("is nothing for a game that brought in nothing or lost", () => {
    const transfers = [owed(300)];
    expect(unreceivedOf(summary("g", "2026-11-21", {}, { transfers }), INCOME_ITEMS)).toBe(0);
    expect(
      unreceivedOf(summary("g", "2026-11-21", { insurance: -500 }, { transfers }), INCOME_ITEMS),
    ).toBe(0);
  });

  it("follows the items asked for", () => {
    const game = summary("g", "2026-11-21", { rake: 500, wage: 100 }, { transfers: [owed(400)] });
    expect(unreceivedOf(game, ["wage"])).toBe(100);
  });
});

describe("periods", () => {
  it("shifts months across years", () => {
    expect(shiftMonth("2026-11", 2)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-06", 0)).toBe("2026-06");
  });

  it("shifts days across months and years", () => {
    expect(shiftDay("2026-11-23", -6)).toBe("2026-11-17");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("covers each choice counted back from today", () => {
    // 2026-11-23 is a Monday and 2026-11-29 the Sunday after it
    expect(periodOf("thisWeek", "2026-11-23")).toEqual({ from: "2026-11-23", to: "2026-11-29" });
    expect(periodOf("thisWeek", "2026-11-29")).toEqual({ from: "2026-11-23", to: "2026-11-29" });
    expect(periodOf("lastWeek", "2026-11-05")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(periodOf("last6Months", "2026-02-10")).toEqual({ from: "2025-09-01", to: "2026-02-31" });
    expect(periodOf("thisMonth", "2026-11-23")).toEqual(monthPeriod("2026-11"));
    expect(periodOf("lastMonth", "2026-01-05")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodOf("last3Months", "2026-11-23")).toEqual({ from: "2026-09-01", to: "2026-11-31" });
    expect(periodOf("thisYear", "2026-11-23")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(periodOf("all", "2026-11-23")).toEqual({});
  });

  it("lists the months up to this one, oldest first", () => {
    expect(recentMonths("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("incomeReport", () => {
  const games = [
    summary("old", "2026-10-31", { rake: 1000 }),
    summary("first", "2026-11-01", { rake: 500, wage: 200 }, { transfers: [owed(400)] }),
    summary("none", "2026-11-10", {}),
    summary("last", "2026-11-30", { insurance: -100, tableFee: 300 }, { absorbed: cents(-50) }),
    summary("aud", "2026-11-15", { rake: 9999 }, { currency: "AUD" }),
  ];

  it("counts a bad debt apart from what is in and what is still expected", () => {
    const transfers = [
      { from: "a", to: ORGANIZER_PLAYER_ID, amount: cents(300), done: false, bad: true as const },
      { from: "b", to: ORGANIZER_PLAYER_ID, amount: cents(400), done: false },
      { from: "c", to: ORGANIZER_PLAYER_ID, amount: cents(900), done: true },
    ];
    const games = [summary("bad", "2026-11-05", { rake: 600 }, { transfers })];
    const report = incomeReport(
      games,
      { currency: "CNY", items: INCOME_ITEMS },
      { from: "2026-11-01", to: "2026-11-30" },
    );
    // 600 of income: 300 is a bad debt, and of the 400 still owed only 300 is income
    expect(report).toMatchObject({
      total: 600,
      badDebt: 300,
      unreceived: 300,
      received: 0,
      badDebtGames: 1,
    });
  });

  it("takes the games of the period and the currency, newest first, with those that brought in nothing", () => {
    const report = incomeReport(games, all, monthPeriod("2026-11"));
    expect(report.games.map(({ summary: { id } }) => id)).toEqual(["last", "none", "first"]);
    expect(report).toMatchObject({
      total: 900,
      unreceived: 400,
      received: 500,
      unreceivedGames: 1,
      byItem: { rake: 500, insurance: -100, wage: 200, tableFee: 300 },
      gamesByItem: { rake: 1, insurance: 1, wage: 1, tableFee: 1 },
      absorbed: -50,
    });
  });

  it("leaves an item out of the totals when it is not asked for, and still says what it came to", () => {
    const report = incomeReport(
      games,
      { currency: "CNY", items: ["wage", "tableFee"] },
      monthPeriod("2026-11"),
    );
    expect(report.total).toBe(500);
    expect(report.unreceived).toBe(200);
    expect(report.byItem.rake).toBe(500);
  });

  it("takes every game with no period", () => {
    expect(incomeReport(games, all, {}).games).toHaveLength(4);
    expect(incomeReport(games, { ...all, currency: "AUD" }, {}).total).toBe(9999);
  });

  it("is empty with no games", () => {
    expect(incomeReport([], all, {})).toMatchObject({
      games: [],
      total: 0,
      received: 0,
      unreceived: 0,
    });
  });
});

describe("incomeSeries", () => {
  it("cuts a span into four weeks or four months that end with today's", () => {
    const weeks = trendPeriods("weeks4", "2026-11-25");
    expect(weeks).toHaveLength(4);
    expect(weeks[0]).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(weeks.at(-1)).toEqual({ from: "2026-11-23", to: "2026-11-29" });
    expect(trendPeriods("months4", "2026-02-10")).toEqual(
      ["2025-11", "2025-12", "2026-01", "2026-02"].map((month) => monthPeriod(month)),
    );
  });

  it("adds up every item of each period, whatever is ticked elsewhere", () => {
    const games = [
      summary("a", "2026-11-17", { rake: 500, insurance: -200 }),
      summary("b", "2026-11-22", { wage: 300 }),
      summary("c", "2026-11-23", { tableFee: 100 }),
      summary("aud", "2026-11-23", { rake: 9999 }, { currency: "AUD" }),
    ];
    const series = incomeSeries(games, "CNY", trendPeriods("weeks4", "2026-11-23").slice(-2));
    expect(series.map(({ total }) => total)).toEqual([600, 100]);
    expect(series.reduce((all, { games }) => all + games, 0)).toBeGreaterThan(0);
    expect(series[0]?.byItem).toEqual({ rake: 500, insurance: -200, wage: 300, tableFee: 0 });
  });
});
