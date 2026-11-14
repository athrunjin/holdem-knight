import { type Currency, type Game, gameStage, type Timestamp } from "@holdem-knight/core";

export type HistoryStage = "all" | "pending" | "complete";
export type HistoryPeriod = "all" | "week" | "month";

/** What a game can charge or offer, in the order shown. */
export const GAME_OPTIONS = ["insurance", "wage", "tableFee", "rake"] as const;
export type GameOption = (typeof GAME_OPTIONS)[number];

export interface HistoryView {
  readonly stage: HistoryStage;
  readonly period: HistoryPeriod;
  readonly currency: Currency | "all";
  /** The options a listed game may have on. A game with one that is missing here is left out. */
  readonly options: readonly GameOption[];
  readonly newestFirst: boolean;
}

export const DEFAULT_HISTORY_VIEW: HistoryView = {
  stage: "all",
  period: "all",
  currency: "all",
  options: GAME_OPTIONS,
  newestFirst: true,
};

/** Whether the view leaves out any game for when it started, its currency or its options. */
export function isFiltered({ period, currency, options }: HistoryView) {
  return period !== "all" || currency !== "all" || options.length < GAME_OPTIONS.length;
}

/** Rake has no setting until M4, so no game has it on yet. */
export function hasOption(game: Game, option: GameOption) {
  return option !== "rake" && game[option] !== undefined;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const PERIOD_DAYS: Record<Exclude<HistoryPeriod, "all">, number> = { week: 7, month: 30 };

/** Settled games that match the view, ordered by when each started. */
export function historyGames(games: readonly Game[], view: HistoryView, now: Timestamp): Game[] {
  const since = view.period === "all" ? undefined : now - PERIOD_DAYS[view.period] * DAY_MS;
  return games
    .filter(
      (game) =>
        game.status === "settled" &&
        (view.stage === "all" || gameStage(game) === view.stage) &&
        (view.currency === "all" || game.currency === view.currency) &&
        GAME_OPTIONS.every((option) => view.options.includes(option) || !hasOption(game, option)) &&
        (since === undefined || game.createdAt >= since),
    )
    .sort((a, b) => (view.newestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
}
