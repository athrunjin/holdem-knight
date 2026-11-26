import {
  type Currency,
  cents,
  type GameSummary,
  INCOME_ITEMS,
  incomeReport,
  periodOf,
} from "@holdem-knight/core";
import { describe, expect, it } from "vitest";
import {
  currencyShown,
  INCOME_VIEW_FALLBACK,
  incomeShown,
  parseIncomeItems,
  parseIncomeView,
  parseTransfersView,
} from "./report-views";

const TODAY = "2026-11-26";

function summary(
  id: string,
  currency: Currency,
  day: string,
  extra: { chips?: number; blinds?: [number, number]; rake?: number } = {},
): GameSummary {
  const [small, big] = extra.blinds ?? [5, 10];
  return {
    id,
    organizerId: "o",
    basis: "b",
    startedAt: Date.parse(`${day}T20:00:00Z`),
    day,
    settledAt: Date.parse(`${day}T23:00:00Z`),
    currency,
    chipRatio: { chips: extra.chips ?? 1, amount: cents(100) },
    smallBlindChips: small,
    bigBlindChips: big,
    playerCount: 6,
    income: {
      insurance: cents(0),
      wage: cents(1000),
      tableFee: cents(500),
      rake: cents(extra.rake ?? 2000),
    },
    difference: cents(0),
    absorbed: cents(0),
    players: [],
    transfers: [],
  } as unknown as GameSummary;
}

describe("currencyShown", () => {
  it("keeps the kept currency where there are games in it", () => {
    const games = [summary("a", "CNY", "2026-11-01"), summary("b", "AUD", "2026-11-20")];
    expect(currencyShown(games, "AUD")).toBe("AUD");
  });

  it("opens on panda points where any game has them, though a newer game is in another", () => {
    const games = [summary("a", "CNY", "2026-11-01"), summary("b", "AUD", "2026-11-20")];
    expect(currencyShown(games, undefined)).toBe("CNY");
  });

  it("gives up a kept currency no game is in", () => {
    const games = [summary("a", "CNY", "2026-11-01")];
    expect(currencyShown(games, "AUD")).toBe("CNY");
  });

  it("takes the newest game's currency where there are no panda points", () => {
    expect(currencyShown([summary("b", "AUD", "2026-11-20")], undefined)).toBe("AUD");
  });

  it("has none without games", () => {
    expect(currencyShown([], "CNY")).toBeUndefined();
  });
});

describe("parseIncomeView", () => {
  it("reads a kept view", () => {
    expect(
      parseIncomeView({ period: "lastMonth", currency: "AUD", ratio: "5:100", blinds: "5/10" }),
    ).toEqual({ period: "lastMonth", currency: "AUD", ratio: "5:100", blinds: "5/10" });
  });

  it("drops an unknown currency and filters that are not text", () => {
    expect(parseIncomeView({ period: "thisWeek", currency: "EUR", ratio: 5 })).toEqual({
      period: "thisWeek",
      currency: undefined,
      ratio: undefined,
      blinds: undefined,
    });
  });

  it("gives way to the fallback for an unknown period or no object", () => {
    expect(parseIncomeView({ period: "custom" })).toBeUndefined();
    expect(parseIncomeView(null)).toBeUndefined();
    expect(parseIncomeView("thisMonth")).toBeUndefined();
  });
});

describe("parseIncomeItems", () => {
  it("keeps the known items in their fixed order", () => {
    expect(parseIncomeItems(["rake", "nope", "insurance"])).toEqual(["insurance", "rake"]);
  });

  it("gives way to the fallback for anything but a list", () => {
    expect(parseIncomeItems("rake")).toBeUndefined();
  });
});

describe("parseTransfersView", () => {
  it("reads a kept view", () => {
    expect(parseTransfersView({ done: true, period: "lastWeek", currency: "AUD" })).toEqual({
      done: true,
      period: "lastWeek",
      currency: "AUD",
    });
  });

  it("gives way to the fallback without a flag or a known period", () => {
    expect(parseTransfersView({ period: "lastWeek" })).toBeUndefined();
    expect(parseTransfersView({ done: false, period: "soon" })).toBeUndefined();
  });
});

describe("incomeShown", () => {
  const games = [
    summary("a", "CNY", "2026-11-03", { chips: 5, rake: 3000 }),
    summary("b", "CNY", "2026-11-10", { chips: 1 }),
    summary("c", "CNY", "2026-10-12", { chips: 5 }),
    summary("d", "AUD", "2026-11-25", { blinds: [10, 20] }),
  ];

  it("opens on this month in panda points with all four items", () => {
    const shown = incomeShown(games, INCOME_VIEW_FALLBACK, INCOME_ITEMS, TODAY);
    expect(shown.currency).toBe("CNY");
    expect(shown.period).toBe("thisMonth");
    expect(shown.currencies).toEqual(["AUD", "CNY"]);
    expect(shown.report).toEqual(
      incomeReport(
        games.filter((g) => g.currency === "CNY"),
        { currency: "CNY", items: INCOME_ITEMS },
        periodOf("thisMonth", TODAY),
      ),
    );
    expect(shown.report.games).toHaveLength(2);
  });

  it("follows a kept period, currency and items", () => {
    const shown = incomeShown(
      games,
      { period: "lastMonth", currency: "CNY" },
      ["wage", "tableFee"],
      TODAY,
    );
    expect(shown.report.games).toHaveLength(1);
    expect(shown.report.total).toBe(cents(1500));
  });

  it("narrows to a kept ratio the period's games offer", () => {
    const shown = incomeShown(games, { period: "thisMonth", ratio: "5:100" }, INCOME_ITEMS, TODAY);
    expect(shown.ratio).toBe("5:100");
    expect(shown.report.games.map((g) => g.summary.id)).toEqual(["a"]);
  });

  it("counts a kept ratio the period's games do not offer as no choice", () => {
    const shown = incomeShown(games, { period: "thisMonth", ratio: "20:100" }, INCOME_ITEMS, TODAY);
    expect(shown.ratio).toBeUndefined();
    expect(shown.report.games).toHaveLength(2);
  });

  it("narrows to kept blinds in the kept currency", () => {
    const shown = incomeShown(
      games,
      { period: "thisMonth", currency: "AUD", blinds: "10/20" },
      INCOME_ITEMS,
      TODAY,
    );
    expect(shown.currency).toBe("AUD");
    expect(shown.blinds).toBe("10/20");
    expect(shown.report.games.map((g) => g.summary.id)).toEqual(["d"]);
  });
});
