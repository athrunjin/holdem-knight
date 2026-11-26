import {
  CURRENCIES,
  type Currency,
  type GameSummary,
  INCOME_ITEMS,
  type IncomeItem,
  type IncomeReport,
  incomeReport,
  inPeriod,
  PERIOD_CHOICES,
  type PeriodChoice,
  periodOf,
} from "@holdem-knight/core";
import { blindsKey, filterChoices, ratioKey } from "./income-filter";

/*
 * What 收益 and 转账 show, as this browser keeps it, and how each page resolves it against the
 * games there are. The pages and their previews on 我的 read it through these, so a preview
 * always equals the page it leads to.
 */

const text = (value: unknown) => (typeof value === "string" ? value : undefined);

/** The currencies there are games in, in the app's own order. */
export const currenciesOf = (summaries: readonly GameSummary[]) =>
  CURRENCIES.filter((c) => summaries.some((s) => s.currency === c));

/**
 * The currency a page shows: the one kept, where there are games in it; otherwise panda points
 * where there are any, and the newest game's currency where there are none.
 */
export function currencyShown(
  summaries: readonly GameSummary[],
  kept: Currency | undefined,
): Currency | undefined {
  const currencies = currenciesOf(summaries);
  if (kept && currencies.includes(kept)) return kept;
  if (currencies.includes("CNY")) return "CNY";
  const newest = summaries.reduce<GameSummary | undefined>(
    (a, b) => (a && a.startedAt >= b.startedAt ? a : b),
    undefined,
  );
  return newest?.currency;
}

// --- 收益 ---

export const INCOME_VIEW_KEY = "income.view.2";
export const INCOME_ITEMS_KEY = "income.items";

/** What 收益 shows, as it was left: the period, and the games it is narrowed to. */
export interface IncomeView {
  readonly period: PeriodChoice;
  /** Missing for the currency the page opens on. */
  readonly currency?: Currency | undefined;
  /** A chip ratio or the blinds as `ratioKey` and `blindsKey` give them. Missing for any. */
  readonly ratio?: string | undefined;
  readonly blinds?: string | undefined;
}

export const INCOME_VIEW_FALLBACK: IncomeView = { period: "thisMonth" };

export function parseIncomeView(stored: unknown): IncomeView | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { period, currency, ratio, blinds } = stored as Record<string, unknown>;
  const kept = PERIOD_CHOICES.find((choice) => choice === period);
  if (!kept) return undefined;
  return {
    period: kept,
    currency: CURRENCIES.find((c) => c === currency),
    ratio: text(ratio),
    blinds: text(blinds),
  };
}

/** The items counted, as this browser keeps them. Anything else kept gives way to all four. */
export function parseIncomeItems(stored: unknown): IncomeItem[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return INCOME_ITEMS.filter((item) => stored.includes(item));
}

/** What 收益 shows for a kept view, resolved against the games there are. */
export interface IncomeShown {
  readonly currencies: readonly Currency[];
  readonly currency: Currency;
  readonly period: PeriodChoice;
  readonly days: ReturnType<typeof periodOf>;
  /** The ratio and blinds in force: a kept one the period's games do not offer counts as none */
  readonly ratio: string | undefined;
  readonly blinds: string | undefined;
  /** The games of the currency, ratio and blinds in force, of every period */
  readonly narrowed: readonly GameSummary[];
  readonly report: IncomeReport;
}

/** Resolves a kept view of 收益. There must be at least one game. */
export function incomeShown(
  summaries: readonly GameSummary[],
  view: IncomeView,
  items: readonly IncomeItem[],
  today: string,
): IncomeShown {
  const currencies = currenciesOf(summaries);
  // There is at least one game, so there is a currency
  const currency = currencyShown(summaries, view.currency) as Currency;
  const { period } = view;
  const days = periodOf(period, today);
  const offered = filterChoices(
    summaries.filter((s) => inPeriod(days, s.day)),
    currency,
  );
  const ratio = offered.ratios.find(({ value }) => value === view.ratio)?.value;
  const blinds = offered.blinds.find(({ value }) => value === view.blinds)?.value;
  const narrowed = summaries.filter(
    (s) =>
      s.currency === currency &&
      (!ratio || ratioKey(s) === ratio) &&
      (!blinds || blindsKey(s) === blinds),
  );
  const report = incomeReport(narrowed, { currency, items }, days);
  return { currencies, currency, period, days, ratio, blinds, narrowed, report };
}

// --- 转账 ---

export const TRANSFERS_VIEW_KEY = "transfers.view";

/** What 转账 shows, as it was left. */
export interface TransfersView {
  /** The transfers made, or the ones still to make */
  readonly done: boolean;
  /** Narrows the transfers made to the games of a period. The ones to make are never narrowed */
  readonly period: PeriodChoice;
  /** Missing for the currency the page opens on */
  readonly currency?: Currency | undefined;
}

export const TRANSFERS_VIEW_FALLBACK: TransfersView = { done: false, period: "thisMonth" };

export function parseTransfersView(stored: unknown): TransfersView | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { done, period, currency } = stored as Record<string, unknown>;
  const kept = PERIOD_CHOICES.find((choice) => choice === period);
  if (typeof done !== "boolean" || !kept) return undefined;
  return { done, period: kept, currency: CURRENCIES.find((c) => c === currency) };
}
