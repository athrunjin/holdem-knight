/** One player across settled games, read from the games' summaries (ADR 0049). */
import type { Currency, GameSummary, SummaryPlayer, Timestamp } from "../domain";
import { type Cents, cents, multiply, sum } from "../money";
import { ORGANIZER_COLLECTOR } from "../settlement";
import { inPeriod, type Period } from "./income";

/**
 * What a player won or lost in a game: their chips in cash. Their share of a difference split,
 * insurance and the charges they paid are no part of it, and are told apart.
 */
export function playerResult(row: SummaryPlayer): Cents {
  return row.chipNet;
}

export interface PlayerGame {
  readonly summary: GameSummary;
  readonly row: SummaryPlayer;
  readonly result: Cents;
}

export interface PlayerReport {
  /** The games they played in, newest first. */
  readonly games: readonly PlayerGame[];
  /** Won less lost over these games. */
  readonly result: Cents;
  /** How many of the games they came out ahead in. */
  readonly won: number;
  /** The result a game, rounded half up. 0 with no games. */
  readonly average: Cents;
  /** Their best and worst game. 0 with no games. */
  readonly best: Cents;
  readonly worst: Cents;
  /** Wages and table fees they paid, which are no part of the result. */
  readonly wage: Cents;
  readonly tableFee: Cents;
  /** Their shares of differences split, which are no part of the result either. */
  readonly share: Cents;
}

/** A player's games that started in a period, in one currency. */
export function playerReport(
  summaries: readonly GameSummary[],
  playerId: string,
  currency: Currency,
  period: Period = {},
): PlayerReport {
  const games = summaries
    .filter((summary) => summary.currency === currency && inPeriod(period, summary.day))
    .flatMap((summary) => {
      const row = summary.players.find((player) => player.playerId === playerId);
      return row ? [{ summary, row, result: playerResult(row) }] : [];
    })
    .toSorted((a, b) => b.summary.startedAt - a.summary.startedAt);
  const results = games.map(({ result }) => result);
  const result = sum(results);
  return {
    games,
    result,
    won: results.filter((value) => value > 0).length,
    average: games.length > 0 ? multiply(result, 1 / games.length, "half-up") : cents(0),
    best: cents(Math.max(0, ...results)),
    worst: cents(Math.min(0, ...results)),
    wage: sum(games.map(({ row }) => row.wage)),
    tableFee: sum(games.map(({ row }) => row.tableFee)),
    share: sum(games.map(({ row }) => row.share)),
  };
}

/** Where a player stands after one of their games, counted from the first of the games given. */
export interface CurvePoint {
  readonly summary: GameSummary;
  /** Won less lost so far. */
  readonly total: Cents;
  /** The same less the wages and table fees paid so far. */
  readonly afterCharges: Cents;
  readonly wage: Cents;
  readonly tableFee: Cents;
}

/** A player's running result over their games, oldest first, whatever order they are given in. */
export function playerCurve(games: readonly PlayerGame[]): CurvePoint[] {
  let total = 0;
  let wage = 0;
  let tableFee = 0;
  return games
    .toSorted((a, b) => a.summary.startedAt - b.summary.startedAt)
    .map(({ summary, row, result }) => {
      total += result;
      wage += row.wage;
      tableFee += row.tableFee;
      return {
        summary,
        total: cents(total),
        afterCharges: cents(total - wage - tableFee),
        wage: cents(wage),
        tableFee: cents(tableFee),
      };
    });
}

/** Paid later than this many days after the game was settled counts as late. */
export const LATE_DAYS = 7;

const DAY_MS = 86_400_000;

export interface PlayerPayments {
  /** What they are still to pay the organizer, and how many transfers it is. */
  readonly owes: Cents;
  readonly owesCount: number;
  /** What the organizer is still to pay them. */
  readonly owed: Cents;
  readonly owedCount: number;
  /** What they owe the organizer that is set down as a bad debt. */
  readonly bad: Cents;
  readonly badCount: number;
  /** Their payments to anyone that are marked as made with a time kept. */
  readonly timed: number;
  /** How many of those were made late. */
  readonly late: number;
  /** Whole days from settlement to payment on average, among those. Missing with none. */
  readonly averageDays?: number;
}

/**
 * How a player has paid, over every game in one currency: what is still between them and the
 * organizer, their bad debts, and how promptly they paid where the time of the tick was kept.
 */
export function playerPayments(
  summaries: readonly GameSummary[],
  playerId: string,
  currency: Currency,
): PlayerPayments {
  const lines = summaries
    .filter((summary) => summary.currency === currency)
    .flatMap(({ settledAt, transfers }) =>
      transfers.map((transfer) => ({ ...transfer, settledAt })),
    );
  const toOrganizer = lines.filter((l) => l.from === playerId && l.to === ORGANIZER_COLLECTOR);
  const open = toOrganizer.filter((l) => !l.done && !l.bad);
  const bad = toOrganizer.filter((l) => !l.done && l.bad);
  const owed = lines.filter((l) => l.to === playerId && l.from === ORGANIZER_COLLECTOR && !l.done);
  const days = lines
    .filter((l) => l.from === playerId && l.done)
    .flatMap(({ doneAt, settledAt }: { doneAt?: Timestamp; settledAt: Timestamp }) =>
      doneAt === undefined ? [] : [Math.max(0, Math.floor((doneAt - settledAt) / DAY_MS))],
    );
  return {
    owes: sum(open.map((l) => l.amount)),
    owesCount: open.length,
    owed: sum(owed.map((l) => l.amount)),
    owedCount: owed.length,
    bad: sum(bad.map((l) => l.amount)),
    badCount: bad.length,
    timed: days.length,
    late: days.filter((d) => d > LATE_DAYS).length,
    ...(days.length > 0 && {
      averageDays: Math.round(days.reduce((all, d) => all + d, 0) / days.length),
    }),
  };
}
