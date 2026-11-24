import {
  CURRENCIES,
  type Currency,
  type Game,
  type GameSummary,
  gameStage,
  inPeriod,
  PERIOD_CHOICES,
  type PeriodChoice,
  periodOf,
} from "@holdem-knight/core";
import { gameDay } from "./game-day";
import { blindsKey, filterChoices, ratioKey } from "./income-filter";

/** What a game can charge or offer, in the order shown. */
export const GAME_OPTIONS = ["insurance", "wage", "tableFee", "rake"] as const;
export type GameOption = (typeof GAME_OPTIONS)[number];

export interface HistoryView {
  /** The days the games started on, as the income page cuts them */
  readonly period: PeriodChoice;
  readonly currency: Currency | "all";
  /** A chip ratio and the blinds as `ratioKey` and `blindsKey` give them. Missing for any. */
  readonly ratio?: string | undefined;
  readonly blinds?: string | undefined;
  /** Lists only the games still owed transfers. Off lists them all. */
  readonly onlyUnsettled: boolean;
  /** The options a listed game may have on. A game with one that is missing here is left out. */
  readonly options: readonly GameOption[];
  readonly newestFirst: boolean;
}

export const DEFAULT_HISTORY_VIEW: HistoryView = {
  period: "thisMonth",
  currency: "all",
  onlyUnsettled: false,
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

const PERIODS: readonly unknown[] = PERIOD_CHOICES;
const text = (value: unknown) => (typeof value === "string" ? value : undefined);
const CURRENCY_CHOICES: readonly unknown[] = ["all", ...CURRENCIES];

/** Reads back a state that was kept between visits. Anything that is not one gives nothing. */
export function parseHistoryState(stored: unknown): HistoryState | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { open, filtering, view } = stored as Record<string, unknown>;
  if (typeof open !== "boolean" || typeof filtering !== "boolean") return undefined;
  if (typeof view !== "object" || view === null) return undefined;
  const { period, currency, ratio, blinds, onlyUnsettled, options, newestFirst } = view as Record<
    string,
    unknown
  >;
  if (!PERIODS.includes(period)) return undefined;
  if (!CURRENCY_CHOICES.includes(currency) || !Array.isArray(options)) return undefined;
  if (typeof newestFirst !== "boolean" || typeof onlyUnsettled !== "boolean") return undefined;
  return {
    open,
    filtering,
    view: {
      period: period as PeriodChoice,
      currency: currency as Currency | "all",
      ratio: text(ratio),
      blinds: text(blinds),
      onlyUnsettled,
      options: GAME_OPTIONS.filter((option) => options.includes(option)),
      newestFirst,
    },
  };
}

/**
 * Whether the filters leave out any game. The period is no filter: it is chosen in the heading,
 * where it shows.
 */
export function isFiltered({ currency, ratio, blinds, onlyUnsettled, options }: HistoryView) {
  return (
    currency !== "all" ||
    ratio !== undefined ||
    blinds !== undefined ||
    onlyUnsettled ||
    options.length < GAME_OPTIONS.length
  );
}

export function hasOption(game: Game, option: GameOption) {
  return game[option] !== undefined;
}

/**
 * Whether a settled game still has transfers to be made, bad debts aside. Its summary says so from
 * the transfers themselves, each with its tick. Until that is read, the game's own saved mark stands in, which a
 * game brought in from elsewhere may lack.
 */
export function owesTransfers(game: Game, summary: GameSummary | undefined): boolean {
  if (game.status !== "settled") return false;
  return summary
    ? summary.transfers.some(({ done, bad }) => !done && !bad)
    : gameStage(game) === "pending";
}

/** Whether a settled game has a transfer set down as a bad debt. */
export function hasBadDebt(summary: GameSummary | undefined): boolean {
  return summary?.transfers.some(({ done, bad }) => !done && bad) ?? false;
}

const settledIn = (games: readonly Game[], view: HistoryView, today: string) => {
  const days = periodOf(view.period, today);
  return games.filter((game) => game.status === "settled" && inPeriod(days, gameDay(game)));
};

/**
 * The ratios and blinds the view can narrow to: those a new game offers that some settled game of
 * its period and currency has, as on the income page.
 */
export function historyChoices(games: readonly Game[], view: HistoryView, today: string) {
  return filterChoices(settledIn(games, view, today), view.currency);
}

/**
 * Settled games that match the view, ordered by when each started. A ratio or blinds the view's
 * period no longer offers counts as none chosen.
 */
export function historyGames(
  games: readonly Game[],
  view: HistoryView,
  today: string,
  summaries: readonly GameSummary[] = [],
): Game[] {
  const summaryOf = new Map(summaries.map((summary) => [summary.id, summary]));
  const inDays = settledIn(games, view, today);
  const offered = filterChoices(inDays, view.currency);
  const ratio = offered.ratios.find(({ value }) => value === view.ratio)?.value;
  const blinds = offered.blinds.find(({ value }) => value === view.blinds)?.value;
  return inDays
    .filter(
      (game) =>
        (!view.onlyUnsettled || owesTransfers(game, summaryOf.get(game.id))) &&
        (view.currency === "all" || game.currency === view.currency) &&
        (!ratio || ratioKey(game) === ratio) &&
        (!blinds || blindsKey(game) === blinds) &&
        GAME_OPTIONS.every((option) => view.options.includes(option) || !hasOption(game, option)),
    )
    .sort((a, b) => (view.newestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
}
