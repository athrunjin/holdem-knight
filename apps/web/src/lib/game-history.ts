import {
  CURRENCIES,
  type Currency,
  type Game,
  gameStage,
  type Timestamp,
} from "@holdem-knight/core";

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

/** How the history section was left: unfolded or not, with its filters on show or not. */
export interface HistoryState {
  readonly open: boolean;
  readonly filtering: boolean;
  readonly view: HistoryView;
}

/** History is unfolded with its filters on show until it has been left another way. */
export const DEFAULT_HISTORY_STATE: HistoryState = {
  open: true,
  filtering: true,
  view: DEFAULT_HISTORY_VIEW,
};

const STAGES: readonly unknown[] = ["all", "pending", "complete"] satisfies HistoryStage[];
const PERIODS: readonly unknown[] = ["all", "week", "month"] satisfies HistoryPeriod[];
const CURRENCY_CHOICES: readonly unknown[] = ["all", ...CURRENCIES];

/** Reads back a state that was kept between visits. Anything that is not one gives nothing. */
export function parseHistoryState(stored: unknown): HistoryState | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { open, filtering, view } = stored as Record<string, unknown>;
  if (typeof open !== "boolean" || typeof filtering !== "boolean") return undefined;
  if (typeof view !== "object" || view === null) return undefined;
  const { stage, period, currency, options, newestFirst } = view as Record<string, unknown>;
  if (!STAGES.includes(stage) || !PERIODS.includes(period)) return undefined;
  if (!CURRENCY_CHOICES.includes(currency) || !Array.isArray(options)) return undefined;
  if (typeof newestFirst !== "boolean") return undefined;
  return {
    open,
    filtering,
    view: {
      stage: stage as HistoryStage,
      period: period as HistoryPeriod,
      currency: currency as Currency | "all",
      options: GAME_OPTIONS.filter((option) => options.includes(option)),
      newestFirst,
    },
  };
}

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
