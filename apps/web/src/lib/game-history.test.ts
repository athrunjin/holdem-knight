import {
  cents,
  type Game,
  type GameSummary,
  type InsuranceRule,
  type WageRule,
} from "@holdem-knight/core";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HISTORY_STATE,
  DEFAULT_HISTORY_VIEW,
  historyChoices,
  historyGames,
  isFiltered,
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

describe("historyGames", () => {
  it("keeps only settled games, newest first", () => {
    expect(ids(historyGames(GAMES, DEFAULT_HISTORY_VIEW, TODAY))).toEqual([
      "pending-cny",
      "complete-aud",
      "complete-cny",
      "pending-aud",
    ]);
  });

  it("puts the oldest first when asked", () => {
    const view = { ...DEFAULT_HISTORY_VIEW, newestFirst: false };
    expect(ids(historyGames(GAMES, view, TODAY))).toEqual([
      "pending-aud",
      "complete-cny",
      "complete-aud",
      "pending-cny",
    ]);
  });

  it("leaves out games still owed transfers when asked", () => {
    const view = { ...DEFAULT_HISTORY_VIEW, unsettled: false };
    expect(ids(historyGames(GAMES, view, TODAY))).toEqual(["complete-aud", "complete-cny"]);
  });

  it("goes by a game's summary where there is one, whatever the game's own mark says", () => {
    const transfer = { from: "a", to: "b", amount: cents(100) };
    const summaries = [
      { id: "pending-cny", transfers: [{ ...transfer, done: true }] },
      { id: "pending-aud", transfers: [] },
      { id: "complete-cny", transfers: [{ ...transfer, done: false }] },
    ] as unknown as GameSummary[];
    const view = { ...DEFAULT_HISTORY_VIEW, unsettled: false };
    // Every transfer made, none to make, and one still to make
    expect(ids(historyGames(GAMES, view, TODAY, summaries))).toEqual([
      "pending-cny",
      "complete-aud",
      "pending-aud",
    ]);
  });

  it("filters by the days the income page cuts", () => {
    const within = (period: (typeof DEFAULT_HISTORY_VIEW)["period"]) =>
      ids(historyGames(GAMES, { ...DEFAULT_HISTORY_VIEW, period }, TODAY));
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
    const view = DEFAULT_HISTORY_VIEW;
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
    const view = { ...DEFAULT_HISTORY_VIEW, currency: "AUD" as const };
    expect(ids(historyGames(GAMES, view, TODAY))).toEqual(["complete-aud", "pending-aud"]);
    expect(
      ids(historyGames(GAMES, { ...view, unsettled: false, period: "lastMonth" }, TODAY)),
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
      ids(historyGames(games, { ...DEFAULT_HISTORY_VIEW, options }, TODAY));

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
  it("is off for the default view, whatever the order", () => {
    expect(isFiltered(DEFAULT_HISTORY_VIEW)).toBe(false);
    expect(isFiltered({ ...DEFAULT_HISTORY_VIEW, newestFirst: false })).toBe(false);
  });

  it("is on with a period, a currency or an option switched off", () => {
    expect(isFiltered({ ...DEFAULT_HISTORY_VIEW, period: "thisWeek" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_HISTORY_VIEW, blinds: "1/2" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_HISTORY_VIEW, unsettled: false })).toBe(true);
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
        period: "lastMonth",
        currency: "AUD",
        ratio: "5:100",
        blinds: "1/2",
        unsettled: false,
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
    expect(parseHistoryState({ ...kept, view: { ...kept.view, period: "week" } })).toBeUndefined();
    expect(parseHistoryState({ ...kept, view: { ...kept.view, currency: "USD" } })).toBeUndefined();
    expect(parseHistoryState({ ...kept, view: { ...kept.view, options: "all" } })).toBeUndefined();
  });
});
