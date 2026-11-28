import {
  cents,
  type Game,
  type GameSummary,
  type InsuranceRule,
  type WageRule,
} from "@holdem-knight/core";
import { describe, expect, it } from "vitest";
import {
  clearedView,
  DEFAULT_HISTORY_STATE,
  DEFAULT_HISTORY_VIEW,
  hasBadDebt,
  historyChoices,
  historyGames,
  owesTransfers,
  parseHistoryState,
} from "./game-history";

const DAY_MS = 24 * 60 * 60 * 1000;
// Noon on Wednesday 2026-11-18, on this device
const NOW = new Date(2026, 10, 18, 12).getTime();
const TODAY = "2026-11-18";

function game(id: string, daysAgo: number, rest: Partial<Game> = {}): Game {
  return {
    id,
    organizerId: "guest",
    currency: "CNY",
    smallBlindChips: 1,
    bigBlindChips: 2,
    chipRatio: { chips: 1, amount: cents(100) },
    status: "settled",
    createdAt: NOW - daysAgo * DAY_MS,
    ...rest,
  };
}

const GAMES = [
  game("open", 0, { status: "open" }),
  game("settling", 1, { status: "settling" }),
  game("pending-cny", 2),
  game("complete-aud", 6, { currency: "AUD", allReceived: true }),
  game("complete-cny", 20, { allReceived: true }),
  game("pending-aud", 40, { currency: "AUD" }),
];

const ids = (games: readonly Game[]) => games.map(({ id }) => id);

/** The default view over every period, so a test of one filter is not also a test of this month. */
const ALL_TIME = { ...DEFAULT_HISTORY_VIEW, period: "all" as const };

describe("historyGames", () => {
  it("keeps only settled games, newest first", () => {
    expect(ids(historyGames(GAMES, ALL_TIME, TODAY))).toEqual([
      "pending-cny",
      "complete-aud",
      "complete-cny",
      "pending-aud",
    ]);
  });

  it("puts the oldest first when asked", () => {
    const view = { ...ALL_TIME, newestFirst: false };
    expect(ids(historyGames(GAMES, view, TODAY))).toEqual([
      "pending-aud",
      "complete-cny",
      "complete-aud",
      "pending-cny",
    ]);
  });

  it("lists only the games still owed transfers when asked, in the order chosen", () => {
    const view = { ...ALL_TIME, onlyUnsettled: true };
    expect(ids(historyGames(GAMES, view, TODAY))).toEqual(["pending-cny", "pending-aud"]);
    expect(ids(historyGames(GAMES, { ...view, newestFirst: false }, TODAY))).toEqual([
      "pending-aud",
      "pending-cny",
    ]);
  });

  it("goes by a game's summary where there is one, whatever the game's own mark says", () => {
    const transfer = { from: "a", to: "b", amount: cents(100) };
    const summaries = [
      { id: "pending-cny", transfers: [{ ...transfer, done: true }] },
      { id: "pending-aud", transfers: [] },
      { id: "complete-cny", transfers: [{ ...transfer, done: false }] },
    ] as unknown as GameSummary[];
    const view = { ...ALL_TIME, onlyUnsettled: true };
    // Every transfer made and none to make are settled up. One still to make is not
    expect(ids(historyGames(GAMES, view, TODAY, summaries))).toEqual(["complete-cny"]);
  });

  it("filters by the days the income page cuts", () => {
    const within = (period: (typeof DEFAULT_HISTORY_VIEW)["period"]) =>
      ids(historyGames(GAMES, { ...ALL_TIME, period }, TODAY));
    // Monday the 16th to Sunday the 22nd, and the week before it
    expect(within("thisWeek")).toEqual(["pending-cny"]);
    expect(within("lastWeek")).toEqual(["complete-aud"]);
    expect(within("thisMonth")).toEqual(["pending-cny", "complete-aud"]);
    expect(within("lastMonth")).toEqual(["complete-cny", "pending-aud"]);
  });

  it("filters by a ratio and blinds a new game offers", () => {
    const games = [
      game("small", 1),
      game("mid", 2, { smallBlindChips: 5, bigBlindChips: 10 }),
      game("five", 3, { chipRatio: { chips: 5, amount: cents(100) } }),
      game("odd", 4, { smallBlindChips: 3, bigBlindChips: 7 }),
    ];
    const view = ALL_TIME;
    expect(historyChoices(games, view, TODAY)).toEqual({
      ratios: [
        { value: "1:100", chips: 1 },
        { value: "5:100", chips: 5 },
      ],
      blinds: [
        { value: "1/2", name: "1 / 2" },
        { value: "5/10", name: "5 / 10" },
      ],
    });
    expect(ids(historyGames(games, { ...view, blinds: "5/10" }, TODAY))).toEqual(["mid"]);
    expect(ids(historyGames(games, { ...view, ratio: "5:100" }, TODAY))).toEqual(["five"]);
    // One the games on offer do not have narrows nothing
    expect(ids(historyGames(games, { ...view, blinds: "3/7" }, TODAY))).toHaveLength(4);
  });

  it("filters by currency, together with the other filters", () => {
    const view = { ...ALL_TIME, currency: "AUD" as const };
    expect(ids(historyGames(GAMES, view, TODAY))).toEqual(["complete-aud", "pending-aud"]);
    expect(
      ids(historyGames(GAMES, { ...view, onlyUnsettled: true, period: "thisWeek" }, TODAY)),
    ).toEqual([]);
  });

  it("leaves out games with an option that is switched off", () => {
    // Only whether a rule is there matters, not what it says
    const insurance = {} as InsuranceRule;
    const wage = {} as WageRule;
    const games = [
      game("plain", 1),
      game("insured", 2, { insurance }),
      game("waged", 3, { wage }),
      game("both", 4, { insurance, wage }),
    ];
    const only = (options: (typeof DEFAULT_HISTORY_VIEW)["options"]) =>
      ids(historyGames(games, { ...ALL_TIME, options }, TODAY));

    expect(only(["insurance", "wage", "tableFee", "rake"])).toEqual([
      "plain",
      "insured",
      "waged",
      "both",
    ]);
    expect(only(["wage", "tableFee", "rake"])).toEqual(["plain", "waged"]);
    expect(only(["insurance"])).toEqual(["plain", "insured"]);
    expect(only([])).toEqual(["plain"]);
  });
});

describe("owesTransfers and hasBadDebt", () => {
  const transfer = { from: "a", to: "b", amount: cents(100), done: false };
  const withTransfers = (transfers: unknown[]) => ({ transfers }) as unknown as GameSummary;
  const settled = game("g", 1);

  it("counts a bad debt as a bad debt, and not as a transfer still to make", () => {
    const bad = withTransfers([{ ...transfer, bad: true }]);
    expect(owesTransfers(settled, bad)).toBe(false);
    expect(hasBadDebt(bad)).toBe(true);
    const both = withTransfers([transfer, { ...transfer, from: "c", bad: true }]);
    expect(owesTransfers(settled, both)).toBe(true);
    expect(hasBadDebt(both)).toBe(true);
  });

  it("has neither for a game with every transfer made, or none read yet", () => {
    const made = withTransfers([{ ...transfer, done: true }]);
    expect(owesTransfers(settled, made)).toBe(false);
    expect(hasBadDebt(made)).toBe(false);
    expect(hasBadDebt(undefined)).toBe(false);
  });
});

describe("clearedView", () => {
  it("puts every filter and the currency back, and keeps the period and the order", () => {
    const view = {
      period: "lastMonth" as const,
      currency: "AUD" as const,
      ratio: "1:100",
      blinds: "1/2",
      onlyUnsettled: true,
      options: ["insurance" as const],
      newestFirst: false,
    };
    expect(clearedView(view)).toEqual({
      ...DEFAULT_HISTORY_VIEW,
      period: "lastMonth",
      newestFirst: false,
    });
  });
});

describe("parseHistoryState", () => {
  it("reads back a state as it was kept", () => {
    const state = {
      open: false,
      view: {
        period: "lastMonth",
        currency: "AUD",
        ratio: "5:100",
        blinds: "1/2",
        onlyUnsettled: true,
        options: ["insurance", "rake"],
        newestFirst: false,
      },
    };
    expect(parseHistoryState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(parseHistoryState(JSON.parse(JSON.stringify(DEFAULT_HISTORY_STATE)))).toEqual(
      DEFAULT_HISTORY_STATE,
    );
  });

  it("reads a state kept with whether its filters were on show, and drops that", () => {
    const kept = { open: true, filtering: false, view: DEFAULT_HISTORY_VIEW };
    expect(parseHistoryState(JSON.parse(JSON.stringify(kept)))).toEqual(DEFAULT_HISTORY_STATE);
  });

  it("keeps the options it knows, in the fixed order", () => {
    const view = { ...DEFAULT_HISTORY_VIEW, options: ["rake", "tips", "insurance"] };
    expect(parseHistoryState({ open: true, view })?.view.options).toEqual(["insurance", "rake"]);
  });

  it("gives nothing for anything else", () => {
    const kept = { open: true, view: DEFAULT_HISTORY_VIEW };
    expect(parseHistoryState(null)).toBeUndefined();
    expect(parseHistoryState("open")).toBeUndefined();
    expect(parseHistoryState({ ...kept, open: "yes" })).toBeUndefined();
    expect(parseHistoryState({ open: true })).toBeUndefined();
    expect(parseHistoryState({ ...kept, view: { ...kept.view, period: "week" } })).toBeUndefined();
    expect(parseHistoryState({ ...kept, view: { ...kept.view, currency: "USD" } })).toBeUndefined();
    expect(parseHistoryState({ ...kept, view: { ...kept.view, options: "all" } })).toBeUndefined();
  });
});
