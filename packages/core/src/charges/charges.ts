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
import { hoursBetween } from "./rules";
import { type SeatSession, seatedMs, seatSessions, withinRuns } from "./seat-time";

const MINUTE = 60_000;
const QUARTER = 15 * MINUTE;
const HOUR = 60 * MINUTE;
/** How far back a time segment with no end still counts as begun when the game starts. */
const OPEN_SEGMENT_LOOK_BACK = 12 * HOUR;

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

/** The parts of a rule from before segments. */
type LegacyPart = Extract<WagePart, "base" | "adjusted">;

/** Which rate is in force at `time`. An after-hours rate applies from `switchAt`. */
function wagePartAt(
  rule: WageRule,
  time: Timestamp,
  switchAt: Timestamp,
  minuteOfDay: ChargeClock["minuteOfDay"],
): LegacyPart {
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
 * check "¥25/时 × 1小时40分" by hand. A part minute left over at a rate is not charged. Only for
 * rules from before segments; `segmentedWageParts` charges the others.
 */
export function wageParts(
  rule: WageRule,
  sessions: readonly SeatSession[],
  switchAt: Timestamp,
  { now, minuteOfDay }: ChargeClock,
): WagePartCharge[] {
  // Rates change on the minute or at `switchAt`, so step between those
  const ms: Record<LegacyPart, number> = { base: 0, adjusted: 0 };
  for (const { from, to = now } of sessions) {
    for (let time = from; time < to; ) {
      const nextMinute = (Math.floor(time / MINUTE) + 1) * MINUTE;
      const next = Math.min(to, nextMinute, switchAt > time ? switchAt : Infinity);
      ms[wagePartAt(rule, time, switchAt, minuteOfDay)] += next - time;
      time = next;
    }
  }
  const rates: [LegacyPart, Cents | undefined][] = [
    ["base", rule.hourly],
    ["adjusted", rule.adjustment?.hourly],
  ];
  return rates.flatMap(([part, hourly]) => {
    const minutes = Math.floor(ms[part] / MINUTE);
    if (hourly === undefined || minutes === 0) return [];
    return [{ part, hourly, minutes, amount: multiply(hourly, minutes / 60, "half-up") }];
  });
}

/** A stretch of the game charged at one segment's rate, by local time or by game time. */
export interface WageWindow {
  readonly part: WagePart;
  readonly kind: "time" | "after";
  readonly from: Timestamp;
  /** Infinity for a segment that runs to the end. */
  readonly to: Timestamp;
  readonly hourly: Cents;
}

/** The first whole local hour `hour`, counting from the start of the hour `time` falls in. */
function fixedLocalHour(time: Timestamp, hour: number, minuteOfDay: ChargeClock["minuteOfDay"]) {
  const minute = minuteOfDay(time);
  const hourStart = time - (minute % 60) * MINUTE - (time % MINUTE);
  return hourStart + ((hour - Math.floor(minute / 60) + 24) % 24) * HOUR;
}

/**
 * Game time segments start once the game clock shows their hours, or for a clock from before runs
 * were kept, that long after the start.
 */
function gameTimeWindows(
  rule: WageRule,
  gameStart: Timestamp,
  runs: readonly TimerRun[] | undefined,
): WageWindow[] {
  const reached = (hours: number) =>
    runs ? clockReaches(runs, hours * HOUR) : gameStart + hours * HOUR;
  const after = rule.afterStartSegments ?? [];
  return after.map(({ afterHours, hourly }, i) => {
    const next = after[i + 1];
    return {
      part: `after-${i + 1}`,
      kind: "after",
      from: reached(afterHours),
      to: next ? reached(next.afterHours) : Infinity,
      hourly,
    };
  });
}

/**
 * When each segment applies under a rule from before `rounding` (ADR 0025). Time segments follow
 * each other from the first time the clock shows the first one's hour once the game has started,
 * each a fixed number of hours long. Kept as it was, so those games price as they did.
 */
export function wageWindows(
  rule: WageRule,
  gameStart: Timestamp | undefined,
  runs: readonly TimerRun[] | undefined,
  minuteOfDay: ChargeClock["minuteOfDay"],
): WageWindow[] {
  if (gameStart === undefined) return [];
  const windows: WageWindow[] = [];
  const time = rule.timeSegments ?? [];
  let from = time[0] ? fixedLocalHour(gameStart, time[0].fromHour, minuteOfDay) : 0;
  time.forEach(({ fromHour, toHour, hourly }, i) => {
    const to = toHour === undefined ? Infinity : from + hoursBetween(fromHour, toHour) * HOUR;
    windows.push({ part: `time-${i + 1}`, kind: "time", from, to, hourly });
    from = to;
  });
  return [...windows, ...gameTimeWindows(rule, gameStart, runs)];
}

/** Minutes since the local clock last showed `hour`:00, 0–1439. */
function sinceLocalHour(time: Timestamp, hour: number, minuteOfDay: ChargeClock["minuteOfDay"]) {
  return (minuteOfDay(time) - hour * 60 + 1440) % 1440;
}

/**
 * Whether the local clock reached `hour`:00 in the quarter hour ending at `time`. Every time zone
 * is a multiple of 15 minutes from UTC, so local hours start on quarter hours. Where the clock
 * skips that time for daylight saving, the jump counts. Where an hour comes twice, the clock going
 * back is a small step, not a full turn, so only the first time counts.
 */
function reachesLocalHour(time: Timestamp, hour: number, minuteOfDay: ChargeClock["minuteOfDay"]) {
  const before = sinceLocalHour(time - QUARTER, hour, minuteOfDay);
  return before - sinceLocalHour(time, hour, minuteOfDay) > 720;
}

/** Quarter hours in a day and a bit, enough to find any local hour across a daylight saving change. */
const SEARCH_QUARTERS = 26 * 4;

/** The first moment after `time` when the local clock reaches `hour`:00. */
export function localHourAfter(
  time: Timestamp,
  hour: number,
  minuteOfDay: ChargeClock["minuteOfDay"],
): Timestamp {
  let at = Math.floor(time / QUARTER) * QUARTER + QUARTER;
  for (let i = 0; i < SEARCH_QUARTERS && !reachesLocalHour(at, hour, minuteOfDay); i++) {
    at += QUARTER;
  }
  return at;
}

/** The last moment at or before `time` when the local clock reached `hour`:00. */
export function localHourBefore(
  time: Timestamp,
  hour: number,
  minuteOfDay: ChargeClock["minuteOfDay"],
): Timestamp {
  let at = Math.floor(time / QUARTER) * QUARTER;
  for (let i = 0; i < SEARCH_QUARTERS && !reachesLocalHour(at, hour, minuteOfDay); i++) {
    at -= QUARTER;
  }
  return at;
}

/**
 * When each segment applies under a rule with `rounding` (ADR 0027). Time segments switch when the
 * local clock really shows their hours, so a daylight saving night is an hour shorter or longer.
 * A game that starts inside the segments begins in them: inside their hours when the last one has
 * an end, or within 12 hours of the first one's start when it has none. Otherwise they begin the
 * next time the first one's hour comes round.
 */
export function localWageWindows(
  rule: WageRule,
  gameStart: Timestamp | undefined,
  runs: readonly TimerRun[] | undefined,
  minuteOfDay: ChargeClock["minuteOfDay"],
): WageWindow[] {
  if (gameStart === undefined) return [];
  const time = rule.timeSegments ?? [];
  const chainFrom = (start: Timestamp) => {
    let from = start;
    return time.map(({ toHour, hourly }, i): WageWindow => {
      const to = toHour === undefined ? Infinity : localHourAfter(from, toHour, minuteOfDay);
      const window = { part: `time-${i + 1}` as const, kind: "time" as const, from, to, hourly };
      from = to;
      return window;
    });
  };
  const [first] = time;
  let timeWindows: WageWindow[] = [];
  if (first) {
    const begun = chainFrom(localHourBefore(gameStart, first.fromHour, minuteOfDay));
    const start = begun[0]?.from ?? gameStart;
    const end = begun.at(-1)?.to ?? gameStart;
    const inside = Number.isFinite(end)
      ? gameStart < end
      : gameStart - start <= OPEN_SEGMENT_LOOK_BACK;
    timeWindows = inside
      ? begun
      : chainFrom(localHourAfter(gameStart, first.fromHour, minuteOfDay));
  }
  return [...timeWindows, ...gameTimeWindows(rule, gameStart, runs)];
}

/** The rate at each moment under a rule's windows, and the moments where it can change. */
function wageRates(rule: WageRule, windows: readonly WageWindow[]) {
  const rateAt = (time: Timestamp): { part: WagePart; hourly: Cents } => {
    const at = (kind: WageWindow["kind"]) =>
      windows.find((w) => w.kind === kind && w.from <= time && time < w.to);
    const byTime = at("time");
    const byGame = at("after");
    const pick =
      byTime && byGame
        ? byGame.hourly > byTime.hourly ||
          (byGame.hourly === byTime.hourly && byGame.from < byTime.from)
          ? byGame
          : byTime
        : (byTime ?? byGame);
    return pick ?? { part: "base", hourly: rule.hourly };
  };
  const bounds = windows
    .flatMap((w) => [w.from, w.to])
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return { rateAt, bounds };
}

/** Base first, then the other rates in the order the player met them. */
const baseFirst = (a: { part: WagePart }, b: { part: WagePart }) =>
  Number(b.part === "base") - Number(a.part === "base");

/**
 * Wages for one player under a rule with `rounding` (ADR 0027). Their counted time is cut into
 * billing units from the moment they sat down, pauses and time away left out. A part unit at the
 * end counts as a whole one or not at all, by the rule's rounding; one that counts runs on past
 * the moment the player left. Each unit is charged at one rate: the one that covers more of it,
 * or the higher of two that cover the same.
 */
export function unitWageParts(
  rule: WageRule,
  sessions: readonly SeatSession[],
  windows: readonly WageWindow[],
  { now }: Pick<ChargeClock, "now">,
): WagePartCharge[] {
  const { rateAt, bounds } = wageRates(rule, windows);
  const unitMinutes = rule.unitMinutes ?? 1;
  const unitMs = unitMinutes * MINUTE;
  const spans = sessions
    .map(({ from, to = now }) => ({ from, to }))
    .filter(({ from, to }) => to > from);
  const totalMs = spans.reduce((all, { from, to }) => all + to - from, 0);
  const whole = Math.floor(totalMs / unitMs);
  const rest = totalMs - whole * unitMs;
  const counts =
    rest > 0 && (rule.rounding === "up" || (rule.rounding !== "down" && rest * 2 >= unitMs));
  const last = spans.at(-1);
  if (counts && last) spans.push({ from: last.to, to: last.to + unitMs - rest });

  const charged = new Map<WagePart, { hourly: Cents; minutes: number }>();
  let unit = new Map<WagePart, { hourly: Cents; ms: number }>();
  let unitLeft = unitMs;
  let left = (whole + (counts ? 1 : 0)) * unitMs;
  for (const { from, to } of spans) {
    for (let time = from; time < to && left > 0; ) {
      const next = Math.min(to, bounds.find((b) => b > time) ?? Infinity, time + unitLeft);
      const { part, hourly } = rateAt(time);
      unit.set(part, { hourly, ms: (unit.get(part)?.ms ?? 0) + next - time });
      unitLeft -= next - time;
      left -= next - time;
      time = next;
      if (unitLeft > 0) continue;
      // The rate with more of the unit takes all of it; the higher rate wins a tie
      const [winner] = [...unit].sort(([, a], [, b]) => b.ms - a.ms || b.hourly - a.hourly);
      if (winner) {
        const [winnerPart, { hourly: rate }] = winner;
        const minutes = (charged.get(winnerPart)?.minutes ?? 0) + unitMinutes;
        charged.set(winnerPart, { hourly: rate, minutes });
      }
      unit = new Map();
      unitLeft = unitMs;
    }
  }

  return [...charged]
    .map(([part, { hourly, minutes }]) => ({
      part,
      hourly,
      minutes,
      amount: multiply(hourly, minutes / 60, "half-up"),
    }))
    .sort(baseFirst);
}

/**
 * Wages for one player under a rule with `unitMinutes` but no `rounding` (ADR 0025). Where a time segment and a game time
 * segment both apply, the higher rate wins, or the one that began first at equal rates. The total
 * time is charged in whole units, rounded up or down by the rule, and the minutes this adds or
 * takes away fall on the rate the player sat at last.
 */
export function segmentedWageParts(
  rule: WageRule,
  sessions: readonly SeatSession[],
  windows: readonly WageWindow[],
  { now }: Pick<ChargeClock, "now">,
): WagePartCharge[] {
  const { rateAt, bounds } = wageRates(rule, windows);

  const totals = new Map<WagePart, { hourly: Cents; ms: number }>();
  let last: WagePart | undefined;
  for (const { from, to = now } of sessions) {
    for (let time = from; time < to; ) {
      const next = Math.min(to, bounds.find((b) => b > time) ?? Infinity);
      const { part, hourly } = rateAt(time);
      const total = totals.get(part) ?? { hourly, ms: 0 };
      totals.set(part, { hourly, ms: total.ms + next - time });
      last = part;
      time = next;
    }
  }

  const entries = [...totals].map(([part, { hourly, ms }]) => ({
    part,
    hourly,
    minutes: Math.floor(ms / MINUTE),
  }));
  const totalMs = [...totals.values()].reduce((all, { ms }) => all + ms, 0);
  const unitMs = (rule.unitMinutes ?? 1) * MINUTE;
  const units = rule.roundUp ? Math.ceil(totalMs / unitMs) : Math.floor(totalMs / unitMs);
  let left = (units * unitMs) / MINUTE - entries.reduce((all, e) => all + e.minutes, 0);
  // The last rate takes what rounding adds, and gives up what it takes away first
  const order = [...entries].sort((a, b) => Number(b.part === last) - Number(a.part === last));
  for (const entry of order) {
    if (left === 0) break;
    const change = left > 0 ? left : Math.max(left, -entry.minutes);
    entry.minutes += change;
    left -= change;
  }

  return entries
    .filter((e) => e.minutes > 0)
    .sort((a, b) => Number(b.part === "base") - Number(a.part === "base"))
    .map(({ part, hourly, minutes }) => ({
      part,
      hourly,
      minutes,
      amount: multiply(hourly, minutes / 60, "half-up"),
    }));
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

  // The game started when its clock first ran, or for an older clock, when the first player sat
  const starts = players.flatMap(({ playerId }) => sessions.get(playerId)?.[0]?.from ?? []);
  const firstSeat = starts.length > 0 ? Math.min(...starts) : undefined;
  const gameStart = runs ? runs[0]?.from : firstSeat;
  // Three generations of rules, each charged as it was when its game started
  const byUnit = wage?.rounding !== undefined;
  const segmented = !byUnit && wage?.unitMinutes !== undefined;
  const windows = !wage
    ? []
    : byUnit
      ? localWageWindows(wage, gameStart, runs, clock.minuteOfDay)
      : segmented
        ? wageWindows(wage, gameStart, runs, clock.minuteOfDay)
        : [];

  const adjustment = wage?.adjustment;
  let switchAt = Infinity;
  if (adjustment?.kind === "after_start") {
    const afterMs = adjustment.afterHours * HOUR;
    // An older clock has no runs, so its game falls back to the first player sitting down
    switchAt = runs
      ? clockReaches(runs, afterMs)
      : firstSeat !== undefined
        ? firstSeat + afterMs
        : Infinity;
  }

  return players.map(({ playerId }) => {
    const own = sessions.get(playerId) ?? [];
    const seated = seatedMs(own, clock.now);
    return {
      playerId,
      seatedMs: seated,
      tableFee: tableFee ? tableFeeFor(tableFee, seated) : ZERO,
      wageParts: !wage
        ? []
        : byUnit
          ? unitWageParts(wage, own, windows, clock)
          : segmented
            ? segmentedWageParts(wage, own, windows, clock)
            : wageParts(wage, own, switchAt, clock),
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
