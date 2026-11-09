/**
 * Table fees and wages: cash each player pays the organizer at settlement, outside the chips (ADR 0022).
 * Both come from time at the table while the game clock runs, so they need no events of their own.
 */
import type { Game, LedgerEvent, TableFeeRule, TimerRun, Timestamp, WageRule } from "../domain";
import { INSURANCE_PLAYER_ID } from "../domain";
import { timerRuns } from "../game";
import { summarizeByPlayer } from "../ledger";
import { type Cents, cents, multiply, sum, ZERO } from "../money";
import type { PlayerNet } from "../settlement";
import { ORGANIZER_COLLECTOR } from "../settlement";
import { type SeatSession, seatedMs, seatSessions, withinRuns } from "./seat-time";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export type ChargeKind = "table_fee" | "wage";

/** One amount a player owes. Kept apart by kind, so a later change can waive or edit one. */
export interface Charge {
  readonly playerId: string;
  readonly kind: ChargeKind;
  readonly amount: Cents;
}

export interface ChargeClock {
  /** The end of any session still open. */
  readonly now: Timestamp;
  /** Minutes past local midnight, 0–1439. Supplied by the app, so `core` never reads a time zone. */
  readonly minuteOfDay: (time: Timestamp) => number;
}

/** The table fee for one player, or 0 if they sat less than the rule's minimum. */
export function tableFeeFor(rule: TableFeeRule, seatedTimeMs: number): Cents {
  return seatedTimeMs >= rule.minMinutes * MINUTE ? rule.amount : ZERO;
}

function inHours(minute: number, fromHour: number, toHour: number) {
  const from = fromHour * 60;
  const to = toHour * 60;
  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

/** The hourly rate at `time`. An after-hours rate applies from `switchAt`. */
export function wageRateAt(
  rule: WageRule,
  time: Timestamp,
  switchAt: Timestamp,
  minuteOfDay: ChargeClock["minuteOfDay"],
): Cents {
  const { adjustment } = rule;
  if (!adjustment) return rule.hourly;
  const applies =
    adjustment.kind === "time_of_day"
      ? inHours(minuteOfDay(time), adjustment.fromHour, adjustment.toHour)
      : time >= switchAt;
  return applies ? adjustment.hourly : rule.hourly;
}

/** When the clock has run for `ms`, or Infinity if it has not run that long. */
export function clockReaches(runs: readonly TimerRun[], ms: number): Timestamp {
  let left = ms;
  for (const { from, to } of runs) {
    if (to - from >= left) return from + left;
    left -= to - from;
  }
  return Infinity;
}

/**
 * Wages for one player, by the minute: the whole minutes of their total time at the table, each at
 * the rate in force then, rounded half up to the cent once at the end. So 150 minutes at 25 an hour
 * is 62.50 however the time was split, and a part minute left over is not charged.
 */
export function wageFor(
  rule: WageRule,
  sessions: readonly SeatSession[],
  switchAt: Timestamp,
  { now, minuteOfDay }: ChargeClock,
): Cents {
  // Rates change on the minute or at `switchAt`, so step between those and weigh each step by its length
  let rateMs = 0;
  let totalMs = 0;
  for (const { from, to = now } of sessions) {
    for (let time = from; time < to; ) {
      const nextMinute = (Math.floor(time / MINUTE) + 1) * MINUTE;
      const next = Math.min(to, nextMinute, switchAt > time ? switchAt : Infinity);
      rateMs += wageRateAt(rule, time, switchAt, minuteOfDay) * (next - time);
      totalMs += next - time;
      time = next;
    }
  }
  if (totalMs === 0) return ZERO;
  const chargedMs = Math.floor(totalMs / MINUTE) * MINUTE;
  return multiply(cents(rateMs), chargedMs / totalMs / HOUR, "half-up");
}

export interface PlayerSeatTime {
  readonly playerId: string;
  readonly seatedMs: number;
}

/**
 * Each player's counted sessions: their time at the table while the game clock ran. Before the clock
 * starts, and while it is paused, nobody's time counts. A clock from before runs were kept has an
 * unknown history, so its game counts all time at the table.
 */
function countedSessions(
  game: Pick<Game, "timer">,
  events: readonly LedgerEvent[],
  now: Timestamp,
): { sessions: Map<string, SeatSession[]>; runs: TimerRun[] | undefined } {
  const all = seatSessions(events);
  const runs = timerRuns(game.timer, now);
  if (!runs) return { sessions: all, runs };
  const sessions = new Map([...all].map(([id, own]) => [id, withinRuns(own, runs, now)]));
  return { sessions, runs };
}

/** Counted time for each player in the game, in ledger order. The insurance seat has none. */
export function seatTimes(
  game: Pick<Game, "timer">,
  events: readonly LedgerEvent[],
  now: Timestamp,
): PlayerSeatTime[] {
  const { sessions } = countedSessions(game, events, now);
  return summarizeByPlayer(events)
    .filter((p) => p.playerId !== INSURANCE_PLAYER_ID)
    .map(({ playerId }) => ({ playerId, seatedMs: seatedMs(sessions.get(playerId) ?? [], now) }));
}

/**
 * What each player owes for the game's table fee and wages, leaving out amounts of 0. Only time
 * while the game clock ran counts, and "开局 xx 小时后" means once the clock shows xx hours.
 */
export function gameCharges(
  game: Pick<Game, "tableFee" | "wage" | "timer">,
  events: readonly LedgerEvent[],
  clock: ChargeClock,
): Charge[] {
  const { tableFee, wage } = game;
  if (!tableFee && !wage) return [];
  const { sessions, runs } = countedSessions(game, events, clock.now);
  const players = summarizeByPlayer(events).filter((p) => p.playerId !== INSURANCE_PLAYER_ID);

  const adjustment = wage?.adjustment;
  let switchAt = Infinity;
  if (adjustment?.kind === "after_start") {
    const afterMs = adjustment.afterHours * HOUR;
    // An older clock has no runs, so its game falls back to the first player sitting down
    const starts = players.flatMap(({ playerId }) => sessions.get(playerId)?.[0]?.from ?? []);
    switchAt = runs
      ? clockReaches(runs, afterMs)
      : starts.length > 0
        ? Math.min(...starts) + afterMs
        : Infinity;
  }

  return players.flatMap(({ playerId }): Charge[] => {
    const own = sessions.get(playerId) ?? [];
    const charges: Charge[] = [];
    if (tableFee) {
      charges.push({
        playerId,
        kind: "table_fee",
        amount: tableFeeFor(tableFee, seatedMs(own, clock.now)),
      });
    }
    if (wage) charges.push({ playerId, kind: "wage", amount: wageFor(wage, own, switchAt, clock) });
    return charges.filter((charge) => charge.amount !== 0);
  });
}

export interface ChargeAttribution {
  /** Results with the charges taken from each player and given to the recipient. */
  readonly nets: readonly PlayerNet[];
  readonly total: Cents;
  readonly recipientId: string;
}

/**
 * Moves the charges from each player's result to the recipient, the organizer for now. The total of
 * all results stays the same. A recipient with no result gets a row of their own.
 */
export function applyCharges(
  nets: readonly PlayerNet[],
  charges: readonly Charge[],
  recipientId: string = ORGANIZER_COLLECTOR,
): ChargeAttribution {
  const owed = new Map<string, number>();
  for (const { playerId, amount } of charges) {
    owed.set(playerId, (owed.get(playerId) ?? 0) + amount);
  }
  const total = sum(charges.map((c) => c.amount));
  if (total === 0) return { nets, total, recipientId };

  const charged = nets.map(({ playerId, net }) => ({
    playerId,
    net: cents(net - (owed.get(playerId) ?? 0) + (playerId === recipientId ? total : 0)),
  }));
  const hasRecipient = nets.some((p) => p.playerId === recipientId);
  return {
    nets: hasRecipient ? charged : [...charged, { playerId: recipientId, net: total }],
    total,
    recipientId,
  };
}
