/**
 * Table fees and wages: cash each player pays the organizer at settlement, outside the chips (ADR 0022).
 * Both come from time at the table while the game clock runs, so they need no events of their own.
 */
import type {
  ChargeKind,
  ChargeWaiver,
  Game,
  LedgerEvent,
  TableFeeRule,
  TimerRun,
  Timestamp,
  WagePart,
  WageRule,
} from "../domain";
import { INSURANCE_PLAYER_ID } from "../domain";
import { timerRuns } from "../game";
import { summarizeByPlayer } from "../ledger";
import { type Cents, cents, multiply, sum, ZERO } from "../money";
import type { PlayerNet } from "../settlement";
import { ORGANIZER_COLLECTOR } from "../settlement";
import { type SeatSession, seatedMs, seatSessions, withinRuns } from "./seat-time";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Wages at one rate: the whole minutes charged at it and what they come to. */
export interface WagePartCharge {
  readonly part: WagePart;
  readonly hourly: Cents;
  readonly minutes: number;
  readonly amount: Cents;
}

/**
 * One amount a player owes: a table fee, or wages at one rate. Kept apart so each can be waived,
 * and a waived charge is still listed so the organizer can see and restore it.
 */
export interface Charge {
  readonly playerId: string;
  readonly kind: ChargeKind;
  /** Wages only. */
  readonly part?: WagePart;
  readonly amount: Cents;
  /** Wages only: the hourly rate and the whole minutes charged at it. */
  readonly hourly?: Cents;
  readonly minutes?: number;
  readonly waived: boolean;
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

/** Which rate is in force at `time`. An after-hours rate applies from `switchAt`. */
function wagePartAt(
  rule: WageRule,
  time: Timestamp,
  switchAt: Timestamp,
  minuteOfDay: ChargeClock["minuteOfDay"],
): WagePart {
  const { adjustment } = rule;
  if (!adjustment) return "base";
  const applies =
    adjustment.kind === "time_of_day"
      ? inHours(minuteOfDay(time), adjustment.fromHour, adjustment.toHour)
      : time >= switchAt;
  return applies ? "adjusted" : "base";
}

/** The hourly rate at `time`. An after-hours rate applies from `switchAt`. */
export function wageRateAt(
  rule: WageRule,
  time: Timestamp,
  switchAt: Timestamp,
  minuteOfDay: ChargeClock["minuteOfDay"],
): Cents {
  const part = wagePartAt(rule, time, switchAt, minuteOfDay);
  return part === "adjusted" && rule.adjustment ? rule.adjustment.hourly : rule.hourly;
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
 * Wages for one player, one entry per rate they were charged at, base first. Each rate counts the
 * whole minutes of all the player's time at it and rounds half up to the cent, so the organizer can
 * check "¥25/时 × 1小时40分" by hand. A part minute left over at a rate is not charged.
 */
export function wageParts(
  rule: WageRule,
  sessions: readonly SeatSession[],
  switchAt: Timestamp,
  { now, minuteOfDay }: ChargeClock,
): WagePartCharge[] {
  // Rates change on the minute or at `switchAt`, so step between those
  const ms: Record<WagePart, number> = { base: 0, adjusted: 0 };
  for (const { from, to = now } of sessions) {
    for (let time = from; time < to; ) {
      const nextMinute = (Math.floor(time / MINUTE) + 1) * MINUTE;
      const next = Math.min(to, nextMinute, switchAt > time ? switchAt : Infinity);
      ms[wagePartAt(rule, time, switchAt, minuteOfDay)] += next - time;
      time = next;
    }
  }
  const rates: [WagePart, Cents | undefined][] = [
    ["base", rule.hourly],
    ["adjusted", rule.adjustment?.hourly],
  ];
  return rates.flatMap(([part, hourly]) => {
    const minutes = Math.floor(ms[part] / MINUTE);
    if (hourly === undefined || minutes === 0) return [];
    return [{ part, hourly, minutes, amount: multiply(hourly, minutes / 60, "half-up") }];
  });
}

/** Wages for one player at all rates. */
export function wageFor(
  rule: WageRule,
  sessions: readonly SeatSession[],
  switchAt: Timestamp,
  clock: ChargeClock,
): Cents {
  return sum(wageParts(rule, sessions, switchAt, clock).map((p) => p.amount));
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

export interface PlayerChargeStatus extends PlayerSeatTime {
  /** 0 with no table fee, or before the player has sat long enough. */
  readonly tableFee: Cents;
  /** Wages at each rate. Empty with no wages. */
  readonly wageParts: readonly WagePartCharge[];
  /** Counted time still needed before the table fee applies. 0 once it does, or with no table fee. */
  readonly tableFeeShortMs: number;
}

/**
 * Each player's counted time and what they owe so far, in ledger order. Used live during the game
 * and, through `gameCharges`, at settlement. Only time while the game clock ran counts, and
 * "开局 xx 小时后" means once the clock shows xx hours.
 */
export function chargeStatuses(
  game: Pick<Game, "tableFee" | "wage" | "timer">,
  events: readonly LedgerEvent[],
  clock: ChargeClock,
): PlayerChargeStatus[] {
  const { tableFee, wage } = game;
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

  return players.map(({ playerId }) => {
    const own = sessions.get(playerId) ?? [];
    const seated = seatedMs(own, clock.now);
    return {
      playerId,
      seatedMs: seated,
      tableFee: tableFee ? tableFeeFor(tableFee, seated) : ZERO,
      wageParts: wage ? wageParts(wage, own, switchAt, clock) : [],
      tableFeeShortMs: tableFee ? Math.max(0, tableFee.minMinutes * MINUTE - seated) : 0,
    };
  });
}

function sameCharge(a: ChargeWaiver, b: ChargeWaiver) {
  return a.playerId === b.playerId && a.kind === b.kind && a.part === b.part;
}

/** Each player's charges from their statuses, marking the ones the game has waived. */
export function chargesFrom(
  game: Pick<Game, "waivedCharges">,
  statuses: readonly PlayerChargeStatus[],
): Charge[] {
  const waived = (key: ChargeWaiver) => (game.waivedCharges ?? []).some((w) => sameCharge(w, key));
  return statuses.flatMap(({ playerId, tableFee, wageParts: parts }): Charge[] => {
    const fee = { playerId, kind: "table_fee" as const };
    return [
      ...(tableFee !== 0 ? [{ ...fee, amount: tableFee, waived: waived(fee) }] : []),
      ...parts.map(({ part, hourly, minutes, amount }) => {
        const key = { playerId, kind: "wage" as const, part };
        return { ...key, amount, hourly, minutes, waived: waived(key) };
      }),
    ];
  });
}

/**
 * What each player owes for the game's table fee and wages: a table fee once it applies, and wages
 * at each rate they sat at. Waived charges are included and marked.
 */
export function gameCharges(
  game: Pick<Game, "tableFee" | "wage" | "timer" | "waivedCharges">,
  events: readonly LedgerEvent[],
  clock: ChargeClock,
): Charge[] {
  if (!game.tableFee && !game.wage) return [];
  return chargesFrom(game, chargeStatuses(game, events, clock));
}

/** Lets a player off one charge, or charges it again. */
export function waiveCharge(game: Game, key: ChargeWaiver, waived: boolean): Game {
  const { waivedCharges = [], ...rest } = game;
  const others = waivedCharges.filter((w) => !sameCharge(w, key));
  const next = waived ? [...others, key] : others;
  return next.length > 0 ? { ...rest, waivedCharges: next } : rest;
}

export interface ChargeAttribution {
  /** Results with the charges taken from each player and given to the recipient. */
  readonly nets: readonly PlayerNet[];
  readonly total: Cents;
  readonly recipientId: string;
}

/**
 * Moves the charges not waived from each player's result to the recipient, the organizer for now.
 * The total of all results stays the same. A recipient with no result gets a row of their own.
 */
export function applyCharges(
  nets: readonly PlayerNet[],
  charges: readonly Charge[],
  recipientId: string = ORGANIZER_COLLECTOR,
): ChargeAttribution {
  const due = charges.filter((c) => !c.waived);
  const owed = new Map<string, number>();
  for (const { playerId, amount } of due) {
    owed.set(playerId, (owed.get(playerId) ?? 0) + amount);
  }
  const total = sum(due.map((c) => c.amount));
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
