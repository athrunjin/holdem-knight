import { cents, type Game, type InsuranceRule, type WageRule } from "@holdem-knight/core";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HISTORY_STATE,
  DEFAULT_HISTORY_VIEW,
  historyGames,
  isFiltered,
  parseHistoryState,
} from "./game-history";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY_MS;

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

describe("historyGames", () => {
  it("keeps only settled games, newest first", () => {
    expect(ids(historyGames(GAMES, DEFAULT_HISTORY_VIEW, NOW))).toEqual([
      "pending-cny",
      "complete-aud",
      "complete-cny",
      "pending-aud",
    ]);
  });

  it("puts the oldest first when asked", () => {
    const view = { ...DEFAULT_HISTORY_VIEW, newestFirst: false };
    expect(ids(historyGames(GAMES, view, NOW))).toEqual([
      "pending-aud",
      "complete-cny",
      "complete-aud",
      "pending-cny",
    ]);
  });

  it("filters by stage", () => {
    expect(ids(historyGames(GAMES, { ...DEFAULT_HISTORY_VIEW, stage: "pending" }, NOW))).toEqual([
      "pending-cny",
      "pending-aud",
    ]);
    expect(ids(historyGames(GAMES, { ...DEFAULT_HISTORY_VIEW, stage: "complete" }, NOW))).toEqual([
      "complete-aud",
      "complete-cny",
    ]);
  });

  it("filters by the past week and the past month", () => {
    expect(ids(historyGames(GAMES, { ...DEFAULT_HISTORY_VIEW, period: "week" }, NOW))).toEqual([
      "pending-cny",
      "complete-aud",
    ]);
    expect(ids(historyGames(GAMES, { ...DEFAULT_HISTORY_VIEW, period: "month" }, NOW))).toEqual([
      "pending-cny",
      "complete-aud",
      "complete-cny",
    ]);
  });

  it("filters by currency, together with the other filters", () => {
    const view = { ...DEFAULT_HISTORY_VIEW, currency: "AUD" as const };
    expect(ids(historyGames(GAMES, view, NOW))).toEqual(["complete-aud", "pending-aud"]);
    expect(ids(historyGames(GAMES, { ...view, stage: "pending", period: "month" }, NOW))).toEqual(
      [],
    );
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
      ids(historyGames(games, { ...DEFAULT_HISTORY_VIEW, options }, NOW));

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

describe("isFiltered", () => {
  it("is off for the default view, whatever the stage and the order", () => {
    expect(isFiltered(DEFAULT_HISTORY_VIEW)).toBe(false);
    expect(isFiltered({ ...DEFAULT_HISTORY_VIEW, stage: "pending", newestFirst: false })).toBe(
      false,
    );
  });

  it("is on with a period, a currency or an option switched off", () => {
    expect(isFiltered({ ...DEFAULT_HISTORY_VIEW, period: "week" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_HISTORY_VIEW, currency: "CNY" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_HISTORY_VIEW, options: ["insurance"] })).toBe(true);
  });
});

describe("parseHistoryState", () => {
  it("reads back a state as it was kept", () => {
    const state = {
      open: false,
      filtering: false,
      view: {
        stage: "complete",
        period: "month",
        currency: "AUD",
        options: ["insurance", "rake"],
        newestFirst: false,
      },
    };
    expect(parseHistoryState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(parseHistoryState(JSON.parse(JSON.stringify(DEFAULT_HISTORY_STATE)))).toEqual(
      DEFAULT_HISTORY_STATE,
    );
  });

  it("keeps the options it knows, in the fixed order", () => {
    const view = { ...DEFAULT_HISTORY_VIEW, options: ["rake", "tips", "insurance"] };
    expect(parseHistoryState({ open: true, filtering: true, view })?.view.options).toEqual([
      "insurance",
      "rake",
    ]);
  });

  it("gives nothing for anything else", () => {
    const kept = { open: true, filtering: true, view: DEFAULT_HISTORY_VIEW };
    expect(parseHistoryState(null)).toBeUndefined();
    expect(parseHistoryState("open")).toBeUndefined();
    expect(parseHistoryState({ ...kept, open: "yes" })).toBeUndefined();
    expect(parseHistoryState({ open: true, filtering: true })).toBeUndefined();
    expect(
      parseHistoryState({ ...kept, view: { ...kept.view, stage: "archived" } }),
    ).toBeUndefined();
    expect(parseHistoryState({ ...kept, view: { ...kept.view, currency: "USD" } })).toBeUndefined();
    expect(parseHistoryState({ ...kept, view: { ...kept.view, options: "all" } })).toBeUndefined();
  });
});
