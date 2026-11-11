/** Table fee and wage settings: defaults and parsing their forms. */
import type {
  TableFeeRule,
  WageAfterStartSegment,
  WageRule,
  WageTimeSegment,
  WageUnitMinutes,
} from "../domain";
import { type Cents, cents, toDecimalString, tryParseMoney } from "../money";

/** 100 in the game's currency once a player has sat for 10 minutes. */
export const DEFAULT_TABLE_FEE: TableFeeRule = { amount: cents(10_000), minMinutes: 10 };

/** 25 an hour in the game's currency, by the minute with a part minute counted. */
export const DEFAULT_WAGE: WageRule = { hourly: cents(2_500), unitMinutes: 1, roundUp: true };

export const WAGE_UNITS: readonly WageUnitMinutes[] = [1, 15, 30, 60];

/** Most segments of each kind, and of both together. */
export const MAX_WAGE_SEGMENTS = 3;
export const MAX_WAGE_SEGMENTS_IN_ALL = 4;

/** A new time segment's start and rate. */
export const DEFAULT_TIME_SEGMENT = { fromHour: "0", toHour: "", hourly: "30.00" } as const;
/** A new game time segment's hours. */
export const DEFAULT_AFTER_HOURS = "6";

/** Issue codes. The UI decides the wording. */
export type ChargeIssue =
  | "invalid"
  | "not-positive"
  | "same-hours"
  | "overlap"
  | "not-rising"
  | "too-many";

export interface TableFeeForm {
  readonly amount: string;
  readonly minMinutes: string;
}

export type TableFeeIssues = Partial<Record<keyof TableFeeForm, ChargeIssue>>;

export type ParsedTableFee =
  | { readonly ok: true; readonly rule: TableFeeRule }
  | { readonly ok: false; readonly issues: TableFeeIssues };

export function toTableFeeForm(rule: TableFeeRule): TableFeeForm {
  return { amount: formatAmount(rule.amount), minMinutes: String(rule.minMinutes) };
}

/** Whole currency units without ".00", as typed. */
function formatAmount(amount: Cents) {
  const text = toDecimalString(amount);
  return text.endsWith(".00") ? text.slice(0, -3) : text;
}

/** A whole number from `min` to `max`, or null. */
function parseWhole(input: string, min: number, max: number): number | null {
  const text = input.trim();
  const value = Number(text);
  return /^\d+$/.test(text) && value >= min && value <= max ? value : null;
}

/** Money of at least 0, or of more than 0 when `positive`. */
function amountIssue(value: Cents | null, positive: boolean): ChargeIssue | undefined {
  if (value === null || value < 0) return "invalid";
  return positive && value === 0 ? "not-positive" : undefined;
}

export function parseTableFee(form: TableFeeForm): ParsedTableFee {
  const amount = tryParseMoney(form.amount);
  const minMinutes = parseWhole(form.minMinutes, 0, 24 * 60);
  const issues: TableFeeIssues = {};
  const issue = amountIssue(amount, true);
  if (issue) issues.amount = issue;
  if (minMinutes === null) issues.minMinutes = "invalid";
  if (amount === null || minMinutes === null || Object.keys(issues).length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, rule: { amount, minMinutes } };
}

export interface WageTimeSegmentForm {
  readonly fromHour: string;
  /** Empty runs to the end of the game. */
  readonly toHour: string;
  readonly hourly: string;
}

export interface WageAfterStartSegmentForm {
  readonly afterHours: string;
  readonly hourly: string;
}

/** Each kind of segment keeps its rows while switched off, so switching loses nothing. */
export interface WageForm {
  readonly hourly: string;
  readonly unitMinutes: WageUnitMinutes;
  readonly roundUp: boolean;
  readonly timeOn: boolean;
  readonly timeSegments: readonly WageTimeSegmentForm[];
  readonly afterOn: boolean;
  readonly afterSegments: readonly WageAfterStartSegmentForm[];
}

/** `hourly`, a segment field such as `time-0-hourly`, or a whole list: `time`, `after`, `segments`. */
export type WageIssueKey =
  | "hourly"
  | "time"
  | "after"
  | "segments"
  | `time-${number}-${keyof WageTimeSegmentForm}`
  | `after-${number}-${keyof WageAfterStartSegmentForm}`;

export type WageIssues = Partial<Record<WageIssueKey, ChargeIssue>>;

export type ParsedWage =
  | { readonly ok: true; readonly rule: WageRule }
  | { readonly ok: false; readonly issues: WageIssues };

/** Rates show their cents, so 25 reads 25.00. */
const formatRate = (amount: Cents) => toDecimalString(amount);

/**
 * An older rule's adjustment becomes the matching kind of segment. Its time of day was a daily
 * window, which reads as one segment ending at the same hour.
 */
export function toWageForm(rule: WageRule): WageForm {
  const { hourly, adjustment } = rule;
  const time =
    rule.timeSegments ??
    (adjustment?.kind === "time_of_day"
      ? [{ fromHour: adjustment.fromHour, toHour: adjustment.toHour, hourly: adjustment.hourly }]
      : []);
  const after =
    rule.afterStartSegments ??
    (adjustment?.kind === "after_start"
      ? [{ afterHours: adjustment.afterHours, hourly: adjustment.hourly }]
      : []);
  return {
    hourly: formatRate(hourly),
    // Older rules charged each whole minute and dropped the rest, which carries over as it was
    unitMinutes: rule.unitMinutes ?? 1,
    roundUp: rule.roundUp ?? false,
    timeOn: time.length > 0,
    timeSegments:
      time.length > 0
        ? time.map(({ fromHour, toHour, hourly: rate }) => ({
            fromHour: String(fromHour),
            toHour: toHour === undefined ? "" : String(toHour),
            hourly: formatRate(rate),
          }))
        : [DEFAULT_TIME_SEGMENT],
    afterOn: after.length > 0,
    afterSegments:
      after.length > 0
        ? after.map(({ afterHours, hourly: rate }) => ({
            afterHours: String(afterHours),
            hourly: formatRate(rate),
          }))
        : [{ afterHours: DEFAULT_AFTER_HOURS, hourly: formatRate(hourly) }],
  };
}

/** Hours from one local hour to the next time another comes round, 1–24. */
export const hoursBetween = (from: number, to: number) => (to - from + 24) % 24 || 24;

/**
 * Only the kinds switched on are checked. Rates may be 0, for wages charged part of the time.
 * Time segments may not cover more than a day together, and game time segments must rise.
 */
export function parseWage(form: WageForm): ParsedWage {
  const issues: WageIssues = {};
  const money = (key: WageIssueKey, text: string) => {
    const value = tryParseMoney(text);
    const issue = amountIssue(value, false);
    if (issue) issues[key] = issue;
    return issue ? null : value;
  };
  const whole = (key: WageIssueKey, text: string, min: number, max: number) => {
    const value = parseWhole(text, min, max);
    if (value === null) issues[key] = "invalid";
    return value;
  };

  const hourly = money("hourly", form.hourly);
  const unitMinutes = form.unitMinutes;

  const timeSegments: WageTimeSegment[] = [];
  if (form.timeOn) {
    let span = 0;
    form.timeSegments.forEach((row, i) => {
      const fromHour = whole(`time-${i}-fromHour`, row.fromHour, 0, 23);
      const open = row.toHour.trim() === "";
      const toHour = open ? undefined : whole(`time-${i}-toHour`, row.toHour, 0, 23);
      const rate = money(`time-${i}-hourly`, row.hourly);
      if (open && i < form.timeSegments.length - 1) issues[`time-${i}-toHour`] = "invalid";
      if (fromHour !== null && toHour !== null && toHour !== undefined) {
        if (fromHour === toHour) issues[`time-${i}-toHour`] = "same-hours";
        else span += hoursBetween(fromHour, toHour);
      }
      if (fromHour !== null && toHour !== null && rate !== null) {
        timeSegments.push({ fromHour, ...(toHour !== undefined && { toHour }), hourly: rate });
      }
    });
    const chained = timeSegments.every(
      (seg, i) => i === 0 || timeSegments[i - 1]?.toHour === seg.fromHour,
    );
    if (!chained || span > 24) issues.time = "overlap";
    if (form.timeSegments.length > MAX_WAGE_SEGMENTS) issues.time = "too-many";
  }

  const afterStartSegments: WageAfterStartSegment[] = [];
  if (form.afterOn) {
    form.afterSegments.forEach((row, i) => {
      const afterHours = whole(`after-${i}-afterHours`, row.afterHours, 1, 48);
      const rate = money(`after-${i}-hourly`, row.hourly);
      if (afterHours !== null && rate !== null)
        afterStartSegments.push({ afterHours, hourly: rate });
    });
    const rising = afterStartSegments.every(
      (seg, i) => i === 0 || seg.afterHours > (afterStartSegments[i - 1]?.afterHours ?? 0),
    );
    if (!rising) issues.after = "not-rising";
    if (form.afterSegments.length > MAX_WAGE_SEGMENTS) issues.after = "too-many";
  }

  const count =
    (form.timeOn ? form.timeSegments.length : 0) + (form.afterOn ? form.afterSegments.length : 0);
  if (count > MAX_WAGE_SEGMENTS_IN_ALL) issues.segments = "too-many";

  if (hourly === null || Object.keys(issues).length > 0) return { ok: false, issues };
  return {
    ok: true,
    rule: {
      hourly,
      unitMinutes,
      roundUp: form.roundUp,
      ...(timeSegments.length > 0 && { timeSegments }),
      ...(afterStartSegments.length > 0 && { afterStartSegments }),
    },
  };
}
