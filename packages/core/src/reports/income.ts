/** What settled games brought the organizer, read from their summaries (ADR 0049). */
import type { Currency, GameSummary, IncomeItem } from "../domain";
import { type Cents, cents, sum } from "../money";
import { ORGANIZER_COLLECTOR } from "../settlement";

/** In the order a report lists them. */
export const INCOME_ITEMS: readonly IncomeItem[] = ["insurance", "wage", "tableFee", "rake"];

/** What a game brought in, counting only the items asked for. Insurance can make it a loss. */
export function incomeOf(summary: GameSummary, items: readonly IncomeItem[]): Cents {
  return sum(
    INCOME_ITEMS.filter((item) => items.includes(item)).map((item) => summary.income[item]),
  );
}

/** The transfers to the organizer still expected: not marked as made, and no bad debts. */
export function owedToOrganizer(summary: GameSummary): Cents {
  return sum(
    summary.transfers
      .filter(({ to, done, bad }) => to === ORGANIZER_COLLECTOR && !done && !bad)
      .map(({ amount }) => amount),
  );
}

/** The transfers to the organizer set down as bad debts, together. */
export function badDebtToOrganizer(summary: GameSummary): Cents {
  return sum(
    summary.transfers
      .filter(({ to, done, bad }) => to === ORGANIZER_COLLECTOR && !done && bad)
      .map(({ amount }) => amount),
  );
}

/**
 * How much of a game's income is set down as a bad debt: what is owed in bad debts, up to the
 * income there is. It is counted before what is still expected, so the two never come to more
 * than the income together.
 */
export function badDebtOf(summary: GameSummary, items: readonly IncomeItem[]): Cents {
  return cents(Math.max(0, Math.min(incomeOf(summary, items), badDebtToOrganizer(summary))));
}

/**
 * How much of a game's income is still to come in. Transfers carry wins, losses and charges in
 * one amount, so no transfer is the income itself: what is still owed to the organizer counts as
 * income not received, up to the income there is less its bad debts.
 */
export function unreceivedOf(summary: GameSummary, items: readonly IncomeItem[]): Cents {
  const left = incomeOf(summary, items) - badDebtOf(summary, items);
  return cents(Math.max(0, Math.min(left, owedToOrganizer(summary))));
}

/** Days as `2026-11-21`, both ends included. A missing end leaves that side open. */
export interface Period {
  readonly from?: string;
  readonly to?: string;
}

export const PERIOD_CHOICES = [
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "last3Months",
  "last6Months",
  "thisYear",
  "all",
] as const;
export type PeriodChoice = (typeof PERIOD_CHOICES)[number];

/** The month a day is in, as `2026-11`. */
export const monthOf = (day: string) => day.slice(0, 7);

/** The month so many months before or after another. */
export function shiftMonth(month: string, by: number): string {
  const [year = 0, number = 1] = month.split("-").map(Number);
  const index = year * 12 + (number - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** The day so many days before or after another, by the calendar alone. */
export function shiftDay(day: string, by: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + by)).toISOString().slice(0, 10);
}

/** The Monday of the week a day is in. Weeks run from Monday to Sunday. */
export function weekStart(day: string): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}

/** A whole week, from its Monday. */
export function weekPeriod(monday: string): Period {
  return { from: monday, to: shiftDay(monday, 6) };
}

/** A whole month. No month has a day past the 31st, so every day of it sorts inside. */
export function monthPeriod(month: string, last = month): Period {
  return { from: `${month}-01`, to: `${last}-31` };
}

/**
 * The days a choice covers, counted back from today. 本周 is Monday to Sunday around today.
 * 近 3 个月 is this month and the two before, and 近半年 this month and the five before.
 */
export function periodOf(choice: PeriodChoice, today: string): Period {
  const month = monthOf(today);
  switch (choice) {
    case "thisWeek":
      return weekPeriod(weekStart(today));
    case "lastWeek":
      return weekPeriod(shiftDay(weekStart(today), -7));
    case "thisMonth":
      return monthPeriod(month);
    case "lastMonth":
      return monthPeriod(shiftMonth(month, -1));
    case "last3Months":
      return monthPeriod(shiftMonth(month, -2), month);
    case "last6Months":
      return monthPeriod(shiftMonth(month, -5), month);
    case "thisYear":
      return monthPeriod(`${month.slice(0, 4)}-01`, `${month.slice(0, 4)}-12`);
    case "all":
      return {};
  }
}

/** The months up to and including today's, oldest first. */
export function recentMonths(today: string, count: number): string[] {
  const month = monthOf(today);
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1));
}

/** Whether a day is in a period. */
export const inPeriod = ({ from, to }: Period, day: string) =>
  (from === undefined || day >= from) && (to === undefined || day <= to);

export interface IncomeView {
  /** Amounts in different currencies are never added together. */
  readonly currency: Currency;
  readonly items: readonly IncomeItem[];
}

export interface GameIncome {
  readonly summary: GameSummary;
  /** Of the items asked for. */
  readonly income: Cents;
  readonly unreceived: Cents;
  readonly badDebt: Cents;
}

export interface IncomeReport {
  /** Newest first. Games that brought in nothing are listed too. */
  readonly games: readonly GameIncome[];
  /** Income due from these games, of the items asked for. */
  readonly total: Cents;
  readonly received: Cents;
  readonly unreceived: Cents;
  /** How many games still have income to come in. */
  readonly unreceivedGames: number;
  /** Income set down as bad debts: in neither `received` nor `unreceived`. */
  readonly badDebt: Cents;
  readonly badDebtGames: number;
  /** Each item over these games, whether it was asked for or not. */
  readonly byItem: Readonly<Record<IncomeItem, Cents>>;
  /** How many of these games each item brought anything in, or lost anything. */
  readonly gamesByItem: Readonly<Record<IncomeItem, number>>;
  /** Differences the organizer took on, which are no part of the total. */
  readonly absorbed: Cents;
}

/** The income of the games that started in a period, in one currency. */
export function incomeReport(
  summaries: readonly GameSummary[],
  { currency, items }: IncomeView,
  period: Period,
): IncomeReport {
  const games = summaries
    .filter((summary) => summary.currency === currency && inPeriod(period, summary.day))
    .toSorted((a, b) => b.startedAt - a.startedAt)
    .map((summary) => ({
      summary,
      income: incomeOf(summary, items),
      unreceived: unreceivedOf(summary, items),
      badDebt: badDebtOf(summary, items),
    }));
  const total = sum(games.map((game) => game.income));
  const unreceived = sum(games.map((game) => game.unreceived));
  const badDebt = sum(games.map((game) => game.badDebt));
  const item = (key: IncomeItem) => sum(games.map(({ summary }) => summary.income[key]));
  const count = (key: IncomeItem) =>
    games.filter(({ summary }) => summary.income[key] !== 0).length;
  return {
    games,
    total,
    received: cents(total - unreceived - badDebt),
    unreceived,
    unreceivedGames: games.filter((game) => game.unreceived > 0).length,
    badDebt,
    badDebtGames: games.filter((game) => game.badDebt > 0).length,
    byItem: {
      rake: item("rake"),
      insurance: item("insurance"),
      wage: item("wage"),
      tableFee: item("tableFee"),
    },
    gamesByItem: {
      rake: count("rake"),
      insurance: count("insurance"),
      wage: count("wage"),
      tableFee: count("tableFee"),
    },
    absorbed: sum(games.map(({ summary }) => summary.absorbed)),
  };
}

/** How the bars are cut up: a bar a week or a bar a month, four of either. */
export const TREND_SPANS = ["weeks4", "months4"] as const;
export type TrendSpan = (typeof TREND_SPANS)[number];

/** The periods of a span, oldest first, the last of them the one today is in. */
export function trendPeriods(span: TrendSpan, today: string): Period[] {
  return span === "weeks4"
    ? [-3, -2, -1, 0].map((by) => weekPeriod(shiftDay(weekStart(today), by * 7)))
    : recentMonths(today, 4).map((month) => monthPeriod(month));
}

export interface PeriodIncome {
  /** Always closed at both ends. */
  readonly period: Period;
  /** How many games started in it. */
  readonly games: number;
  /** All four items together. */
  readonly total: Cents;
  readonly byItem: Readonly<Record<IncomeItem, Cents>>;
}

/** What each period brought in, in one currency and in the order asked. An empty period has 0. */
export function incomeSeries(
  summaries: readonly GameSummary[],
  currency: Currency,
  periods: readonly Period[],
): PeriodIncome[] {
  return periods.map((period) => {
    const { games, total, byItem } = incomeReport(
      summaries,
      { currency, items: INCOME_ITEMS },
      period,
    );
    return { period, games: games.length, total, byItem };
  });
}
